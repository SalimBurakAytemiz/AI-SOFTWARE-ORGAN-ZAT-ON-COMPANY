import { Runtime } from "../runtime.ts";
import { doctor, probeRealProvider } from "../core/doctor.ts";
import { runProof } from "../proof/proof.ts";
import { runSoftwareFactoryProof } from "../proof/software-factory.ts";
import { RequestBudget } from "../proof/request-budget.ts";
import { CodexCliHarness } from "../agents/codex-cli-harness.ts";
import { dataDir, projectsDir } from "../config/paths.ts";
import { table, kv, heading, parseFlags } from "./format.ts";
import { UsageError, RuntimeError } from "../core/errors.ts";
import { HUMAN_FOUNDER } from "../approvals/approval-engine.ts";
import { readFileSync } from "node:fs";
import { ProjectStore } from "../project-factory/project-store.ts";
import { ProjectFactory } from "../project-factory/project-factory.ts";
import { verifyHandoffPackage } from "../project-factory/runtime-handoff.ts";
import { validateProjectDefinition } from "../project-factory/schema-check.ts";
import type { StructuredIntake } from "../project-factory/intake.ts";

const HELP = `ai-company - AI Software Company Agent Runtime V1.0

Usage: ai-company <command> [args] [--json]

  doctor [--probe]               Check runtime health (--probe: live proof-provider check)
  status                         One-line runtime status
  pause "<reason>"               Engage the global pause (blocks all writes)
  resume                         Lift the global pause

  agents list                    List the 18 AI employees
  agents show <id>               Show one agent definition (role, model, permissions)
  skills list                    List reusable skills
  tools list                     List tools and capabilities (grantable / reserved)
  workflows list                 List gated lifecycles
  workflows show <id>            Show a workflow's steps and gates

  task run "<instruction>"       Create + classify + drive a task to Human approval
  task create --title T --description D
  task list                      List tasks
  task status <task-id>          Show a task, its run, and its current step

  approvals list                 List approval requests
  approvals show <id>            Show one approval request (full context)
  approvals approve <id> [--note N]
  approvals reject <id> [--note N]
  approvals resume <run-id>      Continue a run after its approval was decided

  audit [--limit N] [--task ID]  Show recent audit events (optionally one task)

  new <slug> --name N --description D   Create a project workspace from a brief
  new <slug> --brief-file <path>        ...or from a natural-language brief file
  project list                   List projects
  project status <slug>          Show one project's lifecycle + handoff status
  project show <slug>            Print a project's project.yml
  project advance <slug>         Move a project one lifecycle state forward
  project verify <slug>          Validate the project + its Runtime handoff package
  project authorize-build <slug> [--note N]   Human Founder: authorize Runtime execution

  proof                          Run the safe end-to-end (mock) proof workflow
  proof software-factory [--real]  Real-agent Software Factory proof (mock by default)
  proof real-agent               Alias for 'proof software-factory --real'
  proof resume [<run-id>]        Continue an interrupted REAL proof from its checkpoint
  proof status                   Show the latest Software Factory proof run

The Human Founder is the supreme authority. No critical action executes without an
explicit 'approvals approve' by 'human-founder'.`;

export async function main(argv: string[]): Promise<number> {
  const { positionals, flags } = parseFlags(argv);
  const [command, sub, ...rest] = positionals;
  const json = flags.json === true;

  if (!command || command === "help" || flags.help) {
    console.log(HELP);
    return 0;
  }

  const rt = Runtime.create();
  try {
    return await dispatch(rt, command, sub, rest, flags, json);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`usage error: ${err.message}`);
      return 2;
    }
    if (err instanceof RuntimeError) {
      console.error(err.message);
      return 1;
    }
    console.error(err instanceof Error ? err.stack : String(err));
    return 1;
  } finally {
    rt.close();
  }
}

