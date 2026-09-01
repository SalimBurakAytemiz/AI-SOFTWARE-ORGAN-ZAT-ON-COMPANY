import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";
import { InvalidTransitionError } from "../src/core/errors.ts";

function bugfixTask(rt: ReturnType<typeof memoryRuntime>) {
  const task = rt.orchestrator.tasks.create({
    title: "fix the broken pagination bug",
    description: "the list endpoint returns incorrect behaviour on page 2; a reproducible defect",
  });
  return rt.orchestrator.plan(task);
}

test("a run starts on the first step and persists immediately", () => {
  const rt = memoryRuntime();
  try {
    const { run } = bugfixTask(rt);
    assert.equal(run.workflow_id, "bugfix");
    assert.equal(run.current_step, "triage");
    assert.deepEqual(rt.store.getRun(run.id)!.current_step, "triage");
  } finally {
    rt.close();
  }
});

test("submitting an outcome for the wrong owner is rejected", () => {
  const rt = memoryRuntime();
  try {
    const { run } = bugfixTask(rt);
    assert.throws(
      () => rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "backend-engineer", note: "x" }),
      InvalidTransitionError,
    );
  } finally {
    rt.close();
  }
});

test("a review step cannot be actioned by the implementer", async () => {
  const rt = memoryRuntime();
  try {
    const { run } = bugfixTask(rt);
    // Advance to the implement step deterministically.
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "incident-debug-engineer", note: "triaged" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "incident-debug-engineer", note: "reproduced" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "engineering-director", note: "severity" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "incident-debug-engineer", note: "root cause" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "engineering-director", note: "fix plan" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "backend-engineer", note: "implemented" });
    rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "backend-engineer", note: "self tested" });
    const cur = rt.workflows.step(rt.workflows.getRun(run.id));
    assert.equal(cur.id, "code_review");
    assert.throws(
      () => rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "backend-engineer", note: "self review" }),
      /owned by senior-code-reviewer/,
    );
  } finally {
    rt.close();
  }
});

test("a human_approval step parks the run and needs openApproval/resume", () => {
  const rt = memoryRuntime();
  try {
    const { run } = bugfixTask(rt);
    const order = [
      "incident-debug-engineer", "incident-debug-engineer", "engineering-director",
      "incident-debug-engineer", "engineering-director", "backend-engineer",
      "backend-engineer", "senior-code-reviewer", "test-automation-engineer",
      "qa-lead", "application-security-engineer", "devops-platform-engineer",
      "qa-lead", "release-manager",
    ];
    let r = rt.workflows.getRun(run.id);
    for (const owner of order) {
      const step = rt.workflows.step(r);
      r = rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: step.owner === owner ? owner : step.owner, note: step.id });
    }
    assert.equal(rt.workflows.step(r).id, "human_approval");
    assert.throws(
      () => rt.workflows.submitOutcome(run.id, { result: "PASS", byAgent: "human-founder", note: "x" }),
      /human_approval step/,
    );
    r = rt.workflows.openApproval(run.id, {
      impact: "x", tests_summary: "x", security_summary: "x", rollback_summary: "x", estimated_cost_usd: 0,
    });
    assert.equal(r.status, "APPROVAL_REQUIRED");
    assert.equal(r.project_state, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
  }
});
