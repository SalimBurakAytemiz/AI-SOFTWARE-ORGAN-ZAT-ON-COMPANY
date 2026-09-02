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
import type { GenerateRequest, GenerateResult, ModelProvider } from "../models/provider.ts";
import type { ModelTier } from "../core/types.ts";
import type { Clock } from "../core/clock.ts";
import { systemClock } from "../core/clock.ts";
import { RateLimitError, RateLimitExhaustedError } from "../core/errors.ts";
import {
  RateLimitScheduler,
  realSleep,
  type RateLimitSchedulerConfig,
  type WaitEvent,
} from "../models/rate-limit-scheduler.ts";
import { rateLimitSummary, rateLimitTelemetry, type RateLimitSnapshot } from "../models/rate-limit.ts";
import { ModelRouter } from "../models/router.ts";
import { assembleAgentPrompt } from "./prompt-assembler.ts";
import {
  parseModelResult,
  MODEL_AUTHORED_RESULT_JSON_SCHEMA,
  MODEL_AUTHORED_RESULT_SCHEMA_NAME,
  type AgentExecutionResult,
  type ModelAuthoredResult,
  type RequestedToolCall,
} from "./agent-execution-result.ts";
import type { ProofWorkspace, ProjectFacts } from "../proof/proof-workspace.ts";
import type { RequestBudget } from "../proof/request-budget.ts";
import { newId } from "../core/ids.ts";
import { looksLikeSecret } from "../core/redaction.ts";
import {
  parseNodeTestCounts,
  deterministicSecurityChecks,
  decideImplementationOutcome,
} from "./implementation-gates.ts";

/**
 * Real, model-backed agent execution behind the existing AgentRunner concept
 * (build spec sections 8, 9, 11, 19, 20, 22, 23, 29).
 *
 * MODEL -> requests capability -> Capability Gateway -> Policy Engine ->
 * ALLOW/DENY/APPROVAL_REQUIRED -> Tool Executor. Model text is never concatenated
 * into a shell. The structured result is parsed and validated; a malformed result
 * is retried within the request budget and then BLOCKS the stage.
 */

/**
 * Output-token budget for a real model-backed agent stage (build spec section 29).
 *
 * The structured `AgentExecutionResult` JSON is not tiny - it carries a summary,
 * a reasoning summary, artifacts and evidence - and verbose free models add
 * padding. The original 1800-token cap truncated the JSON before it closed,
 * producing an unbalanced object that can never validate. 6000 is a sensible
 * production-minded default; a stage may raise it via `StagePlan.maxOutputTokens`
 * and a truncation retry may raise it once more, but never past the ceiling -
 * the budget is bounded, never unlimited.
 */
export const DEFAULT_AGENT_MAX_OUTPUT_TOKENS = 6000;
export const MIN_AGENT_MAX_OUTPUT_TOKENS = 1024;
/** Absolute upper bound; a run may configure a lower ceiling but never a higher one. */
export const AGENT_MAX_OUTPUT_TOKENS_CEILING = 12000;
/** Rough char->token ratio for pre-call quota estimation (never billed on it). */
const CHARS_PER_TOKEN = 4;

/** Provider stop-reason values (any casing) that mean "hit the output-token cap". */
const LENGTH_FINISH_REASONS = new Set(["length", "max_tokens", "max_output_tokens", "output_limit"]);

/** How a failed structured-output attempt is classified. */
type StructuredFailureKind = "MALFORMED" | "OUTPUT_TRUNCATED";

/**
 * Exported for direct unit testing of the bounded (never-unlimited) clamp.
 * `ceiling` defaults to the module maximum; a run may pass a lower configured
 * ceiling but the value can never exceed `AGENT_MAX_OUTPUT_TOKENS_CEILING`.
 */
export function clampMaxOutputTokens(
  n: number | undefined,
  fallback: number,
  ceiling: number = AGENT_MAX_OUTPUT_TOKENS_CEILING,
): number {
  const hardCeiling = Math.min(AGENT_MAX_OUTPUT_TOKENS_CEILING, Math.max(MIN_AGENT_MAX_OUTPUT_TOKENS, Math.floor(ceiling)));
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.min(hardCeiling, Math.max(MIN_AGENT_MAX_OUTPUT_TOKENS, v));
}

/**
 * A failed parse is truncation (rather than a malformed model) when the provider
 * says so via `finish_reason`, or when the completion used the entire output-token
 * budget. Parsing has already failed at every call site of this function.
 */
