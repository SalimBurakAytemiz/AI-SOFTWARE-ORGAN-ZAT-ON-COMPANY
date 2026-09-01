import type {
  AgentDefinition,
  WorkflowStep,
  WorkflowDefinition,
  Task,
  WorkflowRun,
  RiskLevel,
} from "../core/types.ts";
import type { Registries } from "../registry/index.ts";
import type { CapabilityGateway } from "../permissions/capability-gateway.ts";
import type { CostAccounting } from "../cost/cost-accounting.ts";
import type { Observability } from "../telemetry/observability.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { ModelProvider } from "../models/provider.ts";
import type { ModelTier } from "../core/types.ts";
import { ModelRouter } from "../models/router.ts";
import { assembleAgentPrompt } from "./prompt-assembler.ts";
import {
  parseModelResult,
  type AgentExecutionResult,
  type ModelAuthoredResult,
  type RequestedToolCall,
} from "./agent-execution-result.ts";
import type { ProofWorkspace } from "../proof/proof-workspace.ts";
import type { RequestBudget } from "../proof/request-budget.ts";
import { newId } from "../core/ids.ts";
import { looksLikeSecret } from "../core/redaction.ts";

/**
 * Real, model-backed agent execution behind the existing AgentRunner concept
 * (build spec sections 8, 9, 11, 19, 20, 22, 23, 29).
 *
 * MODEL -> requests capability -> Capability Gateway -> Policy Engine ->
 * ALLOW/DENY/APPROVAL_REQUIRED -> Tool Executor. Model text is never concatenated
 * into a shell. The structured result is parsed and validated; a malformed result
 * is retried within the request budget and then BLOCKS the stage.
 */

/** Runtime tool name -> the governance capability the Capability Gateway checks. */
const TOOL_CAPABILITY: Record<string, string> = {
  "workspace.read": "fs.read",
  "workspace.list": "fs.read",
  "workspace.write": "fs.write",
  "workspace.patch": "fs.write",
  "workspace.exec": "shell.exec_sandbox",
};

export interface StagePlan {
  /** Runtime tools this stage may request. */
  allowedRuntimeTools: string[];
  /** Include the workspace file listing + key files in context. */
  includeWorkspaceFiles: boolean;
  /** Include the unified workspace diff in context. */
  includeWorkspaceDiff: boolean;
  /** The runner runs `npm test` itself and attaches machine evidence. */
  runTests: boolean;
  /** The runner runs deterministic security checks itself. */
  runSecurityScan: boolean;
  /** After the stage, require the workspace to actually contain changes. */
  requireWorkspaceChange: boolean;
  /** After the stage, require this string to appear in the workspace source. */
  requireInSource?: string;
  /** Constrain the final status vocabulary (release manager). */
  restrictStatusTo?: ("READY_FOR_HUMAN_APPROVAL" | "BLOCKED")[];
}

export interface RealStageInput {
  agent: AgentDefinition;
  workflow: WorkflowDefinition;
  step: WorkflowStep;
  task: Task;
  run: WorkflowRun;
  priorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[];
  plan: StagePlan;
  workspace: ProofWorkspace;
  budget: RequestBudget;
  contextBudgetBytes?: number;
}

export interface ToolCallOutcome {
  tool: string;
  capability: string | null;
  decision: "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "INVALID";
  executed: boolean;
  detail: string;
}

export interface RealStageOutcome {
  execution: AgentExecutionResult;
  /** PASS / FAIL / BLOCKED after runner enforcement (may differ from model status). */
  outcome: "PASS" | "FAIL" | "BLOCKED";
  toolCalls: ToolCallOutcome[];
  testEvidence: { command: string; exitCode: number; passed: number; failed: number; ran: boolean } | null;
  securityEvidence: { checks: { check: string; result: string; detail: string }[] } | null;
  attempts: number;
  contextBytes: number;
  truncatedSections: string[];
  modelStatus: string;
  enforcementNotes: string[];
}

