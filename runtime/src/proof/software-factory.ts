import { join } from "node:path";
import type { Runtime } from "../runtime.ts";
import type { ModelProvider } from "../models/provider.ts";
import type { RiskLevel, WorkflowStep, Task, WorkflowRun, AgentDefinition } from "../core/types.ts";
import { RuntimeError } from "../core/errors.ts";
import { redactString } from "../core/redaction.ts";
import { newId } from "../core/ids.ts";
import { MockModelProvider } from "../models/mock-provider.ts";
import { RUNTIME_ROOT, paths } from "../config/paths.ts";
import { RealAgentRunner, type RealStageOutcome, type StagePlan } from "../agents/real-agent-runner.ts";
import { ProofWorkspace } from "./proof-workspace.ts";
import { ProofArtifactStore } from "./artifact-store.ts";
import { RequestBudget, type BudgetSnapshot } from "./request-budget.ts";
import { classifyProofSensitivity, type SensitivityVerdict } from "./proof-sensitivity.ts";
import type { RealProviderDescriptor, PremiumImplProviderStatus } from "../models/real-provider.ts";
import type { AgentExecutionResult } from "../agents/agent-execution-result.ts";
import { CodexCliHarness } from "../agents/codex-cli-harness.ts";
import { evaluateImplementationGates } from "../agents/implementation-gates.ts";

type PremiumImplDescriptor = NonNullable<PremiumImplProviderStatus["descriptor"]>;

/** Premium implementation escalation config passed into a REAL proof run. */
export interface PremiumImplOption {
  kind: "openai" | "codex-cli";
  /** kind === "openai": the paid HTTP API descriptor. */
  openaiDescriptor?: PremiumImplDescriptor;
  /** kind === "codex-cli": a pre-constructed harness (software-factory runs detect()). */
  codexHarness?: CodexCliHarness;
  codexLabel?: string;
  codexModel?: string;
}

const PROOF_TASK = {
  title: "Add a GET /health endpoint to the demo service",
  description:
    "Add a GET /health endpoint to the disposable demo service. It must return HTTP 200 " +
    "and a JSON body containing status: 'ok'. Add appropriate automated tests and short " +
    "documentation. Additive change only; do not modify unrelated behaviour.",
};

/** feature-development stages that make a real (model-backed) agent call. */
const REAL_STAGES = new Set([
  "spec_review",
  "business_analysis",
  "architecture",
  "plan",
  "implementation",
  "code_review",
  "qa",
  "security",
  "release_review",
]);

/**
 * Stage-aware output-token budgets (build spec sections 7, 14). The /health
 * proof is intentionally tiny, so compact outputs are preferred. These sit below
 * the global default (6000) and the configurable global ceiling; the runtime
 * still detects OUTPUT_TRUNCATED and raises the budget once on a truncation
 * retry. Reasoning effort is kept low except where a gate genuinely benefits.
 */
const PLANS: Record<string, StagePlan> = {
  // The /health proof is deliberately small, so reasoning_effort is "low"
  // everywhere - "medium" burned so much of the completion budget on
  // chain-of-thought that Groq's strict Structured Output truncated the JSON
  // mid-object and returned HTTP 400 `json_validate_failed` instead of a normal
  // finish_reason="length" 200. The floors below leave clear room for the JSON.
  spec_review: analysisPlan(2600, "low"),
  business_analysis: analysisPlan(2600, "low"),
  architecture: analysisPlan(3200, "low"),
  plan: analysisPlan(2800, "low"),
  implementation: {
    allowedRuntimeTools: ["workspace.read", "workspace.list", "workspace.write", "workspace.patch", "workspace.exec"],
    includeWorkspaceFiles: true,
    // Deterministic project facts (module system, test command + discovery rule,
    // entrypoint, exports) as AUTHORITATIVE context - the model does not guess
    // the stack, and is told to ignore any earlier stage that described it
    // differently (forensic finding 2026-09-02: architecture/plan invented
    // Express + Jest for a plain node:http + node:test fixture).
    includeProjectFacts: true,
    includeWorkspaceDiff: true,
    runTests: true,
    runSecurityScan: false,
    requireWorkspaceChange: true,
    // Acceptance needs an automated test to accompany the change - BLOCK with a
    // precise reason if none was written to a discoverable path.
    requireTestChange: true,
    requireInSource: "/health",
    // A failing first `npm test` earns ONE bounded repair pass (real engineers
    // iterate on a red test) - still inside the real-request budget ceiling.
    repairTestsOnce: true,
    // Implementation authors the largest structured result (inline artifact
    // bodies + workspace.write tool calls with escaped args_json). Give the JSON
    // more room and keep reasoning low so the completion budget is spent on a
    // schema-valid object, not on chain-of-thought - reduces Groq's HTTP 400
    // `json_validate_failed` on the strict schema. Still well under the ceiling
    // and the free-tier per-minute token window.
    maxOutputTokens: 3400,
    reasoningEffort: "low",
  },
  code_review: {
    allowedRuntimeTools: ["workspace.read", "workspace.list"],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: false,
    runSecurityScan: false,
    requireWorkspaceChange: false,
    maxOutputTokens: 2600,
    reasoningEffort: "low",
  },
  qa: {
    // No model-issued tools. The runtime runs `npm test` itself and gates on the
    // real exit code + counts (decideImplementationOutcome); the QA agent only
    // authors an assessment, and the change is already in context via
    // includeWorkspaceDiff. Offering workspace.exec here (and instructing the
    // model to use it) made the tool-native Groq gpt-oss model emit a native
    // function call while the provider request carried no `tools` array, which
    // Groq rejects with HTTP 400 `tool_use_failed`. (2026-09-02 provider-compat
    // fix - the QA gate itself is unchanged: it is the runner's own npm test.)
    allowedRuntimeTools: [],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: true,
    runSecurityScan: false,
    requireWorkspaceChange: false,
    maxOutputTokens: 2400,
    reasoningEffort: "low",
  },
  security: {
    // Same provider-compat reasoning as `qa`: the runtime runs the deterministic
    // security checks itself (deterministicSecurityChecks). The security agent
    // authors an assessment from the diff in context, not a tool call.
    allowedRuntimeTools: [],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: false,
    runSecurityScan: true,
    requireWorkspaceChange: false,
    maxOutputTokens: 2600,
    reasoningEffort: "low",
  },
  release_review: {
    ...analysisPlan(2400, "low"),
    restrictStatusTo: ["READY_FOR_HUMAN_APPROVAL", "BLOCKED"],
  },
};

function analysisPlan(maxOutputTokens: number, reasoningEffort: "low" | "medium" | "high"): StagePlan {
  return {
    allowedRuntimeTools: [],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: false,
    runTests: false,
    runSecurityScan: false,
    requireWorkspaceChange: false,
    maxOutputTokens,
    reasoningEffort,
  };
}

export interface SoftwareFactoryStageReport {
  stage: string;
  agentId: string;
  role: string;
  real: boolean;
  modelBacked: boolean;
  /** Which proof provider executed this stage (e.g. "groq", "nvidia", "mock"). */
  providerId?: string;
  outcome: "PASS" | "FAIL" | "BLOCKED";
  modelStatus?: string;
  attempts?: number;
  requests?: number;
  contextBytes?: number;
  truncated?: string[];
  toolCalls?: { tool: string; decision: string; executed: boolean; detail: string }[];
  testEvidence?: { command: string; exitCode: number; passed: number; failed: number } | null;
  securityEvidence?: { check: string; result: string; detail: string }[] | null;
  enforcement?: string[];
  artifacts: string[];
  summary?: string;
}

