import type { AgentDefinition, WorkflowStep, Task, WorkflowRun, RiskLevel } from "../core/types.ts";
import type { Registries } from "../registry/index.ts";
import type { ModelRouter } from "../models/router.ts";
import type { CapabilityGateway } from "../permissions/capability-gateway.ts";
import type { CostAccounting } from "../cost/cost-accounting.ts";
import type { Observability } from "../telemetry/observability.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import { buildContext } from "../orchestrator/context-builder.ts";
import { assessRiskFromText } from "../policy/risk.ts";

export interface ToolCheck {
  capability: string;
  allowed: boolean;
  approvalRequired: boolean;
  reason: string;
  /** A probe is a capability the step deliberately should NOT have; its denial
   *  demonstrates the gateway and never fails the step. */
  probe: boolean;
}

export interface StepExecution {
  step_id: string;
  agent_id: string;
  output: string;
  outcome: "PASS" | "FAIL";
  model_tier: string;
  model_reason: string;
  used_model: boolean;
  context_bytes: number;
  tool_checks: ToolCheck[];
}

/** Per-step scripting hook so tests and the proof can force a FAIL deterministically. */
export type OutcomeScript = (ctx: {
  agentId: string;
  stepId: string;
  runId: string;
}) => "PASS" | "FAIL" | undefined;

/**
 * Runs one workflow step as one agent. Behaviour derives entirely from the agent
 * definition: its model tier, its granted capabilities, its skills, its risk
 * ceiling (build spec section 3). The runner never executes a real external tool
 * in V1 - it checks each capability it would need through the Capability Gateway
 * and records the decision.
 */
export class AgentRunner {
  private readonly reg: Registries;
  private readonly router: ModelRouter;
  private readonly gateway: CapabilityGateway;
  private readonly cost: CostAccounting;
  private readonly obs: Observability;
  private readonly audit: AuditLog;
  private readonly script: OutcomeScript | undefined;

  constructor(
    reg: Registries,
    router: ModelRouter,
    gateway: CapabilityGateway,
    cost: CostAccounting,
    obs: Observability,
    audit: AuditLog,
    script?: OutcomeScript,
  ) {
    this.reg = reg;
    this.router = router;
    this.gateway = gateway;
    this.cost = cost;
    this.obs = obs;
    this.audit = audit;
    this.script = script;
  }