async function dispatch(
  rt: Runtime,
  command: string,
  sub: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  const out = (obj: unknown, human: () => void) => {
    if (json) console.log(JSON.stringify(obj, null, 2));
    else human();
  };

  switch (command) {
    case "doctor": {
      const report = doctor(rt);
      if (flags.probe === true) {
        report.checks.push(await probeRealProvider(rt));
      }
      out(report, () => {
        console.log(heading("ai-company doctor"));
        console.log(
          table(
            report.checks.map((c) => [statusIcon(c.status), c.name, c.detail]),
          ),
        );
        console.log(`\n${report.healthy ? "healthy" : "UNHEALTHY - see FAIL rows above"}`);
      });
      return report.healthy ? 0 : 1;
    }

    case "status": {
      const tasks = rt.orchestrator.tasks.list();
      const runs = rt.store.listRuns();
      const pending = rt.approvals.list("PENDING");
      const status = {
        paused: rt.control.isPaused(),
        pause_reason: rt.control.pauseReason(),
        tasks: tasks.length,
        runs: runs.length,
        pending_approvals: pending.length,
        audit_events: rt.audit.list(1_000_000).length,
      };
      out(status, () => {
        console.log(
          kv([
            ["runtime", status.paused ? `PAUSED (${status.pause_reason ?? "?"})` : "running"],
            ["tasks", status.tasks],
            ["workflow runs", status.runs],
            ["pending approvals", status.pending_approvals],
            ["audit events", status.audit_events],
          ]),
        );
      });
      return 0;
    }

    case "pause": {
      const reason = sub ?? (typeof flags.reason === "string" ? flags.reason : "");
      if (!reason) throw new UsageError('pause needs a reason: ai-company pause "<reason>"');
      rt.control.pause(reason);
      console.log(`runtime PAUSED: ${reason}`);
      return 0;
    }
    case "resume": {
      rt.control.resume();
      console.log("runtime resumed");
      return 0;
    }

    case "agents":
      return agentsCmd(rt, sub, rest, json);
    case "skills": {
      const skills = rt.registries.skills.all();
      out(skills, () =>
        console.log(
          table(
            skills.map((s) => [s.id, s.status, s.summary.split(". ")[0] ?? s.summary]),
            ["id", "status", "summary"],
          ),
        ),
      );
      return 0;
    }
    case "tools":
      return toolsCmd(rt, json);
    case "workflows":
      return workflowsCmd(rt, sub, rest, json);

    case "task":
      return taskCmd(rt, sub, rest, flags, json);
    case "approvals":
      return approvalsCmd(rt, sub, rest, flags, json);

    case "audit": {
      const limit = typeof flags.limit === "string" ? Number(flags.limit) : 40;
      const taskFilter = typeof flags.task === "string" ? flags.task : null;
      let events = rt.audit.list(1_000_000);
      if (taskFilter) events = events.filter((e) => e.task === taskFilter);
      events = events.slice(-limit);
      out(events, () =>
        console.log(
          table(
            events.map((e) => [
              e.timestamp.replace("T", " ").replace(/\..*/, ""),
              e.agent_id,
              e.action,
              e.result,
              e.reason.slice(0, 80),
            ]),
            ["time", "agent", "action", "result", "reason"],
          ),
        ),
      );
      return 0;
    }

    case "proof":
      return proofCmd(rt, sub, rest, flags, json);

    case "new":
      return newProjectCmd(rt, sub, rest, flags, json);
    case "project":
      return projectCmd(rt, sub, rest, flags, json);

    default:
      throw new UsageError(`unknown command '${command}'. Run 'ai-company help'.`);
  }
}

function agentsCmd(rt: Runtime, sub: string | undefined, rest: string[], json: boolean): number {
  if (sub === "list" || !sub) {
    const agents = rt.registries.agents.all();
    if (json) console.log(JSON.stringify(agents.map((a) => a.id)));
    else
      console.log(
        table(
          agents.map((a) => [a.id, a.department, `risk ${a.risk_level}`, a.preferred_model_tier, a.title]),
          ["id", "department", "ceiling", "model tier", "title"],
        ),
      );
    return 0;
  }
  if (sub === "show") {
    const id = rest[0];
    if (!id) throw new UsageError("agents show <id>");
    const a = rt.registries.agents.get(id);
    if (json) {
      console.log(JSON.stringify(a, null, 2));
      return 0;
    }
    console.log(heading(`${a.title}  (${a.id})`));
    console.log(
      kv([
        ["department", a.department],
        ["seniority", a.seniority],
        ["risk ceiling", a.risk_level],
        ["model tier", `${a.preferred_model_tier} (fallback ${a.fallback_model_tier})`],
        ["skills", a.required_skills.join(", ")],
        ["escalates to", a.escalation_to],
      ]),
    );
    console.log(`\n  granted capabilities:\n    ${a.allowed_tools.join(", ")}`);
    console.log(`\n  forbidden capabilities:\n    ${a.forbidden_tools.join(", ")}`);
    console.log(`\n  hands off to: ${a.handoff_to.join(", ")}`);
    return 0;
  }
  throw new UsageError("agents list | agents show <id>");
}

function toolsCmd(rt: Runtime, json: boolean): number {
  const caps = [...rt.registries.tools.capabilities.values()];
  if (json) {
    console.log(JSON.stringify(caps, null, 2));
    return 0;
  }
  console.log(heading("Capabilities (a tool is not a permission)"));
  console.log(
    table(
      caps.map((c) => [
        c.id,
        c.tool,
        `risk ${c.risk_level}`,
        c.grantable ? "grantable" : "RESERVED (Human Founder)",
      ]),
      ["capability", "tool", "risk", "grant"],
    ),
  );
  return 0;
}