const MAX_MALFORMED_RETRIES = 1;

export class RealAgentRunner {
  private readonly reg: Registries;
  private readonly provider: ModelProvider;
  private readonly providerLabel: string;
  private readonly gateway: CapabilityGateway;
  private readonly cost: CostAccounting;
  private readonly obs: Observability;
  private readonly audit: AuditLog;

  constructor(
    reg: Registries,
    provider: ModelProvider,
    providerLabel: string,
    gateway: CapabilityGateway,
    cost: CostAccounting,
    obs: Observability,
    audit: AuditLog,
  ) {
    this.reg = reg;
    this.provider = provider;
    this.providerLabel = providerLabel;
    this.gateway = gateway;
    this.cost = cost;
    this.obs = obs;
    this.audit = audit;
  }

  private routeTier(agent: AgentDefinition, step: WorkflowStep, task: Task): { tier: ModelTier; reason: string } {
    const router = new ModelRouter(this.reg.models, [this.provider]);
    const decision = router.route({
      agent,
      taskType: "feature_implementation",
      risk: (step.risk_level ?? task.risk) as RiskLevel,
      qualityBar:
        agent.department === "review" || agent.department === "security" ? "critical" : "normal",
    });
    // The proof provider serves every non-NO_AI tier with one model; NO_AI never
    // reaches a real runner (those stages are handled deterministically upstream).
    const tier = decision.tier === "NO_AI" ? "STANDARD_CODING" : decision.tier;
    return { tier, reason: decision.reason };
  }