export interface SoftwareFactoryProofResult {
  ok: boolean;
  mode: "REAL" | "MOCK";
  blocked: boolean;
  blockReason: string | null;
  sensitivity: SensitivityVerdict;
  provider: {
    label: string;
    name: string;
    baseUrl: string | null;
    model: string | null;
    isProofProvider: boolean;
    sensitivity: string;
  } | null;
  realModelsUsed: string[];
  realRequestCount: number;
  budget: BudgetSnapshot | null;
  tokenUsage: { input_tokens: number | null; output_tokens: number | null };
  cost: { known_usd: number; unknown_calls: number; note: string };
  task_id: string | null;
  workflow_id: string | null;
  run_id: string | null;
  run_status: string | null;
  project_state: string | null;
  stopped_because: string;
  /**
   * Set when a real model/provider call (or the request-budget ceiling) aborted a
   * stage. The `detail` is redacted; a provider error message never contains the
   * API key (the key lives only in a local const during the fetch). Null on a
   * clean run.
   */
  providerError: { stage: string; code: string; detail: string } | null;
  /**
   * Free-first provider fallback transitions performed during the run. A
   * transition happens ONLY when the active provider reached a bounded
   * RATE_LIMIT_EXHAUSTED: the workflow checkpoint is preserved, the run switches
   * to the next free proof provider (NVIDIA NIM) and retries ONLY the blocked
   * stage. Completed stages, tool writes and artifacts are never repeated.
   */
  providerTransitions: { from_provider: string; to_provider: string; reason: string; stage: string }[];
  /**
   * Set when the Human Founder authorized a PAID model for the implementation
   * stage and this run used it. `outcome` is PASS only if the premium
   * implementation cleared every deterministic gate; PREMIUM_IMPLEMENTATION_FAILED
   * if it did not (the run then STOPS - no free fallback, no further premium
   * spend). `requests` counts real premium calls (bounded: <= 2).
   */
  premiumEscalation: {
    stage: "implementation";
    /** "codex-cli" (ChatGPT login) or "openai-premium-impl" (paid API). */
    provider: string;
    kind: "codex-cli" | "openai";
    model: string;
    modelSource: string;
    reason: string;
    /** Real premium calls / codex exec runs (bounded: <= 2). */
    requests: number;
    repairs: number;
    outcome: "PASS" | "PREMIUM_IMPLEMENTATION_FAILED";
    detail: string;
    tokenUsage: { input_tokens: number | null; output_tokens: number | null };
    /** Codex CLI reports a total; ChatGPT-plan usage, not API billing. Null for the API path. */
    codexTokensUsed: number | null;
    estimated_cost_usd: number | null;
    /** Files the premium implementer changed (validated to be in-scope). */
    changedFiles: string[];
  } | null;
  /**
   * Every rate-limit wait the run performed (credential-free). Waiting for
   * free-tier provider quota is normal and needs no Human Founder approval.
   */
  rateLimitWaits: { stage: string; agentRole: string; kind: string; cycle: number; waitMs: number; reason: string }[];
  /** Total milliseconds the run spent waiting for provider quota. */
  totalRateLimitWaitMs: number;
  approval_id: string | null;
  humanApprovalStatus: "HUMAN_APPROVAL_REQUIRED" | "NOT_REACHED";
  stages: SoftwareFactoryStageReport[];
  artifactsDir: string | null;
  workspaceDir: string | null;
  workspaceDiffStat: string;
  assertion: string;
}

export interface RunOptions {
  mode: "REAL" | "MOCK";
  /** REAL mode: the configured real provider descriptor (the primary, default Groq Direct). */
  descriptor?: RealProviderDescriptor;
  /**
   * REAL mode: ordered free-first fallback descriptors (default: [NVIDIA NIM]
   * when NVIDIA_API_KEY is present). Each is used at most once, and ONLY when the
   * currently active provider reaches a bounded RATE_LIMIT_EXHAUSTED. Never a
   * paid provider; OpenRouter is never auto-added here.
   */
  fallbackDescriptors?: RealProviderDescriptor[];
  /**
   * PREMIUM escalation for the `implementation` stage ONLY (build spec: model-tier
   * escalation). Present only when the Human Founder has explicitly authorized
   * premium use for this run. Every other stage still runs on the free-first
   * chain. Bounded to one primary attempt + one targeted repair. Either the
   * Codex CLI harness (ChatGPT login) or the paid OpenAI API.
   */
  premiumImpl?: PremiumImplOption;
  /**
   * REAL mode only: continue an existing persisted run from its current step
   * instead of starting a fresh one. The workflow engine already persists a run
   * after every transition; this resumes one whose process was interrupted
   * (e.g. an environment shutdown) after `implementation` + `code_review` passed.
   * Completed stages are NOT re-executed - the main loop starts at
   * `run.current_step` - and the implementation is NOT re-generated: its
   * committed change stays in the disposable workspace. Used by `proof resume`.
   */
  resume?: { runId: string };
  /** Override the build root (defaults to <runtime>/build). */
  buildRoot?: string;
  budget?: RequestBudget;
  task?: { title: string; description: string };
  /** Injected clock (deterministic tests). */
  clock?: import("../core/clock.ts").Clock;
  /** Injected sleep (deterministic tests - never actually blocks). */
  sleep?: (ms: number) => Promise<void>;
  /** Override the runner default output-token budget (env: AI_COMPANY_AGENT_MAX_OUTPUT_TOKENS). */
  agentMaxOutputTokens?: number;
  /** Override the configurable global output-token ceiling (env: AI_COMPANY_AGENT_OUTPUT_TOKENS_CEILING). */
  agentOutputTokensCeiling?: number;
  /** Override rate-limit scheduler config (otherwise from the provider descriptor). */
  rateLimit?: import("../models/rate-limit-scheduler.ts").RateLimitSchedulerConfig;
  /** Founder-friendly wait notification sink (defaults to stderr). */
  onRateLimitWait?: (line: string) => void;
}

function blockedResult(
  mode: "REAL" | "MOCK",
  reason: string,
  sensitivity: SensitivityVerdict,
  provider: SoftwareFactoryProofResult["provider"],
): SoftwareFactoryProofResult {
  return {
    ok: false,
    mode,
    blocked: true,
    blockReason: reason,
    sensitivity,
    provider,
    realModelsUsed: [],
    realRequestCount: 0,
    budget: null,
    tokenUsage: { input_tokens: null, output_tokens: null },
    cost: { known_usd: 0, unknown_calls: 0, note: "no requests issued" },
    task_id: null,
    workflow_id: null,
    run_id: null,
    run_status: null,
    project_state: null,
    stopped_because: reason,
    providerError: null,
    providerTransitions: [],
    premiumEscalation: null,
    rateLimitWaits: [],
    totalRateLimitWaitMs: 0,
    approval_id: null,
    humanApprovalStatus: "NOT_REACHED",
    stages: [],
    artifactsDir: null,
    workspaceDir: null,
    workspaceDiffStat: "(not started)",
    assertion: `BLOCKED: ${reason}`,
  };
}