function workflowsCmd(rt: Runtime, sub: string | undefined, rest: string[], json: boolean): number {
  if (sub === "show") {
    const id = rest[0];
    if (!id) throw new UsageError("workflows show <id>");
    const w = rt.registries.workflows.get(id);
    if (json) {
      console.log(JSON.stringify(w, null, 2));
      return 0;
    }
    console.log(heading(`${w.name}  (${w.id})  risk ${w.risk_level}`));
    console.log(w.purpose.trim());
    console.log();
    console.log(
      table(
        w.steps.map((s) => [
          s.id,
          s.owner,
          s.project_state ?? "-",
          [s.gate ? "GATE" : "", s.human_approval ? "HUMAN_APPROVAL" : ""].filter(Boolean).join("+") || "-",
          `pass->${s.on_pass} fail->${s.on_fail}`,
        ]),
        ["step", "owner", "state", "flags", "transitions"],
      ),
    );
    return 0;
  }
  const list = rt.registries.workflows.all();
  if (json) console.log(JSON.stringify(list.map((w) => w.id)));
  else
    console.log(
      table(
        list.map((w) => [w.id, `risk ${w.risk_level}`, w.reaches_production ? "reaches prod" : "internal", w.purpose.split(".")[0] ?? ""]),
        ["id", "risk", "scope", "purpose"],
      ),
    );
  return 0;
}

async function taskCmd(
  rt: Runtime,
  sub: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  if (sub === "run") {
    const instruction = rest.join(" ") || (typeof flags.description === "string" ? flags.description : "");
    if (!instruction) throw new UsageError('task run "<instruction>"');
    if (rt.control.isPaused()) {
      throw new UsageError(
        `runtime is paused (${rt.control.pauseReason() ?? "?"}); run 'ai-company resume' first`,
      );
    }
    const task = rt.orchestrator.tasks.create({
      title: instruction.slice(0, 80),
      description: instruction,
    });
    const { run, classification } = rt.orchestrator.plan(task);
    const result = await rt.orchestrator.drive(run.id);
    const payload = {
      task_id: task.id,
      workflow: classification.workflow_id,
      risk: classification.risk,
      run_status: result.run.status,
      project_state: result.run.project_state,
      stopped_because: result.stoppedBecause,
      steps: result.executions.map((e) => ({ step: e.step_id, agent: e.agent_id, tier: e.model_tier, outcome: e.outcome })),
      approval_id: result.run.pending_approval_id,
    };
    if (json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(heading(`Task ${task.id}`));
      console.log(kv([
        ["workflow", `${classification.workflow_id} (${classification.rationale})`],
        ["risk", classification.risk],
        ["run", result.run.id],
        ["status", result.run.status],
        ["stopped because", result.stoppedBecause],
      ]));
      console.log("\nchain:");
      for (const e of result.executions) {
        console.log(`  ${e.step_id.padEnd(20)} ${e.agent_id.padEnd(26)} tier=${e.model_tier} -> ${e.outcome}`);
      }
      if (result.run.pending_approval_id) {
        console.log(`\nAWAITING HUMAN FOUNDER: ai-company approvals show ${result.run.pending_approval_id}`);
      }
    }
    return 0;
  }
  if (sub === "create") {
    const title = typeof flags.title === "string" ? flags.title : "";
    const description = typeof flags.description === "string" ? flags.description : title;
    if (!title) throw new UsageError("task create --title T --description D");
    const task = rt.orchestrator.tasks.create({ title, description });
    console.log(json ? JSON.stringify(task, null, 2) : `created ${task.id}`);
    return 0;
  }
  if (sub === "list" || !sub) {
    const tasks = rt.orchestrator.tasks.list();
    if (json) console.log(JSON.stringify(tasks, null, 2));
    else
      console.log(
        table(
          tasks.map((t) => [t.id, t.status, t.workflow_id ?? "-", `risk ${t.risk}`, t.title.slice(0, 50)]),
          ["id", "status", "workflow", "risk", "title"],
        ),
      );
    return 0;
  }
  if (sub === "status") {
    const id = rest[0];
    if (!id) throw new UsageError("task status <task-id>");
    const task = rt.orchestrator.tasks.get(id);
    if (!task) throw new UsageError(`unknown task ${id}`);
    const run = rt.store.getRunByTask(id);
    const payload = { task, run };
    if (json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(heading(`Task ${task.id}`));
      console.log(kv([
        ["title", task.title],
        ["status", task.status],
        ["workflow", task.workflow_id ?? "-"],
        ["risk", task.risk],
      ]));
      if (run) {
        console.log(`\n  run ${run.id}: ${run.status} @ step '${run.current_step}' (project state ${run.project_state})`);
        for (const h of run.history) console.log(`    ${h.step_id.padEnd(20)} ${h.owner.padEnd(24)} ${h.result}`);
        if (run.pending_approval_id) console.log(`  pending approval: ${run.pending_approval_id}`);
      }
    }
    return 0;
  }
  throw new UsageError('task run "<instruction>" | task create | task list | task status <id>');
}

