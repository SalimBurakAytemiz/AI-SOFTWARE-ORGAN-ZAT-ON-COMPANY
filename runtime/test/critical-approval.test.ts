import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";

// Build spec section 34: the workflow reaches production deployment, an approval is
// required, the workflow stops, a rejection prevents the action, and only an
// explicit Human Founder approval lets the (simulated) deployment step proceed.

async function toApprovalGate(rt: ReturnType<typeof memoryRuntime>) {
  const task = rt.orchestrator.tasks.create({
    title: "add GET /health",
    description: "a small additive backend endpoint returning a static JSON body",
  });
  const { run } = rt.orchestrator.plan(task);
  const driven = await rt.orchestrator.drive(run.id);
  assert.equal(driven.run.status, "APPROVAL_REQUIRED", "run must stop at the approval gate");
  assert.equal(driven.run.project_state, "HUMAN_APPROVAL_REQUIRED");
  const approval = rt.approvals.get(driven.run.pending_approval_id!)!;
  assert.equal(approval.requested_action, "production_deployment");
  assert.equal(approval.state, "PENDING");
  return { runId: driven.run.id, approvalId: approval.id };
}

test("REJECT: a rejected production deployment never executes", async () => {
  const rt = memoryRuntime();
  try {
    const { runId, approvalId } = await toApprovalGate(rt);
    rt.approvals.reject(approvalId, "human-founder", "not this release");
    const resumed = await rt.orchestrator.resume(runId);
    assert.equal(resumed.run.status, "REJECTED");
    assert.equal(
      resumed.run.history.some((h) => h.step_id === "production" && h.result === "PASS"),
      false,
      "no production step may have executed",
    );
    // The audit trail shows the rejection and no production deployment PASS.
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("approval_rejected")));
    assert.equal(audit.some((e) => e.action === "workflow_step:feature-development.production" && e.result === "PASS"), false);
  } finally {
    rt.close();
  }
});

test("APPROVE: only after explicit Human Founder approval does the simulated deployment proceed", async () => {
  const rt = memoryRuntime();
  try {
    const { runId, approvalId } = await toApprovalGate(rt);

    // An agent attempting to approve is refused.
    assert.throws(() => rt.approvals.approve(approvalId, "release-manager"), /NOT_HUMAN_FOUNDER/);
    // The run is still parked; the production step has not run.
    assert.equal(rt.workflows.getRun(runId).status, "APPROVAL_REQUIRED");

    rt.approvals.approve(approvalId, "human-founder", "approved for release");
    const resumed = await rt.orchestrator.resume(runId);

    assert.ok(
      resumed.run.history.some((h) => h.step_id === "production" && h.result === "PASS"),
      "the simulated production step proceeds after approval",
    );
    const prodEvent = rt.audit
      .list(1_000_000)
      .find((e) => e.action === "workflow_step:feature-development.production");
    assert.ok(prodEvent);
    assert.equal(prodEvent!.approved_by, "human-founder");
  } finally {
    rt.close();
  }
});