export async function runSoftwareFactoryProof(
  rt: Runtime,
  opts: RunOptions,
): Promise<SoftwareFactoryProofResult> {
  const taskDef = opts.task ?? PROOF_TASK;
  const sensitivity = classifyProofSensitivity(taskDef.title, taskDef.description);

  let provider: ModelProvider;
  let providerMeta: SoftwareFactoryProofResult["provider"];
  const isReal = opts.mode === "REAL";

  /** Non-secret descriptor -> reporting metadata. */
  const metaFor = (d: RealProviderDescriptor): NonNullable<SoftwareFactoryProofResult["provider"]> => ({
    label: d.label,
    name: d.provider.name,
    baseUrl: d.baseUrl,
    model: d.model,
    isProofProvider: d.isProofProvider,
    sensitivity: d.sensitivity,
  });

  /** Which proof provider currently backs the runner ("groq" / "nvidia" / ... / "mock"). */
  let activeDescriptor: RealProviderDescriptor | undefined;
  let activeProviderId = "mock";
  /**
   * Ready, still-unused free fallback descriptors, consumed one at a time and
   * ONLY on a bounded RATE_LIMIT_EXHAUSTED. Non-ready descriptors (missing key)
   * are dropped here so a transition never lands on an unusable provider.
   */
  const pendingFallbacks: RealProviderDescriptor[] = isReal
    ? (opts.fallbackDescriptors ?? []).filter((d) => d.provider.isReady())
    : [];
  const providerTransitions: SoftwareFactoryProofResult["providerTransitions"] = [];

  if (isReal) {
    if (!opts.descriptor) {
      return blockedResult("REAL", "BLOCKED_PROVIDER_UNAVAILABLE: no real provider configured", sensitivity, null);
    }
    providerMeta = metaFor(opts.descriptor);
    if (!opts.descriptor.provider.isReady()) {
      return blockedResult(
        "REAL",
        `BLOCKED_PROVIDER_UNAVAILABLE: ${opts.descriptor.apiKeyEnv} is not configured`,
        sensitivity,
        providerMeta,
      );
    }
    if (!sensitivity.allowed) {
      return blockedResult(
        "REAL",
        `BLOCKED_SENSITIVE_TASK: ${sensitivity.reason}`,
        sensitivity,
        providerMeta,
      );
    }
    provider = opts.descriptor.provider;
    activeDescriptor = opts.descriptor;
    activeProviderId = opts.descriptor.id;
  } else {
    provider = new MockModelProvider();
    providerMeta = {
      label: "MOCK / deterministic offline",
      name: "mock",
      baseUrl: null,
      model: "mock-*",
      isProofProvider: false,
      sensitivity: "GENERAL",
    };
  }

  const buildRoot = opts.buildRoot ?? join(RUNTIME_ROOT, "build");
  const budget = opts.budget ?? new RequestBudget();

  const envInt = (name: string): number | undefined => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };
  const agentMaxOutputTokens = opts.agentMaxOutputTokens ?? envInt("AI_COMPANY_AGENT_MAX_OUTPUT_TOKENS");
  const agentOutputTokensCeiling =
    opts.agentOutputTokensCeiling ?? envInt("AI_COMPANY_AGENT_OUTPUT_TOKENS_CEILING");

  const rateLimitWaits: SoftwareFactoryProofResult["rateLimitWaits"] = [];
  const emitWaitLine =
    opts.onRateLimitWait ?? ((line: string) => process.stderr.write(line + "\n"));

  /** Every real provider the run has bound (primary + any fallback), for usage/token totals. */
  const providersUsed: ModelProvider[] = [provider];

  // --- start fresh, OR resume an interrupted persisted run -----------------
  // On resume the workflow engine's own persisted run is the source of truth:
  // its history already holds the completed stages, so the main loop below picks
  // up at `run.current_step` and never re-runs them. The disposable workspace
  // keeps the implementation that was already applied and independently reviewed.
  let task: Task;
  let run: WorkflowRun;
  /** Completed-stage reports + prior-artifact context reconstructed on resume. */
  const resumedStages: SoftwareFactoryStageReport[] = [];
  const resumedPriorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[] = [];

  if (isReal && opts.resume) {
    let existingRun: WorkflowRun;
    try {
      existingRun = rt.workflows.getRun(opts.resume.runId);
    } catch {
      return blockedResult("REAL", `BLOCKED_RESUME: run ${opts.resume.runId} not found`, sensitivity, providerMeta);
    }
    const existingTask = rt.orchestrator.tasks.get(existingRun.task_id);
    if (!existingTask) {
      return blockedResult("REAL", `BLOCKED_RESUME: task ${existingRun.task_id} not found`, sensitivity, providerMeta);
    }
    if (existingRun.status !== "RUNNING") {
      return blockedResult(
        "REAL",
        `BLOCKED_RESUME: run ${existingRun.id} is ${existingRun.status}, not RUNNING`,
        sensitivity,
        providerMeta,
      );
    }
    const passed = new Set(existingRun.history.filter((h) => h.result === "PASS").map((h) => h.step_id));
    if (!passed.has("implementation") || !passed.has("code_review")) {
      return blockedResult(
        "REAL",
        `BLOCKED_RESUME: run ${existingRun.id} has not completed implementation + code_review (cannot resume safely)`,
        sensitivity,
        providerMeta,
      );
    }
    task = existingTask;
    run = existingRun;

    // Rebuild the completed-stage reports + prior-artifact context from the
    // persisted run history and the durable artifact store. Nothing is executed.
    const priorStore = new ProofArtifactStore({ buildRoot, taskId: task.id, clock: rt.clock });
    for (const h of existingRun.history) {
      const real = REAL_STAGES.has(h.step_id);
      resumedStages.push({
        stage: h.step_id,
        agentId: h.owner,
        role: rt.registries.agents.byId.get(h.owner)?.title ?? h.owner,
        real,
        modelBacked: real,
        providerId: h.step_id === "implementation" ? "codex-premium" : real ? "resumed" : "mock",
        outcome: h.result === "PASS" ? "PASS" : "FAIL",
        summary: h.note,
        artifacts: [`${h.step_id}.md`],
      });
      const body = priorStore.read(`${h.step_id}.md`);
      if (real && body) {
        resumedPriorArtifacts.push({
          stage: h.step_id,
          agentId: h.owner,
          path: `${h.step_id}.md`,
          excerpt: body.slice(0, 1600),
        });
      }
    }
  } else {
    task = rt.orchestrator.tasks.create({
      title: taskDef.title,
      description: taskDef.description,
      project: "runtime-proof-v1.1",
    });
    run = rt.orchestrator.plan(task).run;
  }
  const wf = rt.registries.workflows.get(run.workflow_id);

  const workspace = new ProofWorkspace({
    buildRoot,
    taskId: task.id,
    seedFrom: join(paths.fixtures, "demo-service"),
  });
  const artifacts = new ProofArtifactStore({ buildRoot, taskId: task.id, clock: rt.clock });

  /**
   * Build a runner bound to one proof provider. Called once for the primary and
   * again after each free-first fallback transition; each rebuild gets its own
   * rate-limit scheduler (the new provider's own pacing / window) while the
   * shared RequestBudget keeps counting across the transition.
   */
  const makeRunner = (prov: ModelProvider, label: string, descriptor?: RealProviderDescriptor): RealAgentRunner =>
    new RealAgentRunner(
      rt.registries,
      prov,
      label,
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
      {
        maxOutputTokens: agentMaxOutputTokens,
        maxOutputTokensCeiling: agentOutputTokensCeiling,
        nativeStructuredOutput: descriptor ? descriptor.nativeStructuredOutput : false,
        rateLimit:
          opts.rateLimit ?? (descriptor ? descriptor.rateLimit : { minIntervalMs: 0, maxRetryCycles: 1 }),
        clock: opts.clock ?? rt.clock,
        sleep: opts.sleep,
        onRateLimitWait: (e) => {
          rateLimitWaits.push({
            stage: e.stage,
            agentRole: e.agentRole,
            kind: e.kind,
            cycle: e.cycle,
            waitMs: e.waitMs,
            reason: e.reason,
          });
          // Founder-friendly, on stderr so a --json proof keeps clean stdout.
          emitWaitLine(
            `\n${e.agentRole}\nWAITING_FOR_PROVIDER_QUOTA\nresume in approximately ${Math.max(1, Math.round(e.waitMs / 1000))}s\n(${e.reason})`,
          );
        },
      },
    );

  let runner = makeRunner(provider, providerMeta!.label, activeDescriptor);

  // --- PREMIUM implementation escalation (authorized, bounded) --------------
  // Used for the `implementation` stage ONLY. Every other stage stays on the
  // free-first chain. Bounded to one primary attempt + one targeted repair.
  // Never falls back to a free provider on failure. Two paths: the Codex CLI
  // harness (ChatGPT login, no API credit) or the paid OpenAI API.
  const premiumOpenAI =
    isReal && opts.premiumImpl?.kind === "openai" && opts.premiumImpl.openaiDescriptor?.provider.isReady()
      ? opts.premiumImpl.openaiDescriptor
      : null;
  const premiumCodex =
    isReal && opts.premiumImpl?.kind === "codex-cli" && opts.premiumImpl.codexHarness
      ? opts.premiumImpl
      : null;
  const premium = premiumOpenAI;
  let premiumEscalation: SoftwareFactoryProofResult["premiumEscalation"] = null;
  let premiumRunner: RealAgentRunner | null = null;
  const buildPremiumRunner = (): RealAgentRunner => {
    if (premiumRunner) return premiumRunner;
    premiumRunner = new RealAgentRunner(
      rt.registries,
      premium!.provider,
      premium!.label,
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
      {
        maxStructuredRetries: 0, // one primary attempt; no malformed-JSON retry
        maxOutputTokens: agentMaxOutputTokens,
        maxOutputTokensCeiling: agentOutputTokensCeiling,
        nativeStructuredOutput: true, // OpenAI strict Structured Outputs
        rateLimit: opts.rateLimit ?? { minIntervalMs: 0, maxRetryCycles: 1, maxWaitMsPerCycle: 30_000 },
        clock: opts.clock ?? rt.clock,
        sleep: opts.sleep,
        onRateLimitWait: (e) => {
          rateLimitWaits.push({ stage: e.stage, agentRole: e.agentRole, kind: e.kind, cycle: e.cycle, waitMs: e.waitMs, reason: e.reason });
          emitWaitLine(`\n${e.agentRole}\nWAITING_FOR_PROVIDER_QUOTA\nresume in approximately ${Math.max(1, Math.round(e.waitMs / 1000))}s\n(${e.reason})`);
        },
      },
    );
    providersUsed.push(premium!.provider);
    return premiumRunner;
  };

  const stages: SoftwareFactoryStageReport[] = [...resumedStages];
  const priorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[] = [...resumedPriorArtifacts];
  const realModels = new Set<string>();
  let current = rt.workflows.getRun(run.id);
  let stoppedBecause = "completed";
  let ok = true;
  let providerError: SoftwareFactoryProofResult["providerError"] = null;

  for (let i = 0; i < 40; i++) {
    current = rt.workflows.getRun(run.id);
    if (current.status !== "RUNNING") {
      stoppedBecause = current.status.toLowerCase();
      break;
    }
    const step = rt.workflows.step(current);

    if (step.human_approval) {
      current = rt.workflows.openApproval(run.id, buildApprovalPacket(stages));
      stoppedBecause = "human_approval_required";
      rt.orchestrator.tasks.save({ ...rt.orchestrator.tasks.get(task.id)!, status: "APPROVAL_REQUIRED" });
      break;
    }

    const agent = rt.registries.agents.byId.get(step.owner);
    if (!agent) {
      // human-founder / system owned step reached without an approval: stop, do not fake.
      stoppedBecause = "blocked_no_owner_agent";
      ok = false;
      break;
    }

    if (REAL_STAGES.has(step.id)) {
      let outcome: RealStageOutcome;
      // Restore point taken BEFORE the stage runs, so a free-first provider
      // fallback (RATE_LIMIT_EXHAUSTED -> NVIDIA) retries this stage from a clean
      // checkpoint and never re-applies a partial stage's workspace writes.
      const stageCheckpoint = workspace.snapshot(`pre:${step.id}`);

      // PREMIUM escalation: the implementation stage ONLY, and only when the
      // Founder authorized it. Every other stage keeps the free-first runner.
      const usePremiumOpenAI = step.id === "implementation" && premiumOpenAI !== null;
      const usePremiumCodex = step.id === "implementation" && premiumCodex !== null;
      const usePremium = usePremiumOpenAI || usePremiumCodex;
      const stageRunner = usePremiumOpenAI ? buildPremiumRunner() : runner;
      const budgetBefore = budget.count;

      // --- PREMIUM via the Codex CLI harness (ChatGPT login, no API credit) ---
      if (usePremiumCodex) {
        const codexRes = await runCodexImplementationStage({
          rt,
          harness: premiumCodex!.codexHarness!,
          codexLabel: premiumCodex!.codexLabel ?? "PREMIUM / Codex CLI (ChatGPT)",
          codexModel: premiumCodex!.codexModel ?? "",
          workspace,
          task,
          agent,
          step,
          plan: PLANS[step.id]!,
          priorArtifacts: priorArtifacts.slice(-6),
          stageCheckpoint,
          emit: emitWaitLine,
        });
        outcome = codexRes.outcome;
        premiumEscalation = codexRes.premium;
        rt.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          model: `codex-cli:${premiumEscalation.model}`,
          action: `premium_escalation_result:${step.id}`,
          reason:
            `PREMIUM Codex escalation ${premiumEscalation.outcome}: ${premiumEscalation.detail}; ` +
            `${premiumEscalation.requests} codex run(s), ${premiumEscalation.repairs} repair(s); ` +
            `codex tokens used ~${premiumEscalation.codexTokensUsed ?? "?"} (ChatGPT plan, not API billing); ` +
            `changed files: ${premiumEscalation.changedFiles.join(", ") || "(none)"}`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: premiumEscalation.outcome === "PASS" ? "PASS" : "BLOCKED",
        });
      } else {
      if (usePremiumOpenAI) {
        premiumEscalation = {
          stage: "implementation",
          provider: premiumOpenAI!.provider.name,
          kind: "openai",
          model: premiumOpenAI!.model,
          modelSource: premiumOpenAI!.modelSource,
          reason:
            "FREE_IMPLEMENTATION_QUALITY_BUDGET exhausted on both free proof models; " +
            "Human Founder authorized ONE premium escalation for the implementation stage only",
          requests: 0,
          repairs: 0,
          outcome: "PREMIUM_IMPLEMENTATION_FAILED",
          detail: "premium implementation attempt did not complete",
          tokenUsage: { input_tokens: null, output_tokens: null },
          codexTokensUsed: null,
          estimated_cost_usd: null,
          changedFiles: [],
        };
        rt.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          model: `${premiumOpenAI!.provider.name}:${premiumOpenAI!.model}`,
          action: `premium_escalation:${step.id}`,
          reason:
            `PREMIUM escalation authorized for stage '${step.id}' ONLY: provider=${premiumOpenAI!.provider.name} ` +
            `model=${premiumOpenAI!.model} (source: ${premiumOpenAI!.modelSource}); risk ` +
            `${(step.risk_level ?? task.risk)}; bounded to one primary attempt + one targeted test-repair; ` +
            `no free fallback on failure; ${premiumEscalation.reason}`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: "PENDING",
        });
        emitWaitLine(
          `\n${agent.title}\nPREMIUM_ESCALATION\nimplementation stage on ${premiumOpenAI!.provider.name} ${premiumOpenAI!.model} ` +
            `(Human Founder authorized; bounded 1 primary + 1 repair)`,
        );
      }

      try {
        outcome = await stageRunner.runStage({
          agent,
          workflow: wf,
          step,
          task,
          run: current,
          priorArtifacts: priorArtifacts.slice(-6),
          plan: PLANS[step.id]!,
          workspace,
          budget,
          contextBudgetBytes: 24_000,
        });
        if (usePremiumOpenAI && premiumEscalation) {
          const u = premiumOpenAI!.provider.usage();
          premiumEscalation.requests = budget.count - budgetBefore;
          premiumEscalation.repairs = Math.max(0, (outcome.attempts ?? 1) - 1);
          premiumEscalation.tokenUsage = u;
          premiumEscalation.estimated_cost_usd = outcome.execution.usage.estimated_cost_usd;
          premiumEscalation.outcome = outcome.outcome === "PASS" ? "PASS" : "PREMIUM_IMPLEMENTATION_FAILED";
          premiumEscalation.detail =
            outcome.outcome === "PASS"
              ? `premium implementation PASSED every deterministic gate (npm test exit ${outcome.testEvidence?.exitCode ?? "?"}, ${outcome.testEvidence?.passed ?? 0} passing)`
              : `premium implementation did NOT clear the deterministic gates: ${outcome.enforcementNotes.join("; ") || outcome.modelStatus}`;
        }
      } catch (err) {
        // A real provider call failed at the transport layer (HTTP error, rate
        // limit, 5xx, timeout, network, empty completion) or the request-budget
        // ceiling was hit. Fail safe and structurally: record the classified
        // error, BLOCK the stage, and stop the run. The proof must never crash
        // the CLI with empty stdout - the caller still gets a machine-readable
        // result. Structured-output validation in RealAgentRunner is untouched.
        const code = err instanceof RuntimeError ? err.code : "UNCAUGHT_RUNNER_ERROR";
        const detail = redactString(err instanceof Error ? err.message : String(err));

        // PREMIUM (OpenAI API) implementation escalation failed at the transport
        // layer (quota/billing exhausted, HTTP error, timeout, ...). The
        // Founder's authorization is ONE bounded escalation: do NOT fall back to
        // a free provider, do NOT retry, do NOT spend more. Record and STOP.
        if (usePremiumOpenAI) {
          if (premiumEscalation) {
            premiumEscalation.requests = budget.count - budgetBefore;
            premiumEscalation.outcome = "PREMIUM_IMPLEMENTATION_FAILED";
            premiumEscalation.detail =
              code === "PROVIDER_QUOTA_EXHAUSTED"
                ? `BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE: the authorized premium provider's account has no API credit (${detail})`
                : `premium implementation call failed [${code}]: ${detail}`;
          }
          providerError = { stage: step.id, code, detail };
          rt.audit.record({
            task: task.id,
            agent_id: agent.id,
            agent_role: agent.department,
            model: `${premiumOpenAI!.provider.name}:${premiumOpenAI!.model}`,
            action: `premium_escalation_failed:${step.id}`,
            reason:
              `premium implementation escalation FAILED [${code}] - ${detail}; ` +
              `per the Human Founder authorization the run STOPS (no free fallback, no premium retry, no further spend)`,
            risk_level: (step.risk_level ?? task.risk) as RiskLevel,
            result: "BLOCKED",
            error: `[${code}] ${detail}`,
          });
          stages.push({
            stage: step.id,
            agentId: agent.id,
            role: agent.title,
            real: true,
            modelBacked: true,
            providerId: "openai-premium",
            outcome: "BLOCKED",
            modelStatus: code === "PROVIDER_QUOTA_EXHAUSTED" ? "PREMIUM_PROVIDER_UNAVAILABLE" : code,
            requests: budget.count,
            artifacts: [],
            enforcement: [`blocked: premium implementation escalation failed [${code}]`],
            summary: `stage '${step.id}' BLOCKED: PREMIUM_IMPLEMENTATION_FAILED [${code}]`,
          });
          stoppedBecause =
            code === "PROVIDER_QUOTA_EXHAUSTED"
              ? "premium_provider_unavailable"
              : "premium_implementation_failed";
          ok = false;
          break;
        }

        // Free-first provider fallback (build spec: free-provider fallback chain).
        // The active proof provider's free-tier quota is exhausted for this window
        // (a BOUNDED RATE_LIMIT_EXHAUSTED - the scheduler already waited its
        // retry cycles). The workflow checkpoint is intact: the blocked stage
        // never submitted an outcome, so `current` still points at it. Switch to
        // the next free proof provider (NVIDIA NIM) and retry ONLY this stage.
        // Completed stages, tool writes and artifacts are never repeated; the
        // shared RequestBudget keeps counting (ceiling still enforced). This is
        // NOT triggered by a normal 429, a provider error, a 5xx or a
        // model-response failure - only RATE_LIMIT_EXHAUSTED.
        if (isReal && code === "RATE_LIMIT_EXHAUSTED" && pendingFallbacks.length > 0) {
          const next = pendingFallbacks.shift()!;
          const fromId = activeProviderId;
          rt.audit.record({
            task: task.id,
            agent_id: agent.id,
            agent_role: agent.department,
            model: `${next.provider.name}:${next.model}`,
            action: `provider_transition:${step.id}`,
            reason:
              `free-first proof provider fallback: from_provider=${fromId} to_provider=${next.id} ` +
              `reason=RATE_LIMIT_EXHAUSTED stage=${step.id}; workflow checkpoint preserved; ` +
              `retrying ONLY the blocked stage; no completed stage, tool write or artifact repeated`,
            risk_level: (step.risk_level ?? task.risk) as RiskLevel,
            result: "PENDING",
          });
          providerTransitions.push({
            from_provider: fromId,
            to_provider: next.id,
            reason: "RATE_LIMIT_EXHAUSTED",
            stage: step.id,
          });
          // Roll the workspace back to the pre-stage checkpoint so the retry on
          // the new provider never sees a partial write from the exhausted attempt.
          workspace.restore(stageCheckpoint);
          provider = next.provider;
          providerMeta = metaFor(next);
          activeDescriptor = next;
          activeProviderId = next.id;
          providersUsed.push(next.provider);
          runner = makeRunner(provider, providerMeta.label, next);
          emitWaitLine(
            `\n${agent.title}\nPROVIDER_FALLBACK\n${fromId} free-tier quota exhausted (RATE_LIMIT_EXHAUSTED); ` +
              `switching to ${next.id} and retrying stage '${step.id}' (checkpoint preserved)`,
          );
          continue; // re-enter the loop: `current` still sits on this same step
        }

        // A real provider call failed at the transport layer, or the request
        // budget ceiling was hit, and no free fallback is available. Fail safe
        // and structurally.
        providerError = { stage: step.id, code, detail };
        rt.audit.record({
          task: task.id,
          agent_id: agent.id,
          agent_role: agent.department,
          model: `${providerMeta?.name ?? "unknown"}:${providerMeta?.model ?? "unknown"}`,
          action: `real_model_call_failed:${step.id}`,
          reason: `provider/runner error during stage '${step.id}': [${code}] ${detail}`,
          risk_level: (step.risk_level ?? task.risk) as RiskLevel,
          result: "BLOCKED",
          error: `[${code}] ${detail}`,
        });
        stages.push({
          stage: step.id,
          agentId: agent.id,
          role: agent.title,
          real: true,
          modelBacked: true,
          providerId: activeProviderId,
          outcome: "BLOCKED",
          modelStatus: code,
          requests: budget.count,
          artifacts: [],
          enforcement: [`blocked: real provider/runner error [${code}]`],
          summary: `stage '${step.id}' BLOCKED: real provider/runner error [${code}]`,
        });
        stoppedBecause =
          code === "REQUEST_BUDGET_EXCEEDED"
            ? "request_budget_exceeded"
            : code === "RATE_LIMIT_EXHAUSTED"
              ? "rate_limit_exhausted"
              : "provider_error";
        ok = false;
        break;
      }
      } // end non-Codex stage execution

      if (outcome.execution.usage.real) realModels.add(outcome.execution.usage.model);

      const stored = persistStageArtifacts(artifacts, {
        taskId: task.id,
        workflowId: wf.id,
        stage: step.id,
        agentId: agent.id,
        role: agent.title,
        real: outcome.execution.usage.real,
      }, outcome.execution, outcome);

      for (const s of stored) {
        priorArtifacts.push({
          stage: step.id,
          agentId: agent.id,
          path: s.file,
          excerpt: (artifacts.read(s.file) ?? "").slice(0, 1600),
        });
      }

      stages.push({
        stage: step.id,
        agentId: agent.id,
        role: agent.title,
        real: outcome.execution.usage.real,
        modelBacked: true,
        providerId: usePremiumCodex
          ? "codex-premium"
          : usePremiumOpenAI
            ? "openai-premium"
            : outcome.execution.usage.real
              ? activeProviderId
              : "mock",
        outcome: outcome.outcome,
        modelStatus: outcome.modelStatus,
        attempts: outcome.attempts,
        requests: budget.count,
        contextBytes: outcome.contextBytes,
        truncated: outcome.truncatedSections,
        toolCalls: outcome.toolCalls.map((t) => ({
          tool: t.tool,
          decision: t.decision,
          executed: t.executed,
          detail: t.detail,
        })),
        testEvidence: outcome.testEvidence
          ? {
              command: outcome.testEvidence.command,
              exitCode: outcome.testEvidence.exitCode,
              passed: outcome.testEvidence.passed,
              failed: outcome.testEvidence.failed,
            }
          : null,
        securityEvidence: outcome.securityEvidence ? outcome.securityEvidence.checks : null,
        enforcement: outcome.enforcementNotes,
        artifacts: stored.map((s) => s.file),
        summary: outcome.execution.summary,
      });

      if (outcome.outcome !== "PASS") {
        stoppedBecause = usePremium
          ? outcome.modelStatus === "PREMIUM_PROVIDER_UNAVAILABLE"
            ? "premium_provider_unavailable"
            : "premium_implementation_failed"
          : outcome.outcome === "BLOCKED"
            ? "stage_blocked"
            : "stage_failed";
        ok = false;
        break;
      }
      current = rt.workflows.submitOutcome(run.id, {
        result: "PASS",
        byAgent: agent.id,
        note: outcome.execution.summary.slice(0, 150),
      });
    } else {
      // Deterministic auxiliary stage: no model call, minimal recorded artifact.
      const note = `[auxiliary] ${agent.id} completed '${step.id}' deterministically: ${step.action}`;
      const stored = artifacts.writeStageReport(
        { taskId: task.id, workflowId: wf.id, stage: step.id, agentId: agent.id, role: agent.title, real: false },
        `${step.name} (auxiliary)`,
        `Deterministic auxiliary stage. No model request was issued.\n\nAction: ${step.action}\n`,
      );
      priorArtifacts.push({ stage: step.id, agentId: agent.id, path: stored.file, excerpt: note });
      stages.push({
        stage: step.id,
        agentId: agent.id,
        role: agent.title,
        real: false,
        modelBacked: false,
        outcome: "PASS",
        artifacts: [stored.file],
        summary: note,
      });
      current = rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: agent.id, note });
    }

    if (current.status !== "RUNNING") {
      stoppedBecause = current.status === "APPROVAL_REQUIRED" ? "human_approval_required" : current.status.toLowerCase();
      break;
    }
  }

  current = rt.workflows.getRun(run.id);
  const reachedApproval =
    current.status === "APPROVAL_REQUIRED" &&
    current.project_state === "HUMAN_APPROVAL_REQUIRED" &&
    Boolean(current.pending_approval_id);

  // Independence: implementation and review executed by different agents.
  const impl = stages.find((s) => s.stage === "implementation");
  const review = stages.find((s) => s.stage === "code_review");
  const reviewerIndependent = Boolean(impl && review && impl.agentId !== review.agentId);

  // Sum token usage across every provider the run bound (primary + any fallback),
  // de-duplicated by identity so a non-transitioned run is unchanged.
  const providerUsage = [...new Set(providersUsed)].reduce(
    (acc, p) => {
      const u = p.usage();
      return {
        input_tokens:
          u.input_tokens == null ? acc.input_tokens : (acc.input_tokens ?? 0) + u.input_tokens,
        output_tokens:
          u.output_tokens == null ? acc.output_tokens : (acc.output_tokens ?? 0) + u.output_tokens,
      };
    },
    { input_tokens: null as number | null, output_tokens: null as number | null },
  );
  const costSummary = rt.cost.summary();

  ok =
    ok &&
    reachedApproval &&
    reviewerIndependent &&
    stages.every((s) => s.outcome === "PASS") &&
    (isReal ? budget.count > 0 && budget.count <= budget.ceiling : true);

  const transitionNote =
    providerTransitions.length > 0
      ? `free-first provider fallback ${providerTransitions
          .map((t) => `${t.from_provider}->${t.to_provider}@${t.stage}`)
          .join(", ")} (RATE_LIMIT_EXHAUSTED, checkpoint preserved); `
      : "";
  const premiumNote = premiumEscalation
    ? `implementation stage on PREMIUM ${premiumEscalation.provider}:${premiumEscalation.model} ` +
      `(Human Founder authorized, ${premiumEscalation.requests} request(s)); `
    : "";
  const premiumFailed =
    premiumEscalation !== null && premiumEscalation.outcome !== "PASS";
  const assertion = ok
    ? `${opts.mode} PASS: the ${isReal ? "real" : "mock"} agent chain executed ` +
      `${isReal ? realModels.size + " model(s), " + budget.count + " request(s), " : ""}` +
      transitionNote +
      premiumNote +
      `every gate PASSED, the reviewer was independent, and the run STOPPED at ` +
      `HUMAN_APPROVAL_REQUIRED with a pending approval. No production action occurred.`
    : premiumFailed
      ? `${opts.mode} PREMIUM_IMPLEMENTATION_FAILED: ${premiumEscalation!.detail}; per the Human Founder ` +
        `authorization the run STOPPED - no free fallback, no premium retry, no further spend.`
      : providerError
        ? `${opts.mode} BLOCKED: ${providerError.code === "RATE_LIMIT_EXHAUSTED" ? "provider rate limit did not clear within the bounded retry cycles" : "real provider/runner error"} ` +
          `[${providerError.code}] at stage '${providerError.stage}'; run stopped safely (checkpoint preserved), no production action occurred.`
        : `${opts.mode} FAIL: stopped_because=${stoppedBecause} reachedApproval=${reachedApproval} ` +
          `reviewerIndependent=${reviewerIndependent} requests=${budget.count}`;

  if (premiumEscalation) {
    rt.audit.record({
      task: task.id,
      agent_id: "backend-engineer",
      agent_role: "engineering",
      model: `${premiumEscalation.provider}:${premiumEscalation.model}`,
      action: "premium_escalation_result:implementation",
      reason:
        `PREMIUM implementation escalation ${premiumEscalation.outcome}: ${premiumEscalation.detail}; ` +
        `${premiumEscalation.requests} premium request(s), ${premiumEscalation.repairs} repair(s); ` +
        `tokens in=${premiumEscalation.tokenUsage.input_tokens ?? "?"} out=${premiumEscalation.tokenUsage.output_tokens ?? "?"}`,
      risk_level: 2 as RiskLevel,
      result: premiumEscalation.outcome === "PASS" ? "PASS" : "BLOCKED",
      estimated_cost: premiumEscalation.estimated_cost_usd,
    });
  }

  const totalRateLimitWaitMs = rateLimitWaits.reduce((s, w) => s + w.waitMs, 0);

  return {
    ok,
    mode: opts.mode,
    blocked: providerError !== null || premiumFailed,
    blockReason: premiumFailed
      ? `PREMIUM_IMPLEMENTATION_FAILED: ${premiumEscalation!.detail}`
      : providerError
        ? `BLOCKED_PROVIDER_ERROR: [${providerError.code}] at stage '${providerError.stage}'`
        : null,
    sensitivity,
    provider: providerMeta,
    realModelsUsed: [...realModels],
    realRequestCount: isReal ? budget.count : 0,
    budget: budget.snapshot(),
    tokenUsage: providerUsage,
    cost: {
      known_usd: costSummary.total_known_cost_usd,
      unknown_calls: costSummary.unknown_cost_calls,
      note:
        costSummary.unknown_cost_calls > 0 && costSummary.total_known_cost_usd === 0
          ? "UNKNOWN (provider did not report cost; not assumed free)"
          : "provider-reported",
    },
    task_id: task.id,
    workflow_id: wf.id,
    run_id: run.id,
    run_status: current.status,
    project_state: current.project_state,
    stopped_because: stoppedBecause,
    providerError,
    providerTransitions,
    premiumEscalation,
    rateLimitWaits,
    totalRateLimitWaitMs,
    approval_id: current.pending_approval_id,
    humanApprovalStatus: reachedApproval ? "HUMAN_APPROVAL_REQUIRED" : "NOT_REACHED",
    stages,
    artifactsDir: artifacts.dir,
    workspaceDir: workspace.root,
    workspaceDiffStat: workspace.diff().split("\n").slice(0, 40).join("\n"),
    assertion,
  };
}