async function approvalsCmd(
  rt: Runtime,
  sub: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  const note = typeof flags.note === "string" ? flags.note : "";
  switch (sub) {
    case "list":
    case undefined: {
      const list = rt.approvals.list();
      if (json) console.log(JSON.stringify(list, null, 2));
      else
        console.log(
          table(
            list.map((a) => [a.id, a.state, `risk ${a.risk_level}`, a.requested_action, a.reason.slice(0, 50)]),
            ["id", "state", "risk", "action", "reason"],
          ),
        );
      return 0;
    }
    case "show": {
      const id = rest[0];
      if (!id) throw new UsageError("approvals show <id>");
      const a = rt.approvals.get(id);
      if (!a) throw new UsageError(`unknown approval ${id}`);
      if (json) {
        console.log(JSON.stringify(a, null, 2));
        return 0;
      }
      console.log(heading(`Approval ${a.id}  [${a.state}]`));
      console.log(
        kv([
          ["task", a.task_id],
          ["run / step", `${a.run_id} / ${a.step_id}`],
          ["requested by", a.requested_by],
          ["requested action", a.requested_action],
          ["reason", a.reason],
          ["risk", a.risk_level],
          ["impact", a.impact],
          ["environment", a.environment],
          ["tests", a.tests_summary],
          ["security", a.security_summary],
          ["rollback", a.rollback_summary],
          ["estimated cost", a.estimated_cost_usd == null ? "unknown" : `$${a.estimated_cost_usd}`],
          ["decided by", a.decided_by ?? "-"],
        ]),
      );
      if (a.state === "PENDING") {
        console.log(`\n  approve:  ai-company approvals approve ${a.id} --note "..."`);
        console.log(`  reject:   ai-company approvals reject ${a.id} --note "..."`);
      }
      return 0;
    }
    case "approve":
    case "reject": {
      const id = rest[0];
      if (!id) throw new UsageError(`approvals ${sub} <id>`);
      const decided =
        sub === "approve"
          ? rt.approvals.approve(id, HUMAN_FOUNDER, note)
          : rt.approvals.reject(id, HUMAN_FOUNDER, note);
      let follow = "";
      if (decided.run_id) {
        const res = await rt.orchestrator.resume(decided.run_id);
        follow = ` run ${decided.run_id} -> ${res.run.status} (${res.stoppedBecause})`;
      }
      console.log(`approval ${id} ${decided.state}.${follow}`);
      return 0;
    }
    case "resume": {
      const runId = rest[0];
      if (!runId) throw new UsageError("approvals resume <run-id>");
      const res = await rt.orchestrator.resume(runId);
      console.log(`run ${runId} -> ${res.run.status} (${res.stoppedBecause})`);
      return 0;
    }
    default:
      throw new UsageError("approvals list | show <id> | approve <id> | reject <id> | resume <run-id>");
  }
}

