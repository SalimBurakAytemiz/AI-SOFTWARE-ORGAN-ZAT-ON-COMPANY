import { join } from "node:path";
import type { Runtime } from "../runtime.ts";
import type { ModelProvider } from "../models/provider.ts";
import { MockModelProvider } from "../models/mock-provider.ts";
import { RUNTIME_ROOT, paths } from "../config/paths.ts";
import { RealAgentRunner, type StagePlan } from "../agents/real-agent-runner.ts";
import { ProofWorkspace } from "./proof-workspace.ts";
import { ProofArtifactStore } from "./artifact-store.ts";
import { RequestBudget, type BudgetSnapshot } from "./request-budget.ts";
import { classifyProofSensitivity, type SensitivityVerdict } from "./proof-sensitivity.ts";
import type { RealProviderDescriptor } from "../models/real-provider.ts";
import type { AgentExecutionResult } from "../agents/agent-execution-result.ts";

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

const PLANS: Record<string, StagePlan> = {
  spec_review: analysisPlan(),
  business_analysis: analysisPlan(),
  architecture: analysisPlan(),
  plan: analysisPlan(),
  implementation: {
    allowedRuntimeTools: ["workspace.read", "workspace.list", "workspace.write", "workspace.patch", "workspace.exec"],
    includeWorkspaceFiles: true,
    includeWorkspaceDiff: true,
    runTests: true,
    runSecurityScan: false,
    requireWorkspaceChange: true,
    requireInSource: "/health",
  },
  code_review: {
    allowedRuntimeTools: ["workspace.read", "workspace.list"],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: false,
    runSecurityScan: false,
    requireWorkspaceChange: false,
  },
  qa: {
    allowedRuntimeTools: ["workspace.read", "workspace.list", "workspace.exec"],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: true,
    runSecurityScan: false,
    requireWorkspaceChange: false,
  },
  security: {
    allowedRuntimeTools: ["workspace.read", "workspace.list", "workspace.exec"],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: true,
    runTests: false,
    runSecurityScan: true,
    requireWorkspaceChange: false,
  },
  release_review: {
    ...analysisPlan(),
    restrictStatusTo: ["READY_FOR_HUMAN_APPROVAL", "BLOCKED"],
  },
};

function analysisPlan(): StagePlan {
  return {
    allowedRuntimeTools: [],
    includeWorkspaceFiles: false,
    includeWorkspaceDiff: false,
    runTests: false,
    runSecurityScan: false,
    requireWorkspaceChange: false,
  };
}

export interface SoftwareFactoryStageReport {
  stage: string;
  agentId: string;
  role: string;
  real: boolean;
  modelBacked: boolean;
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
  /** REAL mode: the configured real provider descriptor. */
  descriptor?: RealProviderDescriptor;
  /** Override the build root (defaults to <runtime>/build). */
  buildRoot?: string;
  budget?: RequestBudget;
  task?: { title: string; description: string };
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

  if (isReal) {
    if (!opts.descriptor) {
      return blockedResult("REAL", "BLOCKED_PROVIDER_UNAVAILABLE: no real provider configured", sensitivity, null);
    }
    providerMeta = {
      label: opts.descriptor.label,
      name: opts.descriptor.provider.name,
      baseUrl: opts.descriptor.baseUrl,
      model: opts.descriptor.model,
      isProofProvider: opts.descriptor.isProofProvider,
      sensitivity: opts.descriptor.sensitivity,
    };
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

  const task = rt.orchestrator.tasks.create({
    title: taskDef.title,
    description: taskDef.description,
    project: "runtime-proof-v1.1",
  });
  const { run } = rt.orchestrator.plan(task);
  const wf = rt.registries.workflows.get(run.workflow_id);

  const workspace = new ProofWorkspace({
    buildRoot,
    taskId: task.id,
    seedFrom: join(paths.fixtures, "demo-service"),
  });
  const artifacts = new ProofArtifactStore({ buildRoot, taskId: task.id, clock: rt.clock });

  const runner = new RealAgentRunner(
    rt.registries,
    provider,
    providerMeta!.label,
    rt.gateway,
    rt.cost,
    rt.observability,
    rt.audit,
  );

  const stages: SoftwareFactoryStageReport[] = [];
  const priorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[] = [];
  const realModels = new Set<string>();
  let current = rt.workflows.getRun(run.id);
  let stoppedBecause = "completed";
  let ok = true;

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
      const outcome = await runner.runStage({
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
        stoppedBecause = outcome.outcome === "BLOCKED" ? "stage_blocked" : "stage_failed";
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

  const providerUsage = provider.usage();
  const costSummary = rt.cost.summary();

  ok =
    ok &&
    reachedApproval &&
    reviewerIndependent &&
    stages.every((s) => s.outcome === "PASS") &&
    (isReal ? budget.count > 0 && budget.count <= budget.ceiling : true);

  const assertion = ok
    ? `${opts.mode} PASS: the ${isReal ? "real" : "mock"} agent chain executed ` +
      `${isReal ? realModels.size + " model(s), " + budget.count + " request(s), " : ""}` +
      `every gate PASSED, the reviewer was independent, and the run STOPPED at ` +
      `HUMAN_APPROVAL_REQUIRED with a pending approval. No production action occurred.`
    : `${opts.mode} FAIL: stopped_because=${stoppedBecause} reachedApproval=${reachedApproval} ` +
      `reviewerIndependent=${reviewerIndependent} requests=${budget.count}`;

  return {
    ok,
    mode: opts.mode,
    blocked: false,
    blockReason: null,
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