function persistStageArtifacts(
  store: ProofArtifactStore,
  meta: { taskId: string; workflowId: string; stage: string; agentId: string; role: string; real: boolean },
  execution: AgentExecutionResult,
  outcome: { toolCalls: unknown[]; testEvidence: unknown; securityEvidence: unknown; enforcementNotes: string[] },
) {
  const stored = [];
  const report = [
    `# ${meta.stage} - ${meta.role}`,
    "",
    `**Status (enforced):** see runtime record. **Model status:** ${execution.status}`,
    "",
    `## Summary`,
    execution.summary,
    "",
    `## Reasoning summary`,
    execution.reasoningSummary,
    "",
    `## Recommendations`,
    ...(execution.recommendations.length ? execution.recommendations.map((r) => `- ${r}`) : ["- (none)"]),
    "",
    `## Quality evidence`,
    ...(execution.qualityEvidence.length
      ? execution.qualityEvidence.map((q) => `- ${q.check}: ${q.result} - ${q.detail}`)
      : ["- (none)"]),
    "",
    `## Risks`,
    ...(execution.risks.length ? execution.risks.map((r) => `- ${r}`) : ["- (none)"]),
    "",
    `## Runner enforcement`,
    ...(outcome.enforcementNotes.length ? outcome.enforcementNotes.map((n) => `- ${n}`) : ["- (none)"]),
  ].join("\n");
  stored.push(store.writeStageReport(meta, `${meta.stage} report`, report));

  for (const [idx, a] of execution.artifacts.entries()) {
    if (a.kind === "code" || a.kind === "test") continue; // code lives in the workspace, not here
    if (`${meta.stage}.md` === a.path) continue;
    try {
      stored.push(store.writeExtra(meta, a.path || `artifact-${idx}.md`, `${meta.stage} artifact`, a.content));
    } catch {
      /* secret-like artifact refused; already covered by the report */
    }
  }
  return stored;
}