async function proofCmd(
  rt: Runtime,
  sub: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  // Legacy V1.0 mock proof.
  if (!sub) {
    const result = await runProof(rt);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(heading("Runtime proof workflow (mock)"));
      console.log(kv([
        ["task", result.task_id],
        ["workflow", result.workflow_id],
        ["steps executed", result.executions.length],
        ["run status", result.run_status],
        ["project state", result.project_state],
        ["stopped because", result.stopped_because],
        ["pending approval", result.approval_id ?? "-"],
      ]));
      for (const e of result.executions) {
        console.log(`  ${e.step_id.padEnd(20)} ${e.agent_id.padEnd(26)} tier=${e.model_tier} -> ${e.outcome}`);
      }
      console.log(`\n${result.assertion}`);
    }
    return result.ok ? 0 : 1;
  }

  if (sub === "status") {
    const tasks = rt.orchestrator.tasks.list().filter((t) => t.project === "runtime-proof-v1.1");
    const latest = tasks.at(-1);
    if (!latest) {
      console.log("no Software Factory proof run found. Try: ai-company proof software-factory");
      return 0;
    }
    const run = rt.store.getRunByTask(latest.id);
    const pending = rt.approvals.list("PENDING").filter((a) => a.task_id === latest.id);
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === latest.id);
    const realCalls = audit.filter((e) => e.action.startsWith("real_model_call:"));
    const payload = { task: latest, run, pending_approvals: pending, real_requests: realCalls.length };
    if (json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(heading(`Software Factory proof - task ${latest.id}`));
      console.log(kv([
        ["status", latest.status],
        ["workflow", latest.workflow_id ?? "-"],
        ["run status", run?.status ?? "-"],
        ["project state", run?.project_state ?? "-"],
        ["real model requests", realCalls.length],
        ["pending approval", pending[0]?.id ?? "-"],
      ]));
      if (run) for (const h of run.history) console.log(`  ${h.step_id.padEnd(20)} ${h.owner.padEnd(26)} ${h.result}`);
    }
    return 0;
  }

  // Resume an interrupted REAL Software Factory proof from its persisted
  // checkpoint (e.g. after an environment shutdown). Completed stages and the
  // implementation are NOT re-run - the workflow engine's persisted run drives
  // the remaining stages (qa -> security -> release_review -> HUMAN_APPROVAL).
  if (sub === "resume") {
    if (!rt.realProvider.ready) {
      const reason = rt.realProvider.reason;
      if (json) console.log(JSON.stringify({ blocked: true, mode: "REAL", reason }, null, 2));
      else console.log(`REAL PROOF RESUME BLOCKED: ${reason}`);
      return 1;
    }
    let runId = rest[0] ?? (typeof flags.run === "string" ? flags.run : undefined);
    if (!runId) {
      const tasks = rt.orchestrator.tasks.list().filter((t) => t.project === "runtime-proof-v1.1");
      for (const t of [...tasks].reverse()) {
        const r = rt.store.getRunByTask(t.id);
        if (r && r.status === "RUNNING") {
          runId = r.id;
          break;
        }
      }
    }
    if (!runId) {
      if (json) console.log(JSON.stringify({ blocked: true, reason: "no RUNNING Software Factory proof run to resume" }, null, 2));
      else console.log("no RUNNING Software Factory proof run found to resume. Pass a run id: ai-company proof resume <run-id>");
      return 1;
    }
    const priorRealRequests = rt.audit
      .list(1_000_000)
      .filter((e) => e.action.startsWith("real_model_call:") && !e.action.includes("_repair")).length;
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      resume: { runId },
      descriptor: rt.realProvider.descriptor ?? undefined,
      fallbackDescriptors: rt.realProviderChain.fallbacks,
      budget: new RequestBudget({ used: priorRealRequests }),
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return result.ok && !result.blocked ? 0 : 1;
    }
    console.log(heading("AI SOFTWARE COMPANY - Software Factory proof RESUME"));
    console.log(`\nProvider:\n  ${result.provider?.label ?? "-"}` + (result.provider?.model ? ` (model ${result.provider.model})` : ""));
    for (const tr of result.providerTransitions) {
      console.log(`  fallback: ${tr.from_provider} -> ${tr.to_provider} at stage '${tr.stage}' (${tr.reason}; checkpoint preserved)`);
    }
    if (result.blocked) {
      console.log(`\nSTATUS: BLOCKED\n  ${result.blockReason}`);
      return 1;
    }
    console.log(`\nWorkflow (resumed):`);
    for (const s of result.stages) console.log(`  ${s.stage.padEnd(20)} ${s.outcome}`);
    console.log(`\nPRODUCTION:\n  ${result.humanApprovalStatus === "HUMAN_APPROVAL_REQUIRED" ? "HUMAN APPROVAL REQUIRED" : "NOT REACHED"}`);
    console.log(`\n${result.assertion}`);
    return result.ok && !result.blocked ? 0 : 1;
  }

  const real = sub === "real-agent" || flags.real === true;
  if (sub !== "software-factory" && sub !== "real-agent") {
    throw new UsageError("proof [software-factory [--real] | real-agent | resume [<run-id>] | status]");
  }

  const mode: "REAL" | "MOCK" = real ? "REAL" : "MOCK";
  if (real && !rt.realProvider.ready) {
    const msg = `REAL PROOF BLOCKED: ${rt.realProvider.reason}`;
    if (json) console.log(JSON.stringify({ blocked: true, mode, reason: rt.realProvider.reason }, null, 2));
    else {
      console.log(heading("AI SOFTWARE COMPANY - Real Agent Proof"));
      console.log(msg);
      console.log("\nConfigure a proof provider credential securely, then re-run:");
      console.log("  export AI_COMPANY_REAL_PROVIDER=groq          # preferred proof provider");
      console.log("  export AI_COMPANY_REAL_MODEL=openai/gpt-oss-120b");
      console.log("  export GROQ_API_KEY=...                       # environment only, never commit");
      console.log("  ai-company doctor --probe                     # OK / NOT_CONFIGURED / RATE_LIMITED / ERROR");
      console.log("  ai-company proof real-agent");
      console.log("  # (OpenRouter remains an optional fallback: AI_COMPANY_REAL_PROVIDER=openrouter + OPENROUTER_API_KEY)");
    }
    return 1;
  }

  // PREMIUM implementation escalation - only when explicitly authorized for this
  // run. Report the plan BEFORE any real premium request (build spec: report
  // provider/model/stage/risk/estimated request count/reason first).
  const pi = real && rt.premiumImplProvider.authorized ? rt.premiumImplProvider : null;
  let premiumImpl: import("../proof/software-factory.ts").PremiumImplOption | undefined;
  if (pi) {
    const lines = ["PREMIUM ESCALATION (implementation stage only) - Human Founder authorized"];
    if (pi.kind === "codex-cli") {
      const harness = new CodexCliHarness({
        model: pi.codex?.model || undefined,
        timeoutMs: pi.codex?.timeoutMs,
        scratchDir: dataDir(),
      });
      const det = await harness.detect();
      lines.push(
        `  provider                : codex-cli (local Codex CLI, ChatGPT login - no paid API)`,
        `  codex                   : ${det.version ?? "not found"} | logged in: ${det.loggedIn ? "yes (ChatGPT)" : "NO"}`,
        `  model                   : ${pi.codex?.model || "account default"}`,
        `  stage                   : implementation`,
        `  risk                    : 2 (MEDIUM / standard development)`,
        `  estimated request count : 1 primary + at most 1 targeted repair`,
        `  escalation reason       : FREE_IMPLEMENTATION_QUALITY_BUDGET exhausted on both free proof models`,
        `  ready                   : ${det.available && det.loggedIn ? "yes" : "NO - " + det.reason}`,
      );
      premiumImpl = {
        kind: "codex-cli",
        codexHarness: harness,
        codexLabel: pi.codex?.label ?? "PREMIUM / Codex CLI (ChatGPT)",
        codexModel: pi.codex?.model ?? "",
      };
    } else if (pi.kind === "openai") {
      const d = pi.descriptor;
      lines.push(
        `  provider                : ${d?.provider.name ?? "-"} (${d?.baseUrl ?? "-"}) [PAID API]`,
        `  model                   : ${d?.model ?? "-"} (source: ${d?.modelSource ?? "-"})`,
        `  stage                   : implementation`,
        `  risk                    : 2 (MEDIUM / standard development)`,
        `  estimated request count : 1 primary + at most 1 targeted test-repair`,
        `  escalation reason       : FREE_IMPLEMENTATION_QUALITY_BUDGET exhausted on both free proof models`,
        `  ready                   : ${pi.ready ? "yes" : "NO - " + pi.reason}`,
      );
      premiumImpl = pi.ready ? { kind: "openai", openaiDescriptor: pi.descriptor ?? undefined } : undefined;
    }
    if (json) console.error(lines.join("\n"));
    else console.log("\n" + lines.join("\n"));
  }

  const result = await runSoftwareFactoryProof(rt, {
    mode,
    descriptor: real ? rt.realProvider.descriptor ?? undefined : undefined,
    fallbackDescriptors: real ? rt.realProviderChain.fallbacks : undefined,
    premiumImpl,
    budget: new RequestBudget(),
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok && !result.blocked ? 0 : 1;
  }

  console.log(heading("AI SOFTWARE COMPANY"));
  console.log(`\nTask:\n  ${PROOF_TITLE}`);
  console.log(`\nProvider:\n  ${result.provider?.label ?? "-"}` +
    (result.provider?.model ? ` (model ${result.provider.model})` : ""));
  for (const tr of result.providerTransitions) {
    console.log(
      `  fallback: ${tr.from_provider} -> ${tr.to_provider} at stage '${tr.stage}' (${tr.reason}; checkpoint preserved)`,
    );
  }
  if (result.premiumEscalation) {
    const p = result.premiumEscalation;
    const usage =
      p.kind === "codex-cli"
        ? `~${p.codexTokensUsed ?? "?"} tokens (ChatGPT plan, not API billing)`
        : `${p.tokenUsage.input_tokens ?? "?"} in / ${p.tokenUsage.output_tokens ?? "?"} out tokens`;
    console.log(
      `  premium: implementation stage on ${p.provider}:${p.model} -> ${p.outcome} ` +
        `(${p.requests} run(s), ${p.repairs} repair(s); ${usage})`,
    );
    if (p.changedFiles.length) console.log(`           changed files: ${p.changedFiles.join(", ")}`);
  }
  if (result.blocked) {
    console.log(`\nSTATUS: BLOCKED\n  ${result.blockReason}`);
    return 1;
  }
  console.log(`\nWorkflow:\n`);
  for (const s of result.stages) {
    const label = `${s.role}`.padEnd(30);
    const kind = s.modelBacked
      ? s.real
        ? `real-model${s.providerId ? `(${s.providerId})` : ""}`
        : "mock-model"
      : "auxiliary";
    const flagsStr = [
      kind,
      s.testEvidence ? `tests ${s.testEvidence.passed}p/${s.testEvidence.failed}f` : "",
      s.toolCalls && s.toolCalls.some((t) => t.executed) ? "tools✓" : "",
    ].filter(Boolean).join(" ");
    console.log(`  ${label} ${s.outcome.padEnd(7)} ${flagsStr}`);
  }
  console.log(`\nPRODUCTION:\n  ${result.humanApprovalStatus === "HUMAN_APPROVAL_REQUIRED" ? "HUMAN APPROVAL REQUIRED" : "NOT REACHED"}`);
  console.log(kv([
    ["mode", result.mode],
    ["real requests", result.realRequestCount],
    ["request budget", result.budget ? `${result.budget.used}/${result.budget.ceiling} (target ${result.budget.target})` : "-"],
    ["token usage", `${result.tokenUsage.input_tokens ?? "?"} in / ${result.tokenUsage.output_tokens ?? "?"} out`],
    ["cost", `$${result.cost.known_usd} / ${result.cost.note}`],
    ["real model(s)", result.realModelsUsed.join(", ") || "-"],
    [
      "rate-limit waits",
      result.rateLimitWaits.length > 0
        ? `${result.rateLimitWaits.length} (~${Math.round(result.totalRateLimitWaitMs / 1000)}s total; free-tier quota, no approval needed)`
        : "0",
    ],
    ["pending approval", result.approval_id ?? "-"],
    ["artifacts", result.artifactsDir ?? "-"],
    ["workspace", result.workspaceDir ?? "-"],
  ]));
  console.log(`\n${result.assertion}`);
  console.log("\nDetailed records: ai-company audit --task " + result.task_id);
  return result.ok ? 0 : 1;
}

