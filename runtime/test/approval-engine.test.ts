import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";
import { fixedClock } from "../src/core/clock.ts";
import { ApprovalEngine } from "../src/approvals/approval-engine.ts";
import { AuditLog } from "../src/audit/audit-log.ts";
import { SqliteStore } from "../src/state/sqlite-store.ts";

function engine() {
  const clock = fixedClock("2026-09-01T00:00:00Z");
  const store = new SqliteStore(":memory:");
  const audit = new AuditLog(store, clock);
  return { eng: new ApprovalEngine(store, audit, clock), clock, store };
}

const input = {
  task_id: "task_1",
  run_id: "run_1",
  workflow_id: "feature-development",
  step_id: "human_approval",
  requested_by: "release-manager",
  requested_action: "production_deployment",
  reason: "deploy the health endpoint",
  risk_level: 5 as const,
  impact: "customer-facing",
  environment: "production",
  tests_summary: "all pass",
  security_summary: "pass",
  rollback_summary: "documented",
  estimated_cost_usd: 0,
};

test("a new request is PENDING", () => {
  const { eng } = engine();
  const req = eng.request(input);
  assert.equal(req.state, "PENDING");
});

test("only 'human-founder' may approve; an agent id is rejected", () => {
  const { eng } = engine();
  const req = eng.request(input);
  assert.throws(() => eng.approve(req.id, "release-manager"), /NOT_HUMAN_FOUNDER/);
  assert.throws(() => eng.approve(req.id, "engineering-director"), /NOT_HUMAN_FOUNDER/);
  assert.equal(eng.get(req.id)!.state, "PENDING");
});

test("the Human Founder can approve a pending request once", () => {
  const { eng } = engine();
  const req = eng.request(input);
  const approved = eng.approve(req.id, "human-founder", "looks good");
  assert.equal(approved.state, "APPROVED");
  assert.equal(approved.decided_by, "human-founder");
  assert.throws(() => eng.approve(req.id, "human-founder"), /APPROVAL_STATE/);
});

test("a rejected request cannot then be approved", () => {
  const { eng } = engine();
  const req = eng.request(input);
  eng.reject(req.id, "human-founder", "not now");
  assert.equal(eng.get(req.id)!.state, "REJECTED");
  assert.throws(() => eng.approve(req.id, "human-founder"), /APPROVAL_STATE/);
});

test("a request past its TTL auto-expires and cannot be approved", () => {
  const { eng, clock } = engine();
  const req = eng.request({ ...input, ttl_ms: 1000 });
  clock.advance(5000);
  assert.equal(eng.get(req.id)!.state, "EXPIRED");
  assert.throws(() => eng.approve(req.id, "human-founder"), /APPROVAL_STATE/);
});

test("runtime approval flow: proof run parks then the Founder approves", async () => {
  const rt = memoryRuntime();
  try {
    const task = rt.orchestrator.tasks.create({
      title: "add GET /health",
      description: "small additive backend endpoint returning static JSON",
    });
    const { run } = rt.orchestrator.plan(task);
    const driven = await rt.orchestrator.drive(run.id);
    assert.equal(driven.run.status, "APPROVAL_REQUIRED");
    const approvalId = driven.run.pending_approval_id!;
    assert.ok(approvalId);

    // An agent cannot decide it.
    assert.throws(() => rt.approvals.approve(approvalId, "release-manager"), /NOT_HUMAN_FOUNDER/);

    rt.approvals.approve(approvalId, "human-founder", "ship it");
    const resumed = await rt.orchestrator.resume(driven.run.id);
    assert.ok(["COMPLETED", "RUNNING"].includes(resumed.run.status));
    assert.ok(resumed.run.history.some((h) => h.step_id === "production"));
  } finally {
    rt.close();
  }
});
