import { Runtime } from "../runtime.ts";
import { doctor } from "../core/doctor.ts";
import { runProof } from "../proof/proof.ts";
import { runSoftwareFactoryProof } from "../proof/software-factory.ts";
import { RequestBudget } from "../proof/request-budget.ts";
import { table, kv, heading, parseFlags } from "./format.ts";
import { UsageError, RuntimeError } from "../core/errors.ts";
import { HUMAN_FOUNDER } from "../approvals/approval-engine.ts";

const HELP = `ai-company - AI Software Company Agent Runtime V1.0

Usage: ai-company <command> [args] [--json]

  doctor                         Check runtime health
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
  proof                          Run the safe end-to-end (mock) proof workflow
  proof software-factory [--real]  Real-agent Software Factory proof (mock by default)
  proof real-agent               Alias for 'proof software-factory --real'
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
      return proofCmd(rt, sub, flags, json);

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

  const real = sub === "real-agent" || flags.real === true;
  if (sub !== "software-factory" && sub !== "real-agent") {
    throw new UsageError("proof [software-factory [--real] | real-agent | status]");
  }

  const mode: "REAL" | "MOCK" = real ? "REAL" : "MOCK";
  if (real && !rt.realProvider.ready) {
    const msg = `REAL PROOF BLOCKED: ${rt.realProvider.reason}`;
    if (json) console.log(JSON.stringify({ blocked: true, mode, reason: rt.realProvider.reason }, null, 2));
    else {
      console.log(heading("AI SOFTWARE COMPANY - Real Agent Proof"));
      console.log(msg);
      console.log("\nConfigure a provider credential securely, then re-run:");
      console.log("  export OPENROUTER_API_KEY=...        # never commit this");
      console.log("  ai-company doctor");
      console.log("  ai-company proof real-agent");
    }
    return 1;
  }

  const result = await runSoftwareFactoryProof(rt, {
    mode,
    descriptor: real ? rt.realProvider.descriptor ?? undefined : undefined,
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
  if (result.blocked) {
    console.log(`\nSTATUS: BLOCKED\n  ${result.blockReason}`);
    return 1;
  }
  console.log(`\nWorkflow:\n`);
  for (const s of result.stages) {
    const label = `${s.role}`.padEnd(30);
    const kind = s.modelBacked ? (s.real ? "real-model" : "mock-model") : "auxiliary";
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
    ["pending approval", result.approval_id ?? "-"],
    ["artifacts", result.artifactsDir ?? "-"],
    ["workspace", result.workspaceDir ?? "-"],
  ]));
  console.log(`\n${result.assertion}`);
  console.log("\nDetailed records: ai-company audit --task " + result.task_id);
  return result.ok ? 0 : 1;
}

const PROOF_TITLE = "Add a GET /health endpoint to the demo service";

function statusIcon(status: string): string {
  return (
    { OK: "[ ok ]", NOT_CONFIGURED: "[n/c ]", OPTIONAL: "[opt ]", DEFERRED: "[defr]", FAIL: "[FAIL]" } as Record<
      string,
      string
    >
  )[status] ?? `[${status}]`;
}