const PROOF_TITLE = "Add a GET /health endpoint to the demo service";

// ---------------------------------------------------------------------------
// Project Factory V0.1
// ---------------------------------------------------------------------------

function projectFactory(rt: Runtime): ProjectFactory {
  return new ProjectFactory({ store: new ProjectStore(projectsDir()), clock: rt.clock, audit: rt.audit });
}

async function newProjectCmd(
  rt: Runtime,
  slug: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  if (rt.control.isPaused()) {
    throw new UsageError(`runtime is paused (${rt.control.pauseReason() ?? "?"}); run 'ai-company resume' first`);
  }
  const str = (k: string): string | undefined => (typeof flags[k] === "string" ? (flags[k] as string) : undefined);
  let brief = str("brief") ?? "";
  const briefFile = str("brief-file");
  if (briefFile) brief = readFileSync(briefFile, "utf8");
  const name = str("name");
  const description = str("description");
  if (!brief) {
    if (!name && !description) {
      throw new UsageError(
        'ai-company new <slug> --name "Name" --description "..."   (or --brief-file <path>)',
      );
    }
    brief = [name ? `Project name: ${name}` : "", description ? `Description: ${description}` : ""]
      .filter(Boolean)
      .join("\n");
  }
  const overrides: Partial<StructuredIntake> = {};
  if (name) overrides.project_name = name;
  if (description) overrides.description = description;
  if (str("workflow")) overrides.requested_workflow = str("workflow");
  if (str("risk")) overrides.risk_level = Number(str("risk"));

  const pf = projectFactory(rt);
  const def = pf.createProject({
    brief,
    slug: slug && !slug.startsWith("--") ? slug : undefined,
    overrides,
    stopAt: (str("stop-at") as never) ?? "READY_FOR_BUILD",
  });
  const status = pf.getProjectStatus(def.slug);

  if (json) {
    console.log(JSON.stringify(status, null, 2));
    return 0;
  }
  console.log(heading(`Project created: ${def.slug}`));
  console.log(
    kv([
      ["name", def.project_name],
      ["id", def.project_id],
      ["type / model", `${def.project_type} / ${def.business_model}`],
      ["market", def.target_market],
      ["risk / security", `${def.risk_level} / ${def.security_level}`],
      ["workflow", def.requested_workflow],
      ["lifecycle state", status.status],
      ["handoff package", status.handoff_present ? status.handoff_checksum : "not yet"],
      ["build authorized", status.build_authorized ? `yes (${status.build_authorized_by})` : "NO - awaiting Human Founder"],
      ["workspace", `${projectsDir()}/${def.slug}/`],
    ]),
  );
  console.log(`\nArtifacts:\n${status.artifacts.map((a) => `  ${a}`).join("\n")}`);
  console.log(
    `\nNext: review projects/${def.slug}/, then\n  ai-company project authorize-build ${def.slug} --note "..."   (Human Founder only)`,
  );
  return 0;
}