function buildApprovalPacket(stages: SoftwareFactoryStageReport[]) {
  const gate = stages.filter((s) => s.outcome === "PASS").map((s) => s.stage);
  const qa = stages.find((s) => s.stage === "qa");
  const sec = stages.find((s) => s.stage === "security");
  return {
    impact:
      "Disposable proof only: a GET /health endpoint was added to build/proof/<task>/workspace " +
      "(the fixture demo-service). Nothing is deployed, merged or released.",
    tests_summary: qa?.testEvidence
      ? `npm test exit=${qa.testEvidence.exitCode}, ${qa.testEvidence.passed} passing, ${qa.testEvidence.failed} failing (machine evidence).`
      : `stages passed: ${gate.join(", ")}`,
    security_summary: sec?.securityEvidence
      ? `deterministic checks: ${sec.securityEvidence.map((c) => `${c.check}=${c.result}`).join(", ")}`
      : "security gate PASSED",
    rollback_summary: "Discard build/proof/<task>/workspace; no external state was changed.",
    estimated_cost_usd: 0,
  };
}

// ---------------------------------------------------------------------------
// PREMIUM implementation via the Codex CLI harness (ChatGPT login).
// ---------------------------------------------------------------------------

/** Paths a fixture implementation may touch. Anything else is out of scope. */
const CODEX_ALLOWED_PATH = /^(src\/|test\/|tests\/|docs\/|package\.json$|README(\.md)?$|\.gitignore$)/;

