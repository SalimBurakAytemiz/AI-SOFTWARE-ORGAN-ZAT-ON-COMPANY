import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";
import { runProof } from "../src/proof/proof.ts";

test("the proof workflow routes, hands off, gates, audits and STOPS at Human approval", async () => {
  const rt = memoryRuntime();
  try {
    const result = await runProof(rt);

    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.workflow_id, "feature-development");
    assert.equal(result.run_status, "APPROVAL_REQUIRED");
    assert.equal(result.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.ok(result.approval_id);

    // Routing + hand-off: the chain runs through distinct specialist roles.
    const owners = result.executions.map((e) => e.agent_id);
    assert.ok(owners.includes("product-manager"));
    assert.ok(owners.includes("solution-architect"));
    assert.ok(owners.includes("backend-engineer"));
    assert.ok(owners.includes("senior-code-reviewer"));
    assert.ok(owners.includes("qa-lead"));
    assert.ok(owners.includes("application-security-engineer"));
    assert.ok(owners.includes("release-manager"));

    // Reviewer independence.
    const impl = result.executions.find((e) => e.step_id === "implementation")!;
    const review = result.executions.find((e) => e.step_id === "code_review")!;
    assert.notEqual(impl.agent_id, review.agent_id);
    assert.equal(review.agent_id, "senior-code-reviewer");

    // Every gate passed.
    assert.ok(result.executions.every((e) => e.outcome === "PASS"));

    // Audit: a started event, gate events, and the park event exist.
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("workflow_started")));
    assert.ok(audit.some((e) => e.action.startsWith("workflow_parked")));
    assert.ok(audit.some((e) => e.action.startsWith("tool_request:")));

    // No production action occurred.
    assert.equal(audit.some((e) => e.action.includes("production") && e.result === "PASS"), false);
  } finally {
    rt.close();
  }
});

test("the proof leaves a pending approval a human can inspect and decide", async () => {
  const rt = memoryRuntime();
  try {
    const result = await runProof(rt);
    const approval = rt.approvals.get(result.approval_id!)!;
    assert.equal(approval.state, "PENDING");
    assert.equal(approval.risk_level, 5);
    assert.ok(approval.impact.length > 0);
    assert.ok(approval.rollback_summary.length > 0);
  } finally {
    rt.close();
  }
});
