import type { Runtime } from "../runtime.ts";
import type { StepExecution } from "../agents/agent-runner.ts";

export interface ProofResult {
  ok: boolean;
  task_id: string;
  workflow_id: string;
  run_id: string;
  run_status: string;
  project_state: string | null;
  stopped_because: string;
  approval_id: string | null;
  executions: { step_id: string; agent_id: string; model_tier: string; outcome: string }[];
  assertion: string;
}

/**
 * The one safe proof workflow (build spec section 33). A disposable local task -
 * "Add a simple GET /health endpoint to the demo service" - is classified,
 * routed, and driven through the feature-development lifecycle: product ->
 * analysis -> architecture -> design -> implementation -> self test -> independent
 * review -> automated tests -> QA -> security -> staging -> release review ->
 * HUMAN_APPROVAL_REQUIRED, where it stops. It proves routing, hand-off,
 * permissions, workflow transitions, state persistence, quality gates, audit and
 * the approval stop - not that a mock model is a real developer.
 */
export async function runProof(rt: Runtime): Promise<ProofResult> {
  const task = rt.orchestrator.tasks.create({
    title: "Add a GET /health endpoint to the demo service",
    description:
      "Add a simple GET /health endpoint returning {status:'ok'} to the disposable demo service. " +
      "A small additive backend endpoint that returns a static JSON body.",
    project: "runtime-proof",
  });

  const { run, classification } = rt.orchestrator.plan(task);
  const result = await rt.orchestrator.drive(run.id);

  const executions = result.executions.map((e: StepExecution) => ({
    step_id: e.step_id,
    agent_id: e.agent_id,
    model_tier: e.model_tier,
    outcome: e.outcome,
  }));

  const reachedApproval =
    result.run.status === "APPROVAL_REQUIRED" &&
    result.run.project_state === "HUMAN_APPROVAL_REQUIRED" &&
    Boolean(result.run.pending_approval_id);

  const reviewerIndependent = (() => {
    const impl = result.executions.find((e) => e.step_id === "implementation");
    const review = result.executions.find((e) => e.step_id === "code_review");
    return Boolean(impl && review && impl.agent_id !== review.agent_id);
  })();

  const ok =
    classification.workflow_id === "feature-development" &&
    reachedApproval &&
    reviewerIndependent &&
    executions.every((e) => e.outcome === "PASS");

  return {
    ok,
    task_id: task.id,
    workflow_id: classification.workflow_id,
    run_id: result.run.id,
    run_status: result.run.status,
    project_state: result.run.project_state,
    stopped_because: result.stoppedBecause,
    approval_id: result.run.pending_approval_id,
    executions,
    assertion: ok
      ? "PASS: the workflow routed correctly, the reviewer was independent, every gate " +
        "passed, and the run STOPPED at HUMAN_APPROVAL_REQUIRED with a pending approval. " +
        "No production action occurred."
      : `FAIL: workflow=${classification.workflow_id} status=${result.run.status} ` +
        `state=${result.run.project_state} reviewerIndependent=${reviewerIndependent}`,
  };
}