async function projectCmd(
  rt: Runtime,
  sub: string | undefined,
  rest: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<number> {
  const pf = projectFactory(rt);
  const slug = rest[0];

  switch (sub) {
    case "list": {
      const rows = pf.listProjects();
      if (json) {
        console.log(JSON.stringify(rows, null, 2));
        return 0;
      }
      if (rows.length === 0) {
        console.log("no projects yet. Create one: ai-company new <slug> --name N --description D");
        return 0;
      }
      console.log(
        table(
          rows.map((r) => [
            r.slug,
            r.status,
            `risk ${r.risk_level}`,
            r.requested_workflow,
            r.build_authorized ? "build:authorized" : "build:pending",
            r.project_name,
          ]),
          ["slug", "state", "risk", "workflow", "build", "name"],
        ),
      );
      return 0;
    }
    case "status": {
      if (!slug) throw new UsageError("ai-company project status <slug>");
      const s = pf.getProjectStatus(slug);
      if (json) {
        console.log(JSON.stringify(s, null, 2));
        return 0;
      }
      console.log(heading(`Project ${s.slug}`));
      console.log(
        kv([
          ["name", s.project_name],
          ["lifecycle state", s.status],
          ["next state", s.next_state ?? "(terminal for Project Factory)"],
          ["risk / security", `${s.risk_level} / ${s.security_level}`],
          ["requested workflow", s.requested_workflow],
          ["budget", `free_first=${s.budget_policy.free_first}, <=${s.budget_policy.max_real_provider_requests} real req, ${s.budget_policy.max_premium_invocations} premium`],
          ["handoff package", s.handoff_present ? s.handoff_checksum : "not generated"],
          ["build authorized", s.build_authorized ? `yes (${s.build_authorized_by})` : "NO - awaiting Human Founder"],
        ]),
      );
      console.log("\nlifecycle history:");
      for (const h of s.history) console.log(`  ${h.at}  ${h.state.padEnd(16)} ${h.note}`);
      return 0;
    }
    case "show": {
      if (!slug) throw new UsageError("ai-company project show <slug>");
      console.log(pf.store.readFile(slug, "project.yml"));
      return 0;
    }
    case "advance": {
      if (!slug) throw new UsageError("ai-company project advance <slug>");
      const def = pf.advanceProject(slug);
      console.log(json ? JSON.stringify(pf.getProjectStatus(slug), null, 2) : `${slug} -> ${def.status}`);
      return 0;
    }
    case "verify": {
      if (!slug) throw new UsageError("ai-company project verify <slug>");
      const def = validateProjectDefinition(pf.store.loadDefinition(slug));
      const handoff = pf.store.hasFile(slug, "artifacts/runtime-handoff.json")
        ? verifyHandoffPackage(pf.store.loadHandoff(slug))
        : null;
      const report = {
        slug,
        project_definition_valid: def.valid,
        project_definition_errors: def.errors,
        handoff_present: handoff !== null,
        handoff: handoff,
      };
      if (json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(heading(`Verify ${slug}`));
        console.log(
          kv([
            ["project.yml valid", def.valid ? "yes" : `NO - ${def.errors.join("; ")}`],
            ["handoff present", handoff ? "yes" : "no"],
            ["handoff schema+checksum+governance", handoff ? (handoff.valid ? "OK" : `FAIL - ${handoff.errors.join("; ")}`) : "n/a"],
            ["build authorized", handoff ? (handoff.buildAuthorized ? "yes" : "no") : "n/a"],
          ]),
        );
      }
      const ok = def.valid && (handoff === null || handoff.valid);
      return ok ? 0 : 1;
    }
    case "authorize-build": {
      if (!slug) throw new UsageError("ai-company project authorize-build <slug> [--note N]");
      const note = typeof flags.note === "string" ? flags.note : undefined;
      const def = pf.authorizeBuild(slug, { by: HUMAN_FOUNDER, note });
      const s = pf.getProjectStatus(slug);
      if (json) {
        console.log(JSON.stringify(s, null, 2));
      } else {
        console.log(`build authorized for '${slug}' by ${def.build_authorization.granted_by} at ${def.build_authorization.granted_at}`);
        console.log(`handoff package: ${s.handoff_checksum}`);
        console.log("\nProject Factory does NOT start the build. Runtime V1.1 executes it separately under Human Founder control.");
      }
      return 0;
    }
    default:
      throw new UsageError("ai-company project list | status <slug> | show <slug> | advance <slug> | verify <slug> | authorize-build <slug>");
  }
}

function statusIcon(status: string): string {
  return (
    {
      OK: "[ ok ]",
      NOT_CONFIGURED: "[n/c ]",
      OPTIONAL: "[opt ]",
      DEFERRED: "[defr]",
      RATE_LIMITED: "[rate]",
      ERROR: "[ERR ]",
      FAIL: "[FAIL]",
    } as Record<
      string,
      string
    >
  )[status] ?? `[${status}]`;
}