  async runStage(input: RealStageInput): Promise<RealStageOutcome> {
    const { agent, workflow, step, task, run, plan, workspace, budget } = input;
    const span = this.obs.startSpan(`real-agent:${agent.id}:${step.id}`, "agent", {
      agent: agent.id,
      step: step.id,
      run: run.id,
      task: task.id,
      real: true,
    });
    const enforcementNotes: string[] = [];

    const { tier, reason: routeReason } = this.routeTier(agent, step, task);

    const assembled = assembleAgentPrompt({
      reg: this.reg,
      agent,
      workflow,
      step,
      task,
      priorArtifacts: input.priorArtifacts,
      allowedRuntimeTools: plan.allowedRuntimeTools,
      workspaceDiff: plan.includeWorkspaceDiff ? workspace.diff() : undefined,
      workspaceFiles: plan.includeWorkspaceFiles ? workspace.keyFiles() : undefined,
      contextBudgetBytes: input.contextBudgetBytes,
    });

    // --- model call with bounded malformed-response retry -------------------
    let parsed: ModelAuthoredResult | null = null;
    let attempts = 0;
    let lastProblems: string[] = [];
    let usage: AgentExecutionResult["usage"] = {
      provider: this.provider.name,
      model: String(tier),
      real: this.provider.name !== "mock",
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      duration_ms: 0,
      request_number: 0,
    };

    for (let i = 0; i <= MAX_MALFORMED_RETRIES; i++) {
      budget.reserve(1); // throws BudgetExceededError at the ceiling
      attempts++;
      const modelSpan = this.obs.startSpan(`model:${tier}`, "model_call", { agent: agent.id, tier });
      const prompt =
        i === 0
          ? assembled.prompt
          : `${assembled.prompt}\n\n## retry\nYour previous response was rejected: ${lastProblems.join("; ")}. Return ONLY the JSON object.`;
      const result = await this.provider.generate({
        tier,
        system: assembled.system,
        prompt,
        seed: 42,
        maxOutputTokens: 1800,
      });
      usage = {
        provider: result.provider,
        model: result.model,
        real: result.provider !== "mock",
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        estimated_cost_usd: result.estimated_cost_usd,
        duration_ms: result.duration_ms,
        request_number: budget.count,
      };
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
      modelSpan.setAttribute("request_number", budget.count);
      modelSpan.end("OK");

      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `${result.provider}:${result.model}`,
        action: `real_model_call:${step.id}`,
        reason:
          `real request #${budget.count} for stage '${step.id}' (${this.providerLabel}); ` +
          `tier ${tier}; ${routeReason}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: "PASS",
        duration: result.duration_ms,
        estimated_cost: result.estimated_cost_usd,
        output_reference: `run:${run.id}:${step.id}:attempt${attempts}`,
      });

      const outcome = parseModelResult(result.text);
      if (outcome.ok && outcome.value) {
        parsed = outcome.value;
        break;
      }
      lastProblems = outcome.problems;
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `${result.provider}:${result.model}`,
        action: `malformed_agent_result:${step.id}`,
        reason: `structured output invalid (attempt ${attempts}): ${outcome.problems.join("; ")}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: i < MAX_MALFORMED_RETRIES ? "PENDING" : "BLOCKED",
      });
    }

    if (!parsed) {
      // Malformed after retries -> BLOCK the workflow. Never guess.
      span.end("ERROR");
      const execution = this.finalize(agent, step, task, run, usage, {
        status: "BLOCKED",
        summary: "structured output validation failed after retries",
        reasoningSummary: "the model did not return a valid AgentExecutionResult",
        artifacts: [],
        recommendations: [],
        requestedToolCalls: [],
        handoff: null,
        qualityEvidence: [],
        risks: ["model cannot produce the required structured contract"],
        errors: lastProblems,
      });
      return {
        execution,
        outcome: "BLOCKED",
        toolCalls: [],
        testEvidence: null,
        securityEvidence: null,
        attempts,
        contextBytes: assembled.contextBytes,
        truncatedSections: assembled.truncated,
        modelStatus: "MALFORMED",
        enforcementNotes: ["blocked: malformed structured output"],
      };
    }

    // --- adjudicate + execute requested tool calls -------------------------
    const toolCalls: ToolCallOutcome[] = [];
    for (const call of parsed.requestedToolCalls) {
      toolCalls.push(
        await this.handleToolCall(call, agent, step, task, run, workspace, plan.allowedRuntimeTools),
      );
    }

    // --- runner-enforced machine evidence (never trust prose) -------------
    let testEvidence: RealStageOutcome["testEvidence"] = null;
    if (plan.runTests) {
      const res = await workspace.exec("npm test");
      const counts = parseNodeTestCounts(res.stdout + "\n" + res.stderr);
      testEvidence = {
        command: "npm test",
        exitCode: res.exitCode,
        passed: counts.pass,
        failed: counts.fail,
        ran: res.allowed,
      };
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        action: `qa_test_execution:${step.id}`,
        reason: `npm test exit=${res.exitCode} pass=${counts.pass} fail=${counts.fail}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: res.exitCode === 0 && counts.fail === 0 ? "PASS" : "FAIL",
        capability: "shell.exec_sandbox",
        tool: "sandbox",
      });
    }

    let securityEvidence: RealStageOutcome["securityEvidence"] = null;
    if (plan.runSecurityScan) {
      securityEvidence = { checks: this.deterministicSecurityChecks(workspace) };
      const failed = securityEvidence.checks.filter((c) => c.result === "FAIL");
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        action: `security_scan:${step.id}`,
        reason: `deterministic checks: ${securityEvidence.checks.map((c) => `${c.check}=${c.result}`).join(", ")}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: failed.length === 0 ? "PASS" : "FAIL",
      });
    }

    // --- decide the enforced outcome ------------------------------------
    let outcome: "PASS" | "FAIL" | "BLOCKED" =
      parsed.status === "BLOCKED" ? "BLOCKED" : parsed.status === "FAIL" ? "FAIL" : "PASS";

    if (plan.requireWorkspaceChange && !workspace.hasChanges()) {
      outcome = "BLOCKED";
      enforcementNotes.push("blocked: stage was required to change the workspace but produced no diff");
    }
    if (plan.requireInSource) {
      const present = workspace
        .list()
        .some((p) => /\.(js|ts)$/.test(p) && safeIncludes(workspace, p, plan.requireInSource!));
      if (!present) {
        outcome = "BLOCKED";
        enforcementNotes.push(`blocked: required token '${plan.requireInSource}' not found in workspace source`);
      }
    }
    if (testEvidence && (testEvidence.exitCode !== 0 || testEvidence.failed > 0 || !testEvidence.ran)) {
      outcome = "FAIL";
      enforcementNotes.push(
        `fail: npm test exit=${testEvidence.exitCode} failed=${testEvidence.failed} ran=${testEvidence.ran}`,
      );
    }
    if (testEvidence && testEvidence.exitCode === 0 && testEvidence.passed === 0) {
      outcome = "FAIL";
      enforcementNotes.push("fail: no tests were executed (0 passing) - acceptance requires automated tests");
    }
    if (securityEvidence && securityEvidence.checks.some((c) => c.result === "FAIL")) {
      outcome = "FAIL";
      enforcementNotes.push("fail: deterministic security check failed");
    }
    if (plan.restrictStatusTo) {
      const mapped = outcome === "PASS" ? "READY_FOR_HUMAN_APPROVAL" : "BLOCKED";
      enforcementNotes.push(`release verdict: ${mapped}`);
    }

    const execution = this.finalize(agent, step, task, run, usage, parsed);
    span.setAttribute("outcome", outcome);
    span.end(outcome === "PASS" ? "OK" : "ERROR");

    return {
      execution,
      outcome,
      toolCalls,
      testEvidence,
      securityEvidence,
      attempts,
      contextBytes: assembled.contextBytes,
      truncatedSections: assembled.truncated,
      modelStatus: parsed.status,
      enforcementNotes,
    };
  }

  // ----------------------------------------------------------------------

  private async handleToolCall(
    call: RequestedToolCall,
    agent: AgentDefinition,
    step: WorkflowStep,
    task: Task,
    run: WorkflowRun,
    workspace: ProofWorkspace,
    allowed: string[],
  ): Promise<ToolCallOutcome> {
    const capability = TOOL_CAPABILITY[call.tool] ?? null;
    if (!capability) {
      return { tool: call.tool, capability: null, decision: "INVALID", executed: false, detail: "unknown runtime tool" };
    }
    if (!allowed.includes(call.tool)) {
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        action: `tool_call_out_of_scope:${step.id}`,
        reason: `${agent.id} requested '${call.tool}' which is not offered at stage '${step.id}'`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: "BLOCKED",
      });
      return {
        tool: call.tool,
        capability,
        decision: "DENY",
        executed: false,
        detail: "tool not offered at this stage",
      };
    }

    const auth = this.gateway.authorize({
      agentId: agent.id,
      capability,
      action: `${step.id}:${call.tool}`,
      taskId: task.id,
      runId: run.id,
      stepId: step.id,
      risk: (step.risk_level ?? task.risk) as RiskLevel,
      environment: "sandbox",
      reason: `${agent.id} real-agent requested ${call.tool} (${capability}) for '${step.id}': ${call.reason || "no reason given"}`,
    });

    if (!auth.allowed) {
      return {
        tool: call.tool,
        capability,
        decision: auth.approvalRequired ? "APPROVAL_REQUIRED" : "DENY",
        executed: false,
        detail: auth.decision.reason,
      };
    }

    // ALLOW -> execute against the disposable workspace only.
    try {
      const detail = await this.executeWorkspaceTool(call, workspace);
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        action: `tool_executed:${call.tool}`,
        reason: `${call.tool} in proof workspace: ${detail}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: "PASS",
        capability,
      });
      return { tool: call.tool, capability, decision: "ALLOW", executed: true, detail };
    } catch (err) {
      return {
        tool: call.tool,
        capability,
        decision: "ALLOW",
        executed: false,
        detail: `execution error: ${String(err)}`,
      };
    }
  }

  private async executeWorkspaceTool(call: RequestedToolCall, ws: ProofWorkspace): Promise<string> {
    const a = call.args ?? {};
    switch (call.tool) {
      case "workspace.read":
        return `read ${String(a.path)} (${ws.read(String(a.path)).length} bytes)`;
      case "workspace.list":
        return `listed ${ws.list().length} files`;
      case "workspace.write": {
        const path = String(a.path);
        const content = typeof a.content === "string" ? a.content : "";
        if (looksLikeSecret(content)) throw new Error("refused: content looks like a secret");
        ws.write(path, content);
        return `wrote ${path} (${content.length} bytes)`;
      }
      case "workspace.patch": {
        const path = String(a.path);
        ws.patch(path, String(a.find ?? ""), String(a.replace ?? ""));
        return `patched ${path}`;
      }
      case "workspace.exec": {
        const res = await ws.exec(String(a.command ?? ""));
        return `exec '${res.command}' -> ${res.allowed ? `exit ${res.exitCode}` : `BLOCKED (${res.blockReason})`}`;
      }
      default:
        throw new Error(`unhandled tool ${call.tool}`);
    }
  }

  private deterministicSecurityChecks(ws: ProofWorkspace): { check: string; result: string; detail: string }[] {
    const diff = ws.diff();
    const checks: { check: string; result: string; detail: string }[] = [];

    checks.push({
      check: "no-secret-in-diff",
      result: looksLikeSecret(diff) ? "FAIL" : "PASS",
      detail: looksLikeSecret(diff) ? "secret-like material detected in the change" : "no secret material in the change",
    });

    const addedDeps = /^\+.*"dependencies"|^\+\s*"[^"]+":\s*"\^?\d/m.test(diff);
    checks.push({
      check: "no-new-runtime-dependency",
      result: addedDeps ? "FAIL" : "PASS",
      detail: addedDeps ? "the change adds a runtime dependency (review required)" : "no new runtime dependency",
    });

    const dangerous = /^\+.*(child_process|eval\(|new Function\(|vm\.runIn)/m.test(diff);
    checks.push({
      check: "no-dangerous-api-introduced",
      result: dangerous ? "FAIL" : "PASS",
      detail: dangerous ? "change introduces child_process/eval/vm" : "no dangerous dynamic-execution API introduced",
    });

    return checks;
  }

  private finalize(
    agent: AgentDefinition,
    step: WorkflowStep,
    task: Task,
    run: WorkflowRun,
    usage: AgentExecutionResult["usage"],
    authored: ModelAuthoredResult,
  ): AgentExecutionResult {
    return {
      executionId: newId("exec"),
      agentId: agent.id,
      role: agent.title,
      taskId: task.id,
      workflowId: run.workflow_id,
      stage: step.id,
      status: authored.status,
      summary: authored.summary,
      reasoningSummary: authored.reasoningSummary,
      artifacts: authored.artifacts,
      recommendations: authored.recommendations,
      requestedToolCalls: authored.requestedToolCalls,
      handoff: authored.handoff,
      qualityEvidence: authored.qualityEvidence,
      risks: authored.risks,
      errors: authored.errors,
      usage,
    };
  }
}

function safeIncludes(ws: ProofWorkspace, path: string, needle: string): boolean {
  try {
    return ws.read(path).includes(needle);
  } catch {
    return false;
  }
}

/**
 * Parse `node --test` summary lines for pass/fail counts. Node's reporter has used
 * both `# pass 1` (TAP) and `ℹ pass 1` (spec) formats across versions.
 */
export function parseNodeTestCounts(output: string): { pass: number; fail: number } {
  const pass = Number(
    output.match(/(?:#|ℹ)\s*pass\s+(\d+)/)?.[1] ??
      output.match(/(\d+)\s+passing/)?.[1] ??
      0,
  );
  const fail = Number(
    output.match(/(?:#|ℹ)\s*fail\s+(\d+)/)?.[1] ??
      output.match(/(\d+)\s+failing/)?.[1] ??
      0,
  );
  return { pass: Number.isFinite(pass) ? pass : 0, fail: Number.isFinite(fail) ? fail : 0 };
}