interface CodexStageCtx {
  rt: Runtime;
  harness: CodexCliHarness;
  codexLabel: string;
  codexModel: string;
  workspace: ProofWorkspace;
  task: Task;
  agent: AgentDefinition;
  step: WorkflowStep;
  plan: StagePlan;
  priorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[];
  stageCheckpoint: string;
  emit: (line: string) => void;
}

type PremiumEscalationMeta = NonNullable<SoftwareFactoryProofResult["premiumEscalation"]>;

function parseCodexTokens(stdout: string): number | null {
  const m = stdout.match(/tokens used[\s:]*([\d,]+)/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildCodexImplPrompt(ctx: CodexStageCtx, repair?: { evidence: string }): string {
  let facts = "";
  try {
    const f = ctx.workspace.projectFacts();
    facts = [
      `- module system: ${f.moduleType} (${f.moduleSyntax})`,
      `- test command (the runtime runs this after you finish): ${f.testCommand}`,
      `- test runner: ${f.testRunner}; ${f.testDiscoveryRule}`,
      `- add the new test at: ${f.recommendedTestPath}`,
      `- server/library entrypoint: ${f.serverEntrypoint ?? "(none found)"}; exports: ${f.entrypointExports.join(", ") || "(none)"}`,
      `- existing tests: ${f.existingTests.join(", ") || "(none)"}`,
    ].join("\n");
  } catch {
    facts = "(project facts unavailable - inspect package.json and src/ yourself)";
  }
  const priors = ctx.priorArtifacts
    .filter((a) => ["business_analysis", "spec_review", "architecture", "plan"].includes(a.stage))
    .map((a) => `### ${a.stage}\n${a.excerpt.slice(0, 900)}`)
    .join("\n\n");

  const base = [
    `You are the Backend Engineer implementing ONE small, additive change in this repository (an`,
    `isolated, disposable proof workspace). Make the change directly in the working tree.`,
    ``,
    `## Task`,
    `${ctx.task.title}`,
    `${ctx.task.description}`,
    ``,
    `## Acceptance criteria (validated deterministically by the runtime after you finish)`,
    `- GET /health returns HTTP 200 with the exact JSON body {"status":"ok"}`,
    `- an automated test that the project's own test command discovers and that passes`,
    `- the smallest change that fits the existing architecture: add one branch to the existing`,
    `  entrypoint handler. Do NOT add a web framework, a dependency, a new server or a new test`,
    `  framework. Additive only - do not change unrelated behaviour.`,
    ``,
    `## Project facts (authoritative - from the actual workspace)`,
    facts,
    ``,
    priors ? `## Context from the earlier (already-approved) stages\n${priors}\n` : "",
    `## Rules`,
    `- Only modify files under src/, test/, docs/, or package.json / README. Do NOT touch any`,
    `  other path, and do NOT create unrelated files.`,
    `- Do NOT run git commit / git push / any deploy or release command. Do NOT weaken or delete`,
    `  tests. Do NOT print secrets.`,
    `- After editing, run the project's test command yourself and confirm it passes before you`,
    `  finish. End with a one-line summary of exactly which files you changed.`,
  ];
  if (repair) {
    base.push(
      ``,
      `## THIS IS A REPAIR PASS - deterministic failure evidence from the runtime's own gates`,
      repair.evidence,
      ``,
      `Fix ONLY the demonstrated failure. Do not redesign. Do not replace a file that is already`,
      `correct.`,
    );
  }
  return base.filter((l) => l !== "").join("\n");
}

async function runCodexImplementationStage(
  ctx: CodexStageCtx,
): Promise<{ outcome: RealStageOutcome; premium: PremiumEscalationMeta }> {
  const { rt, step, task, agent, plan } = ctx;
  const risk = (step.risk_level ?? task.risk) as RiskLevel;
  const premium: PremiumEscalationMeta = {
    stage: "implementation",
    provider: "codex-cli",
    kind: "codex-cli",
    model: ctx.codexModel || "chatgpt-account-default",
    modelSource: ctx.codexModel ? "AI_COMPANY_PREMIUM_IMPL_MODEL" : "codex-cli-account-default",
    reason:
      "FREE_IMPLEMENTATION_QUALITY_BUDGET exhausted on both free proof models; Human Founder " +
      "authorized ONE premium escalation for the implementation stage only, via the Codex CLI " +
      "(ChatGPT login) - no paid OpenAI API",
    requests: 0,
    repairs: 0,
    outcome: "PREMIUM_IMPLEMENTATION_FAILED",
    detail: "codex implementation did not complete",
    tokenUsage: { input_tokens: null, output_tokens: null },
    codexTokensUsed: null,
    estimated_cost_usd: null,
    changedFiles: [],
  };

  const blockedOutcome = (modelStatus: string, notes: string[]): RealStageOutcome => ({
    execution: synthCodexExecution(ctx, "BLOCKED", premium.detail, notes),
    outcome: "BLOCKED",
    toolCalls: [],
    testEvidence: null,
    securityEvidence: null,
    attempts: premium.requests,
    contextBytes: 0,
    truncatedSections: [],
    modelStatus,
    enforcementNotes: notes,
    rateLimitWaits: [],
  });

  // 1. Live readiness - never reads auth material.
  const detection = await ctx.harness.detect();
  rt.audit.record({
    task: task.id,
    agent_id: agent.id,
    agent_role: agent.department,
    model: `codex-cli:${detection.version ?? "unknown"}`,
    action: `premium_escalation:${step.id}`,
    reason:
      `PREMIUM escalation authorized for stage '${step.id}' ONLY via the Codex CLI (ChatGPT login); ` +
      `codex available=${detection.available} loggedIn=${detection.loggedIn} version=${detection.version ?? "?"}; ` +
      `risk ${risk}; bounded to one primary run + one targeted repair; no free fallback on failure`,
    risk_level: risk,
    result: "PENDING",
  });
  ctx.emit(
    `\n${agent.title}\nPREMIUM_ESCALATION\nimplementation stage on ${ctx.codexLabel} ` +
      `(${detection.version ?? "codex"}; Human Founder authorized; bounded 1 run + 1 repair)`,
  );
  if (!detection.available || !detection.loggedIn) {
    premium.detail = `BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE: ${detection.reason}`;
    rt.audit.record({
      task: task.id,
      agent_id: agent.id,
      agent_role: agent.department,
      model: `codex-cli:${detection.version ?? "unknown"}`,
      action: `premium_escalation_failed:${step.id}`,
      reason: `Codex CLI not usable: ${detection.reason}; run STOPS (no free fallback, no retry)`,
      risk_level: risk,
      result: "BLOCKED",
    });
    return { outcome: blockedOutcome("PREMIUM_PROVIDER_UNAVAILABLE", [`blocked: ${premium.detail}`]), premium };
  }

  // 2 & 3. Bounded run + at most one targeted repair.
  let changedFiles: string[] = [];
  let gates: Awaited<ReturnType<typeof evaluateImplementationGates>> | null = null;
  let lastMessage = "";
  let lastStatus: import("../agents/codex-cli-harness.ts").CodexRunStatus = "CODEX_PROCESS_ERROR";
  for (let attempt = 0; attempt < 2; attempt++) {
    const isRepair = attempt === 1;
    const repairEvidence = isRepair
      ? {
          evidence: [
            `command: npm test (${(() => {
              try {
                return ctx.workspace.projectFacts().testCommand;
              } catch {
                return "the project test command";
              }
            })()})`,
            `outcome so far: ${gates?.outcome ?? "?"}`,
            `enforcement: ${gates?.enforcementNotes.join("; ") || "(none)"}`,
            gates?.testEvidence
              ? `npm test exit=${gates.testEvidence.exitCode} passing=${gates.testEvidence.passed} failing=${gates.testEvidence.failed}`
              : "npm test was not run",
            `test output (tail):\n${gates?.testStdoutTail ?? "(none)"}`,
            `files you changed: ${changedFiles.join(", ") || "(none)"}`,
          ].join("\n"),
        }
      : undefined;

    const prompt = buildCodexImplPrompt(ctx, repairEvidence);
    const cx = await ctx.harness.runImplementation({ workspaceRoot: ctx.workspace.root, prompt });
    premium.requests++;
    if (isRepair) premium.repairs++;
    lastMessage = cx.lastMessage;
    lastStatus = cx.status;
    premium.codexTokensUsed = parseCodexTokens(cx.stdoutTail) ?? premium.codexTokensUsed;

    rt.audit.record({
      task: task.id,
      agent_id: agent.id,
      agent_role: agent.department,
      model: `codex-cli:${detection.version ?? "unknown"}`,
      action: `premium_codex_exec:${step.id}${isRepair ? ":repair1" : ""}`,
      reason:
        `codex exec ${isRepair ? "repair pass" : "primary"} for stage '${step.id}': ` +
        `status=${cx.status} exit=${cx.exitCode} timedOut=${cx.timedOut} killedProcessTree=${cx.killedProcessTree} ` +
        `durationMs=${cx.durationMs}; invocation: ${cx.invocation}`,
      risk_level: risk,
      result: cx.status === "CODEX_SUCCESS" ? "PASS" : "FAIL",
      duration: cx.durationMs,
    });

    // Auth / approval problems are not "the model produced bad code" - they are
    // provider-unavailable and stop the run immediately (no repair).
    if (cx.status === "CODEX_AUTH_REQUIRED" || cx.status === "CODEX_APPROVAL_BLOCKED") {
      premium.detail = `BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE: codex exec returned ${cx.status} (${cx.stdoutTail.slice(-200)})`;
      rt.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `codex-cli:${detection.version ?? "unknown"}`,
        action: `premium_escalation_failed:${step.id}`,
        reason: `${premium.detail}; run STOPS (no free fallback, no retry)`,
        risk_level: risk,
        result: "BLOCKED",
      });
      return { outcome: blockedOutcome("PREMIUM_PROVIDER_UNAVAILABLE", [`blocked: ${premium.detail}`]), premium };
    }

    changedFiles = ctx.workspace.changedFilesSince(ctx.stageCheckpoint).filter((p) => !p.startsWith(".npm/"));
    premium.changedFiles = changedFiles;

    // 5. Scope check - only fixture-shaped paths may change.
    const outOfScope = changedFiles.filter((p) => !CODEX_ALLOWED_PATH.test(p));
    if (outOfScope.length > 0) {
      premium.detail = `codex changed files outside the implementation scope: ${outOfScope.join(", ")}`;
      rt.audit.record({
        task: task.id,
        agent_id: agent.id,
        agent_role: agent.department,
        model: `codex-cli:${detection.version ?? "unknown"}`,
        action: `premium_escalation_failed:${step.id}`,
        reason: premium.detail,
        risk_level: risk,
        result: "BLOCKED",
      });
      return { outcome: blockedOutcome("OUT_OF_SCOPE_CHANGE", [`blocked: ${premium.detail}`]), premium };
    }

    // 6. The runtime's own deterministic gates decide - Codex's claim is not evidence.
    gates = await evaluateImplementationGates({
      workspace: ctx.workspace,
      changedFiles,
      hadChangeAttempt: cx.status === "CODEX_SUCCESS" || changedFiles.length > 0,
      runTests: plan.runTests,
      runSecurityScan: plan.runSecurityScan,
      plan: {
        requireWorkspaceChange: plan.requireWorkspaceChange,
        requireTestChange: plan.requireTestChange,
        requireInSource: plan.requireInSource,
        restrictStatusTo: plan.restrictStatusTo,
      },
    });
    rt.audit.record({
      task: task.id,
      agent_id: agent.id,
      agent_role: agent.department,
      action: `qa_test_execution:${step.id}${isRepair ? ":repair1" : ""}`,
      reason: gates.testEvidence
        ? `npm test exit=${gates.testEvidence.exitCode} pass=${gates.testEvidence.passed} fail=${gates.testEvidence.failed}`
        : "npm test not run for this stage",
      risk_level: risk,
      result: gates.outcome === "PASS" ? "PASS" : "FAIL",
      capability: "shell.exec_sandbox",
      tool: "sandbox",
    });

    if (gates.outcome === "PASS") break;
    if (attempt === 1) break; // repair used
  }

  const g = gates!;
  premium.outcome = g.outcome === "PASS" ? "PASS" : "PREMIUM_IMPLEMENTATION_FAILED";
  // A CODEX_SUCCESS exit that changed nothing is a distinct, reportable case.
  const noChange = lastStatus === "CODEX_SUCCESS" && changedFiles.length === 0;
  premium.detail =
    g.outcome === "PASS"
      ? `Codex implementation PASSED every deterministic gate (codex ${lastStatus}, npm test exit ${g.testEvidence?.exitCode ?? "?"}, ${g.testEvidence?.passed ?? 0} passing); files: ${changedFiles.join(", ")}`
      : noChange
        ? `CODEX_NO_WORKSPACE_CHANGE: codex exec exited 0 but changed no files; gates: ${g.enforcementNotes.join("; ")}`
        : `Codex implementation did NOT clear the deterministic gates (codex ${lastStatus}): ${g.enforcementNotes.join("; ") || g.outcome}`;
  const returnedModelStatus = g.outcome === "PASS" ? "PASS" : noChange ? "CODEX_NO_WORKSPACE_CHANGE" : lastStatus;

  const toolCalls = changedFiles.map((p) => ({
    tool: "workspace.write",
    capability: "fs.write",
    decision: "ALLOW" as const,
    executed: true,
    detail: `wrote ${p} (via codex-cli)`,
  }));

  return {
    outcome: {
      execution: synthCodexExecution(ctx, g.outcome, lastMessage || premium.detail, g.enforcementNotes),
      outcome: g.outcome,
      toolCalls,
      testEvidence: g.testEvidence ? { ...g.testEvidence } : null,
      securityEvidence: g.securityChecks ? { checks: g.securityChecks } : null,
      attempts: premium.requests,
      contextBytes: 0,
      truncatedSections: [],
      modelStatus: returnedModelStatus,
      enforcementNotes: g.enforcementNotes,
      rateLimitWaits: [],
    },
    premium,
  };
}