function isLikelyTruncated(
  result: { finish_reason?: string | null; usage: { output_tokens: number | null }; max_output_tokens?: number },
  requestedMax: number,
): boolean {
  const fr = (result.finish_reason ?? "").toLowerCase();
  if (LENGTH_FINISH_REASONS.has(fr)) return true;
  const out = result.usage.output_tokens;
  const cap = result.max_output_tokens ?? requestedMax;
  return typeof out === "number" && cap > 0 && out >= cap;
}

/**
 * Acceptance-critical, stage-shaped directives derived from the StagePlan and
 * handed to the model. They close the two gaps seen with a small free model on
 * the implementation stage: (1) it wrote code into `artifacts` (which are
 * documentation only and are NOT applied to the repo) instead of issuing
 * `workspace.write` tool calls, and (2) it put the test where `node --test`
 * could not discover it. The post-hoc gates (`requireWorkspaceChange`,
 * `runTests`) still enforce this regardless of the prompt.
 */
function stageDirectives(plan: StagePlan): string[] {
  const d: string[] = [];
  const canWrite =
    plan.allowedRuntimeTools.includes("workspace.write") || plan.allowedRuntimeTools.includes("workspace.patch");
  if (canWrite && plan.requireWorkspaceChange) {
    d.push(
      "This is a CODE stage. The `project_facts` block is AUTHORITATIVE - it is computed from the " +
        "actual workspace. If an earlier stage's artifact named a different framework, language, " +
        "module system or test runner, IGNORE that artifact and follow `project_facts`.",
    );
    d.push(
      "FIRST, in `reasoningSummary`, state the four facts you will rely on: (1) the module system, " +
        "(2) the exact test command, (3) the file and exported symbol you will change, (4) the exact " +
        "path of the test file you will add and why the test runner will discover it.",
    );
    d.push(
      "Deliver EVERY code and test change as `fileChanges` entries - each a COMPLETE file with " +
        "`operation` create or modify. Do NOT put code in `artifacts` (documentation only, never " +
        "written) and do NOT put code in `requestedToolCalls` `args_json`. A code stage with no " +
        "`fileChanges` FAILS.",
    );
    d.push(
      "Make the SMALLEST change that satisfies the task: add one branch to the existing entrypoint " +
        "handler shown in `project_facts` / `proof_workspace_files`. Do NOT add a web framework, a " +
        "dependency, a new server, or a new test framework.",
    );
  }
  if (canWrite && plan.runTests) {
    d.push(
      "Add exactly one automated test file at the path `project_facts` recommends. It MUST: import " +
        "the real entrypoint from `project_facts.serverEntrypoint`, call the exported handler " +
        "directly with a minimal fake req/res object (do NOT bind a socket or a port), and assert " +
        "both the HTTP status and the JSON body.",
    );
    d.push(
      "Every file you write must be valid in the project's module system. For ESM use ONLY `import` " +
        "/ `export` - never `require(...)`, `module.exports` or `__dirname`. The runtime runs the " +
        "project's own test command after this stage; you do not need a tool call to run it.",
    );
    d.push(
      'Only report status "PASS" if you are confident the change is complete and the new test will ' +
        'pass under the real test command. Otherwise report "BLOCKED" and explain in `errors`.',
    );
  }
  if (!canWrite && plan.runTests) {
    if (plan.allowedRuntimeTools.includes("workspace.exec")) {
      d.push("Run the test script via workspace.exec and report the real result; do not assert a pass you did not see.");
    } else {
      // The runtime runs the project's own test command itself after this stage
      // and gates on the real exit code + pass/fail counts. The model must NOT
      // emit a tool call here: a tool-native model (Groq gpt-oss) that produces a
      // native function call while the request carries no `tools` array is
      // rejected by the provider with HTTP 400 `tool_use_failed`
      // ("Tool choice is none, but model called a tool"). This stage only needs
      // an assessment, and the workspace diff is already in context.
      d.push(
        "The runtime runs the project's own test command after this stage and records the real exit " +
          "code and pass/fail counts as the gate. Do NOT run commands and do NOT emit a tool call. " +
          "Base your assessment on the workspace diff, the prior-stage specs and the acceptance " +
          "criteria, and report honestly - never claim a pass you did not verify.",
      );
    }
  }
  if (plan.runSecurityScan) {
    d.push("A deterministic security scan runs after this stage; call out any risk you see in `risks`.");
  }
  if (plan.requireInSource) {
    d.push(`The delivered source must contain \`${plan.requireInSource}\`.`);
  }
  if (plan.restrictStatusTo) {
    d.push(`Final status MUST be one of: ${plan.restrictStatusTo.join(", ")}.`);
  }
  return d;
}

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
  /**
   * Include the deterministic `projectFacts()` digest (module system, test
   * command + discovery rule, entrypoint, existing tests) as AUTHORITATIVE
   * context so the model never guesses the stack. Default on for a code stage.
   */
  includeProjectFacts?: boolean;
  /** Include the unified workspace diff in context. */
  includeWorkspaceDiff: boolean;
  /** The runner runs `npm test` itself and attaches machine evidence. */
  runTests: boolean;
  /** The runner runs deterministic security checks itself. */
  runSecurityScan: boolean;
  /** After the stage, require the workspace to actually contain changes. */
  requireWorkspaceChange: boolean;
  /**
   * After a code stage, require at least one changed file under a test path
   * (a `test/` dir or a `*.test.*` / `*-test.*` name). Acceptance needs an
   * automated test to accompany the change; this BLOCKS with a precise reason
   * before the generic "no diff" check.
   */
  requireTestChange?: boolean;
  /** After the stage, require this string to appear in the workspace source. */
  requireInSource?: string;
  /** Constrain the final status vocabulary (release manager). */
  restrictStatusTo?: ("READY_FOR_HUMAN_APPROVAL" | "BLOCKED")[];
  /**
   * If the runner's own `npm test` fails on the first pass, give the agent ONE
   * bounded repair pass: the failing test output is fed back and the agent may
   * issue more workspace tool calls, then tests run again. Real engineers
   * iterate on a red test; a single-shot expectation is unrealistic. Still
   * bounded - one repair, and it consumes one slot of the real-request budget
   * (which BLOCKS at its ceiling). Only meaningful for a stage that can write.
   */
  repairTestsOnce?: boolean;
  /**
   * Per-stage override of the model output-token budget. Clamped to
   * [MIN_AGENT_MAX_OUTPUT_TOKENS, configured ceiling]. Omit to use the runner
   * default (DEFAULT_AGENT_MAX_OUTPUT_TOKENS).
   */
  maxOutputTokens?: number;
  /**
   * Per-stage reasoning effort for models that support it. Omit to use the
   * runner default (low). Kept conservative so free-tier token budget is not
   * spent on reasoning the simple proof does not need.
   */
  reasoningEffort?: "low" | "medium" | "high";
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
  /** Model/parse status: the model's own PASS|FAIL|BLOCKED, or MALFORMED / OUTPUT_TRUNCATED. */
  modelStatus: string;
  enforcementNotes: string[];
  /** Rate-limit waits performed during this stage (credential-free), if any. */
  rateLimitWaits: { kind: string; cycle: number; waitMs: number; reason: string }[];
}