  async runStep(
    agent: AgentDefinition,
    step: WorkflowStep,
    task: Task,
    run: WorkflowRun,
    previousOutput: string | null,
    taskType: string,
  ): Promise<StepExecution> {
    const span = this.obs.startSpan(`agent:${agent.id}:${step.id}`, "agent", {
      agent: agent.id,
      step: step.id,
      run: run.id,
      task: task.id,
    });

    const ctx = buildContext(this.reg, agent, step, task, previousOutput);
    const stepRisk = (step.risk_level ?? task.risk) as RiskLevel;

    // 1. Route a model tier for this step.
    const decision = this.router.route({
      agent,
      taskType,
      risk: stepRisk,
      complexity: assessRiskFromText(step.action) >= 4 ? "high" : "normal",
      qualityBar: agent.department === "review" || agent.department === "security" ? "critical" : "normal",
    });

    let output = "";
    let usedModel = false;
    if (decision.tier === "NO_AI") {
      output = `[NO_AI] ${agent.id} completed '${step.id}' deterministically: ${step.action}`;
    } else {
      const prompt = [
        `You are acting as ${agent.title} on step "${step.name}".`,
        `Action: ${step.action}`,
        previousOutput ? `Prior stage output:\n${previousOutput}` : "",
        `Produce your stage output.`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const modelSpan = this.obs.startSpan(`model:${decision.tier}`, "model_call", {
        agent: agent.id,
        tier: decision.tier,
      });
      const { result } = await this.router.run(
        { agent, taskType, risk: stepRisk },
        prompt,
        {
          system: `${agent.mission.trim()}\nContext bytes: ${ctx.byte_size}`,
          context: Object.entries(ctx.sections)
            .map(([k, v]) => `## ${k}\n${v}`)
            .join("\n\n"),
          seed: 42,
        },
      );
      usedModel = true;
      output = result.text;
      this.cost.record({
        task_id: task.id,
        run_id: run.id,
        agent_id: agent.id,
        workflow_id: run.workflow_id,
        provider: result.provider,
        model: result.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        estimated_cost_usd: result.estimated_cost_usd,
        duration_ms: result.duration_ms,
      });
      modelSpan.setAttribute("model", result.model);
      modelSpan.end("OK");
    }

    // 2. Check the capabilities this step needs, plus probe capabilities it must
    //    not have, through the gateway.
    const { needs, probes } = capabilitiesForStep(step, agent);
    const toolChecks: ToolCheck[] = [];
    for (const [cap, probe] of [
      ...needs.map((c) => [c, false] as const),
      ...probes.map((c) => [c, true] as const),
    ]) {
      const res = this.gateway.authorize({
        agentId: agent.id,
        capability: cap,
        action: step.id,
        taskId: task.id,
        runId: run.id,
        stepId: step.id,
        risk: stepRisk,
        environment: step.project_state === "STAGING" ? "staging" : "sandbox",
        reason: probe
          ? `${agent.id} probe of ${cap} for step ${step.id}`
          : `${agent.id} needs ${cap} for step ${step.id}`,
      });
      toolChecks.push({
        capability: cap,
        allowed: res.allowed,
        approvalRequired: res.approvalRequired,
        reason: res.decision.reason,
        probe,
      });
    }

    // 3. Outcome. Deterministic PASS unless a script forces FAIL, or a needed
    //    (non-probe) capability was outright denied (not merely approval-gated).
    const scripted = this.script?.({ agentId: agent.id, stepId: step.id, runId: run.id });
    const hardDenied = toolChecks.some((c) => !c.probe && !c.allowed && !c.approvalRequired);
    const outcome: "PASS" | "FAIL" =
      scripted ?? (hardDenied ? "FAIL" : "PASS");

    this.audit.record({
      task: task.id,
      agent_id: agent.id,
      agent_role: agent.department,
      model: usedModel ? `tier:${decision.tier}` : "none",
      action: `agent_step:${step.id}`,
      reason: `${agent.id} produced stage output for '${step.id}' (${decision.reason})`,
      risk_level: stepRisk,
      result: outcome === "PASS" ? "PASS" : "FAIL",
      output_reference: `run:${run.id}:${step.id}`,
    });
    span.setAttribute("outcome", outcome);
    span.end(outcome === "PASS" ? "OK" : "ERROR");

    return {
      step_id: step.id,
      agent_id: agent.id,
      output,
      outcome,
      model_tier: decision.tier,
      model_reason: decision.reason,
      used_model: usedModel,
      context_bytes: ctx.byte_size,
      tool_checks: toolChecks,
    };
  }
}

/** A small, deterministic map of which capabilities a step exercises or probes. */
function capabilitiesForStep(
  step: WorkflowStep,
  agent: AgentDefinition,
): { needs: string[]; probes: string[] } {
  const needs: string[] = [];
  const probes: string[] = [];
  const id = step.id;
  const has = (c: string) => agent.allowed_tools.includes(c);
  if (/implement|fix|adr|proposal|design/.test(id)) {
    for (const c of ["fs.write", "git.branch", "git.commit", "github.create_pr"]) {
      if (has(c)) needs.push(c);
    }
  }
  if (/self_test|test|regression|targeted_test|scan|verify_fix/.test(id)) {
    for (const c of ["shell.exec_sandbox", "semgrep.scan", "playwright.run", "trivy.scan"]) {
      if (has(c)) needs.push(c);
    }
  }
  if (/review|code_review/.test(id)) {
    for (const c of ["github.review", "github.comment"]) if (has(c)) needs.push(c);
  }
  if (/staging|deploy/.test(id)) probes.push("deploy.production");
  if (/production_apply|migrat/.test(id)) probes.push("db.migrate_production");
  if (needs.length === 0 && has("github.read")) needs.push("github.read");
  return { needs: [...new Set(needs)], probes: [...new Set(probes)] };
}