function synthCodexExecution(
  ctx: CodexStageCtx,
  status: "PASS" | "FAIL" | "BLOCKED",
  summary: string,
  enforcement: string[],
): AgentExecutionResult {
  return {
    executionId: newId("exec"),
    agentId: ctx.agent.id,
    role: ctx.agent.title,
    taskId: ctx.task.id,
    workflowId: "feature-development",
    stage: ctx.step.id,
    status,
    summary: redactString(summary).slice(0, 600),
    reasoningSummary:
      "Implemented via the Codex CLI premium harness (ChatGPT login). The runtime's own " +
      "deterministic gates (npm test, workspace-change, test-discovery, /health source check) " +
      "decided the outcome - Codex's own claim of success is not sufficient evidence.",
    artifacts: [],
    fileChanges: [],
    recommendations: [],
    requestedToolCalls: [],
    handoff: status === "PASS" ? { to: "senior-code-reviewer", why: "implementation complete, ready for independent review" } : null,
    qualityEvidence: enforcement.map((n) => ({ check: "runtime-gate", result: /^blocked|^fail/i.test(n) ? "FAIL" : "PASS", detail: n } as const)),
    risks: [],
    errors: status === "PASS" ? [] : enforcement,
    usage: {
      provider: "codex-cli",
      model: ctx.codexModel || "chatgpt-account-default",
      real: true,
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      duration_ms: 0,
      request_number: 0,
    },
  };
}