/** Default: at most one retry per stage (truncation OR malformed), then BLOCK. */
const DEFAULT_MAX_STRUCTURED_RETRIES = 1;

export interface RealAgentRunnerOptions {
  /**
   * How many classified structured-output retries a stage gets before it BLOCKs
   * (default 1). Set to 0 for a bounded premium run where the authorization is
   * "one primary attempt + one targeted test-repair only".
   */
  maxStructuredRetries?: number;
  /** Runner default output-token budget (a StagePlan can still override per stage). */
  maxOutputTokens?: number;
  /** Configured global safety ceiling (<= AGENT_MAX_OUTPUT_TOKENS_CEILING). */
  maxOutputTokensCeiling?: number;
  /** Runner default reasoning effort (a StagePlan can override per stage). */
  reasoningEffort?: "low" | "medium" | "high";
  /**
   * Send the AgentExecutionResult JSON Schema as `response_format` (defence in
   * depth; parsing/validation still runs). Default true - the provider only
   * honours it when it advertises the capability.
   */
  nativeStructuredOutput?: boolean;
  /** Rate-limit scheduler configuration (pacing, 429 cycles, fallback metadata). */
  rateLimit?: RateLimitSchedulerConfig;
  /** Founder-friendly wait notifications (e.g. WAITING_FOR_PROVIDER_QUOTA lines). */
  onRateLimitWait?: (e: WaitEvent & { stage: string; agentRole: string }) => void;
  /** Injected clock (deterministic tests). Defaults to systemClock. */
  clock?: Clock;
  /** Injected sleep (deterministic tests). Defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export class RealAgentRunner {
  private readonly reg: Registries;
  private readonly provider: ModelProvider;
  private readonly providerLabel: string;
  private readonly gateway: CapabilityGateway;
  private readonly cost: CostAccounting;
  private readonly obs: Observability;
  private readonly audit: AuditLog;
  private readonly defaultMaxOutputTokens: number;
  private readonly ceiling: number;
  private readonly defaultReasoningEffort: "low" | "medium" | "high";
  private readonly nativeStructuredOutput: boolean;
  private readonly maxStructuredRetries: number;
  private readonly scheduler: RateLimitScheduler;
  private readonly onRateLimitWait?: RealAgentRunnerOptions["onRateLimitWait"];

  constructor(
    reg: Registries,
    provider: ModelProvider,
    providerLabel: string,
    gateway: CapabilityGateway,
    cost: CostAccounting,
    obs: Observability,
    audit: AuditLog,
    opts: RealAgentRunnerOptions = {},
  ) {
    this.reg = reg;
    this.provider = provider;
    this.providerLabel = providerLabel;
    this.gateway = gateway;
    this.cost = cost;
    this.obs = obs;
    this.audit = audit;
    this.ceiling = clampMaxOutputTokens(
      opts.maxOutputTokensCeiling,
      AGENT_MAX_OUTPUT_TOKENS_CEILING,
      AGENT_MAX_OUTPUT_TOKENS_CEILING,
    );
    this.defaultMaxOutputTokens = clampMaxOutputTokens(
      opts.maxOutputTokens,
      DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
      this.ceiling,
    );
    this.defaultReasoningEffort = opts.reasoningEffort ?? "low";
    this.nativeStructuredOutput = opts.nativeStructuredOutput ?? true;
    this.maxStructuredRetries = Math.max(
      0,
      Math.floor(opts.maxStructuredRetries ?? DEFAULT_MAX_STRUCTURED_RETRIES),
    );
    this.onRateLimitWait = opts.onRateLimitWait;
    this.scheduler = new RateLimitScheduler(
      opts.clock ?? systemClock,
      opts.sleep ?? realSleep,
      opts.rateLimit ?? {},
    );
  }

  /** Latest provider rate-limit snapshot the runner has observed (credential-free). */
  rateLimitSnapshot(): RateLimitSnapshot | null {
    return this.scheduler.lastSnapshot();
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

    const canWriteStage =
      plan.allowedRuntimeTools.includes("workspace.write") || plan.allowedRuntimeTools.includes("workspace.patch");
    // A code stage always gets the deterministic project facts (unless a plan
    // explicitly opts out); an analysis stage only if it asked.
    const wantProjectFacts = plan.includeProjectFacts ?? canWriteStage;

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
      projectFacts: wantProjectFacts ? safeProjectFacts(workspace) : undefined,
      stageDirectives: stageDirectives(plan),
      contextBudgetBytes: input.contextBudgetBytes,
    });

    // --- model call with ONE bounded, classified structured-output retry ----
    // A failed parse is classified: OUTPUT_TRUNCATED (the model hit the token
    // cap - raise the budget once and demand compact JSON) or MALFORMED
    // (re-state the contract). After the single retry the stage BLOCKS - the
    // runtime never guesses and never accepts malformed JSON.
    let parsed: ModelAuthoredResult | null = null;
    let attempts = 0;
    let lastProblems: string[] = [];
    let lastFailureKind: StructuredFailureKind = "MALFORMED";
    const rateLimitWaits: (WaitEvent & { stage: string; agentRole: string })[] = [];
    const baseMaxOutputTokens = clampMaxOutputTokens(
      plan.maxOutputTokens,
      this.defaultMaxOutputTokens,
      this.ceiling,
    );
    const reasoningEffort = plan.reasoningEffort ?? this.defaultReasoningEffort;
    const responseSchema = this.nativeStructuredOutput
      ? { name: MODEL_AUTHORED_RESULT_SCHEMA_NAME, schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true }
      : undefined;
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

    for (let i = 0; i <= this.maxStructuredRetries; i++) {
      budget.reserve(1); // throws BudgetExceededError at the ceiling
      attempts++;

      // On a truncation retry only, raise the output-token budget once (bounded
      // by the ceiling). A malformed retry keeps the same budget.
      const retryAfterTruncation: boolean = i > 0 && lastFailureKind === "OUTPUT_TRUNCATED";
      const attemptMaxOutputTokens: number = retryAfterTruncation
        ? clampMaxOutputTokens(baseMaxOutputTokens * 2, baseMaxOutputTokens)
        : baseMaxOutputTokens;

      const modelSpan = this.obs.startSpan(`model:${tier}`, "model_call", { agent: agent.id, tier });
      const prompt =
        i === 0
          ? assembled.prompt
          : retryAfterTruncation
            ? `${assembled.prompt}\n\n## retry - your previous response was TRUNCATED before the JSON object closed\n` +
              `Return ONLY one single-line minified JSON object: no markdown fences, no pretty-printing, no prose ` +
              `before or after. Keep EVERY required field of the contract. Keep values short - "summary" and ` +
              `"reasoningSummary" under 300 characters each, and each artifact "content" under ~1200 characters ` +
              `(a concise report, not an essay). Rejected because: ${lastProblems.join("; ")}.`
            : `${assembled.prompt}\n\n## retry\nYour previous response was rejected: ${lastProblems.join("; ")}. ` +
              `Return ONLY one valid JSON object that matches the contract - no prose, no markdown fence.`;
      const genReq: GenerateRequest = {
        tier,
        system: assembled.system,
        prompt,
        seed: 42,
        maxOutputTokens: attemptMaxOutputTokens,
        reasoningEffort,
        ...(responseSchema ? { responseSchema } : {}),
      };
      const estTokens =
        Math.ceil((assembled.system.length + prompt.length) / CHARS_PER_TOKEN) + attemptMaxOutputTokens;
      const result = await this.callModelWithRateLimit(genReq, estTokens, {
        agent,
        step,
        task,
        run,
        onWait: (e) => rateLimitWaits.push(e),
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
      const rlSnap = result.rate_limit ?? this.scheduler.lastSnapshot();
      modelSpan.setAttribute("model", result.model);
      modelSpan.setAttribute("request_number", budget.count);
      modelSpan.setAttribute("finish_reason", result.finish_reason ?? "unknown");
      modelSpan.setAttribute("max_output_tokens", attemptMaxOutputTokens);
      modelSpan.setAttribute("structured_output", Boolean(result.structured_output));
      modelSpan.setAttribute("structured_output_mode", result.structured_output_mode ?? "none");
      modelSpan.setAttribute("reasoning_effort", reasoningEffort);
      for (const [k, v] of Object.entries(rateLimitTelemetry(rlSnap))) {
        modelSpan.setAttribute(`ratelimit.${k}`, v);
      }
      modelSpan.end("OK");

      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `${result.provider}:${result.model}`,
        action: `real_model_call:${step.id}`,
        reason:
          `real request #${budget.count} for stage '${step.id}' (${this.providerLabel}); ` +
          `tier ${tier}; ${routeReason}; reasoning_effort=${reasoningEffort}; ` +
          `structured_output=${Boolean(result.structured_output)}; ` +
          `structured_output_mode=${result.structured_output_mode ?? "none"}; ` +
          `finish_reason=${result.finish_reason ?? "unknown"}; ` +
          `output_tokens=${result.usage.output_tokens ?? "?"}/${attemptMaxOutputTokens}; ` +
          `rate_limit: ${rateLimitSummary(rlSnap)}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: "PASS",
        duration: result.duration_ms,
        estimated_cost: result.estimated_cost_usd,
        output_reference: `run:${run.id}:${step.id}:attempt${attempts}`,
      });

      // Safe structured-output self-heal: the provider advertised JSON-Schema
      // support but rejected THIS schema with HTTP 400, so the client fell back
      // to `response_format: json_object` for the rest of the run. Record the
      // classified event (credential-free); parsing/validation below is unchanged.
      if (result.schema_rejection) {
        this.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          model: `${result.provider}:${result.model}`,
          action: `structured_schema_rejected:${step.id}`,
          reason:
            `provider returned HTTP 400 on the ${MODEL_AUTHORED_RESULT_SCHEMA_NAME} JSON Schema ` +
            `(${result.schema_rejection.reason}); fell back to ` +
            `response_format=${result.schema_rejection.fellBackTo} for this run; ` +
            `the response is still parsed and validated against the full contract`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: "PENDING",
        });
      }

      const outcome = parseModelResult(result.text);
      if (outcome.ok && outcome.value) {
        parsed = outcome.value;
        break;
      }
      lastProblems = outcome.problems;
      lastFailureKind = isLikelyTruncated(result, attemptMaxOutputTokens) ? "OUTPUT_TRUNCATED" : "MALFORMED";
      const isLastAttempt = i >= this.maxStructuredRetries;
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `${result.provider}:${result.model}`,
        action:
          lastFailureKind === "OUTPUT_TRUNCATED"
            ? `output_truncated:${step.id}`
            : `malformed_agent_result:${step.id}`,
        reason:
          lastFailureKind === "OUTPUT_TRUNCATED"
            ? `structured output truncated at the token limit (attempt ${attempts}, ` +
              `finish_reason=${result.finish_reason ?? "unknown"}, ` +
              `output_tokens=${result.usage.output_tokens ?? "?"}/${attemptMaxOutputTokens}): ` +
              `${outcome.problems.join("; ")}`
            : `structured output invalid (attempt ${attempts}): ${outcome.problems.join("; ")}`,
        risk_level: (step.risk_level ?? task.risk) as RiskLevel,
        result: isLastAttempt ? "BLOCKED" : "PENDING",
      });
    }

    if (!parsed) {
      // Malformed / truncated after the bounded retry -> BLOCK. Never guess.
      span.end("ERROR");
      const wasTruncated = lastFailureKind === "OUTPUT_TRUNCATED";
      const execution = this.finalize(agent, step, task, run, usage, {
        status: "BLOCKED",
        summary: wasTruncated
          ? "model output was truncated at the token limit before the structured result completed (after one bounded retry)"
          : "structured output validation failed after retries",
        reasoningSummary: wasTruncated
          ? "the model did not return a complete AgentExecutionResult within the output-token budget"
          : "the model did not return a valid AgentExecutionResult",
        artifacts: [],
        fileChanges: [],
        recommendations: [],
        requestedToolCalls: [],
        handoff: null,
        qualityEvidence: [],
        risks: [
          wasTruncated
            ? "model cannot fit the required structured contract inside the output-token budget"
            : "model cannot produce the required structured contract",
        ],
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
        modelStatus: lastFailureKind,
        enforcementNotes: [
          wasTruncated
            ? "blocked: model output truncated before the JSON object completed (after bounded retry)"
            : "blocked: malformed structured output",
        ],
        rateLimitWaits: rateLimitWaits.map(summariseWait),
      };
    }

    // --- apply fileChanges (the first-class code-change channel) -----------
    // Each fileChange becomes a workspace.write routed through the SAME
    // Capability Gateway path and audit as an explicit tool call - it is not a
    // bypass. Only meaningful on a stage that may write; elsewhere it is denied
    // and recorded (defence in depth).
    const toolCalls: ToolCallOutcome[] = [];
    for (const fc of parsed.fileChanges) {
      toolCalls.push(
        await this.handleToolCall(
          { tool: "workspace.write", args: { path: fc.path, content: fc.content }, reason: `fileChanges: ${fc.operation} ${fc.path}` },
          agent, step, task, run, workspace, plan.allowedRuntimeTools,
        ),
      );
    }

    // --- adjudicate + execute requested tool calls -------------------------
    for (const call of parsed.requestedToolCalls) {
      toolCalls.push(
        await this.handleToolCall(call, agent, step, task, run, workspace, plan.allowedRuntimeTools),
      );
    }

    // --- runner-enforced machine evidence (never trust prose) -------------
    let testEvidence: RealStageOutcome["testEvidence"] = null;
    let testRepairsUsed = 0;
    const maxTestRepairs = plan.repairTestsOnce && plan.runTests && canWriteStage ? 1 : 0;
    if (plan.runTests) {
      for (;;) {
        const res = await workspace.exec("npm test");
        const counts = parseNodeTestCounts(res.stdout + "\n" + res.stderr);
        testEvidence = {
          command: "npm test",
          exitCode: res.exitCode,
          passed: counts.pass,
          failed: counts.fail,
          ran: res.allowed,
        };
        const green = res.exitCode === 0 && counts.fail === 0 && counts.pass > 0;
        this.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          action: `qa_test_execution:${step.id}${testRepairsUsed > 0 ? `:repair${testRepairsUsed}` : ""}`,
          reason: `npm test exit=${res.exitCode} pass=${counts.pass} fail=${counts.fail}`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: green ? "PASS" : "FAIL",
          capability: "shell.exec_sandbox",
          tool: "sandbox",
        });
        if (green || testRepairsUsed >= maxTestRepairs) break;

        // ONE bounded repair pass: feed the failure back, let the agent fix it
        // with more tool calls, then re-run. Consumes one real-request budget
        // slot (BLOCKS at the ceiling); structured validation is unchanged.
        testRepairsUsed++;
        budget.reserve(1);
        attempts++;
        const failOut = `${res.stdout}\n${res.stderr}`.replace(/\s+$/g, "").slice(-1600);
        const facts = safeProjectFacts(workspace);
        // Show the model the CURRENT text of the files it just wrote, so it can
        // fix them in place instead of redesigning from scratch.
        const touched = [...new Set(parsed.fileChanges.map((f) => f.path))].slice(0, 4);
        const currentFiles = touched
          .map((p) => {
            try {
              return `--- ${p} (current) ---\n${workspace.read(p).slice(0, 1800)}`;
            } catch {
              return `--- ${p} --- (not present - your write may have failed or targeted a bad path)`;
            }
          })
          .join("\n\n");
        const repairPrompt =
          `${assembled.prompt}\n\n## test_failure_repair (repair pass ${testRepairsUsed} of ${maxTestRepairs}) - DETERMINISTIC EVIDENCE\n` +
          `command: npm test  (${facts?.testCommand ?? "the project test command"})\n` +
          `exit code: ${res.exitCode}\n` +
          `result: ${counts.fail} failing / ${counts.pass} passing` +
          (counts.pass === 0 ? " - the test runner discovered NO tests (wrong path / wrong name / not created)\n" : "\n") +
          `module system: ${facts?.moduleType ?? "see project_facts"}; ` +
          `test discovery: ${facts?.testDiscoveryRule ?? "see project_facts"}\n` +
          `relevant output (tail):\n\`\`\`\n${failOut}\n\`\`\`\n` +
          (currentFiles ? `files you wrote:\n${currentFiles}\n\n` : "") +
          `Fix ONLY the failure demonstrated above. Do NOT redesign. Do NOT replace a file that is ` +
          `already correct. Return the COMPLETE fixed file(s) in \`fileChanges\` (operation "modify" ` +
          `for an existing file, "create" for a new one). If it cannot be fixed safely, return status ` +
          `"BLOCKED" and explain in "errors".`;
        const repairReq: GenerateRequest = {
          tier,
          system: assembled.system,
          prompt: repairPrompt,
          seed: 42,
          maxOutputTokens: baseMaxOutputTokens,
          reasoningEffort,
          ...(responseSchema ? { responseSchema } : {}),
        };
        const est =
          Math.ceil((assembled.system.length + repairPrompt.length) / CHARS_PER_TOKEN) + baseMaxOutputTokens;
        const rr = await this.callModelWithRateLimit(repairReq, est, {
          agent,
          step,
          task,
          run,
          onWait: (e) => rateLimitWaits.push(e),
        });
        this.cost.record({
          task_id: task.id,
          run_id: run.id,
          agent_id: agent.id,
          workflow_id: run.workflow_id,
          provider: rr.provider,
          model: rr.model,
          input_tokens: rr.usage.input_tokens,
          output_tokens: rr.usage.output_tokens,
          estimated_cost_usd: rr.estimated_cost_usd,
          duration_ms: rr.duration_ms,
        });
        usage = {
          provider: rr.provider,
          model: rr.model,
          real: rr.provider !== "mock",
          input_tokens: rr.usage.input_tokens,
          output_tokens: rr.usage.output_tokens,
          estimated_cost_usd: rr.estimated_cost_usd,
          duration_ms: rr.duration_ms,
          request_number: budget.count,
        };
        const rp = parseModelResult(rr.text);
        this.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          model: `${rr.provider}:${rr.model}`,
          action: `real_model_call:${step.id}:test_repair${testRepairsUsed}`,
          reason:
            `real request #${budget.count}: test-failure repair pass ${testRepairsUsed} for stage '${step.id}'; ` +
            `previous npm test exit=${res.exitCode} fail=${counts.fail}; parsed=${rp.ok}`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: rp.ok ? "PASS" : "BLOCKED",
          duration: rr.duration_ms,
          estimated_cost: rr.estimated_cost_usd,
        });
        if (!rp.ok || !rp.value) {
          enforcementNotes.push(`test-repair pass ${testRepairsUsed}: model result invalid; keeping the failing test evidence`);
          break;
        }
        parsed = rp.value;
        for (const fc of rp.value.fileChanges) {
          toolCalls.push(
            await this.handleToolCall(
              { tool: "workspace.write", args: { path: fc.path, content: fc.content }, reason: `test-repair fileChanges: ${fc.operation} ${fc.path}` },
              agent, step, task, run, workspace, plan.allowedRuntimeTools,
            ),
          );
        }
        for (const call of rp.value.requestedToolCalls) {
          toolCalls.push(
            await this.handleToolCall(call, agent, step, task, run, workspace, plan.allowedRuntimeTools),
          );
        }
      }
    }

    let securityEvidence: RealStageOutcome["securityEvidence"] = null;
    if (plan.runSecurityScan) {
      securityEvidence = { checks: deterministicSecurityChecks(workspace) };
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

    // --- decide the enforced outcome (shared with the Codex CLI harness) ---
    // Files actually written by this stage (fileChanges + write/patch tool calls
    // the gateway ALLOWED and the executor ran) are the ground truth - never the
    // model's prose. `decideImplementationOutcome` is the single source of truth
    // for the gate cascade; the Codex premium path calls the same function.
    const writtenPaths = toolCalls
      .filter((t) => (t.tool === "workspace.write" || t.tool === "workspace.patch") && t.executed)
      .map((t) => t.detail.match(/(?:wrote|patched)\s+(\S+)/)?.[1])
      .filter((p): p is string => Boolean(p));

    let sourceContainsRequired: boolean | null = null;
    if (plan.requireInSource) {
      sourceContainsRequired = workspace
        .list()
        .some((p) => /\.(js|ts)$/.test(p) && safeIncludes(workspace, p, plan.requireInSource!));
    }

    const decision = decideImplementationOutcome({
      changedFiles: canWriteStage ? writtenPaths : [],
      hadChangeAttempt: parsed.fileChanges.length > 0 || writtenPaths.length > 0,
      workspaceHasChanges: workspace.hasChanges(),
      sourceContainsRequired,
      testEvidence,
      securityChecks: securityEvidence?.checks ?? null,
      plan: {
        requireWorkspaceChange: canWriteStage && plan.requireWorkspaceChange,
        requireTestChange: plan.requireTestChange,
        requireInSource: plan.requireInSource,
        restrictStatusTo: plan.restrictStatusTo,
      },
      baseStatus: parsed.status,
    });
    const outcome = decision.outcome;
    enforcementNotes.push(...decision.enforcementNotes);

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
      rateLimitWaits: rateLimitWaits.map(summariseWait),
    };
  }

  // ----------------------------------------------------------------------

  /**
   * One real model call, wrapped in the rate-limit scheduler:
   *   - pre-call pacing / quota wait,
   *   - on 429: parse the reset window, wait it out (bounded, jittered), retry
   *     the SAME call - never a burst of retries inside one exhausted window,
   *   - after `maxRetryCycles` failed cycles: throw RateLimitExhaustedError so
   *     the stage BLOCKs cleanly with the workflow checkpoint preserved.
   * The request budget is charged by the caller ONCE per structured attempt; the
   * 429 cycles here do not each consume it.
   */
  private async callModelWithRateLimit(
    req: GenerateRequest,
    estTokens: number,
    ctx: {
      agent: AgentDefinition;
      step: WorkflowStep;
      task: Task;
      run: WorkflowRun;
      onWait: (e: WaitEvent & { stage: string; agentRole: string }) => void;
    },
  ): Promise<GenerateResult> {
    const { agent, step, task, run } = ctx;
    const riskLevel = (step.risk_level ?? task.risk) as RiskLevel;

    const emitWait = (e: WaitEvent) => {
      const decorated = { ...e, stage: step.id, agentRole: agent.title };
      ctx.onWait(decorated);
      this.onRateLimitWait?.(decorated);
      this.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        action: `rate_limit_wait:${step.id}`,
        reason:
          `WAITING_FOR_PROVIDER_QUOTA (${e.kind}, cycle ${e.cycle}): ${e.reason}; ` +
          `resume in approximately ${Math.max(1, Math.round(e.waitMs / 1000))}s; ` +
          `snapshot: ${rateLimitSummary(e.snapshot)}`,
        risk_level: riskLevel,
        result: "PENDING",
      });
      const span = this.obs.startSpan(`rate-limit-wait:${step.id}`, "model_call", {
        agent: agent.id,
        kind: e.kind,
        cycle: e.cycle,
        wait_ms: e.waitMs,
        ...Object.fromEntries(
          Object.entries(rateLimitTelemetry(e.snapshot)).map(([k, v]) => [`ratelimit.${k}`, v]),
        ),
      });
      span.end("OK");
    };

    for (let cycle = 0; ; cycle++) {
      const paced = await this.scheduler.pace(estTokens);
      if (paced) emitWait(paced);

      try {
        const result = await this.provider.generate(req);
        this.scheduler.observe(
          result.rate_limit ??
            (this.provider as { rateLimit?: () => RateLimitSnapshot | null }).rateLimit?.() ??
            null,
        );
        this.scheduler.markCallDone();
        return result;
      } catch (err) {
        this.scheduler.markCallDone();
        if (!(err instanceof RateLimitError)) throw err;
        this.scheduler.observe(err.rateLimit);
        const wait = await this.scheduler.waitForRetry(err.rateLimit, cycle);
        if (!wait) {
          throw new RateLimitExhaustedError(
            `${this.provider.name}: ${cycle + 1} rate-limit retry cycle(s) exhausted for stage '${step.id}' ` +
              `(${rateLimitSummary(err.rateLimit)}); workflow checkpoint preserved`,
            err.rateLimit,
          );
        }
        emitWait(wait);
        // loop -> retry the SAME request after the reset window.
      }
    }
  }

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
      fileChanges: authored.fileChanges,
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

/** projectFacts() defensively - a workspace analysis failure must never abort a stage. */
function safeProjectFacts(workspace: ProofWorkspace): ProjectFacts | undefined {
  try {
    return workspace.projectFacts();
  } catch {
    return undefined;
  }
}

function summariseWait(
  e: WaitEvent & { stage: string; agentRole: string },
): { kind: string; cycle: number; waitMs: number; reason: string } {
  return { kind: e.kind, cycle: e.cycle, waitMs: e.waitMs, reason: e.reason };
}

function safeIncludes(ws: ProofWorkspace, path: string, needle: string): boolean {
  try {
    return ws.read(path).includes(needle);
  } catch {
    return false;
  }
}

/** Re-exported for callers that import it from here (moved to implementation-gates). */
export { parseNodeTestCounts };
