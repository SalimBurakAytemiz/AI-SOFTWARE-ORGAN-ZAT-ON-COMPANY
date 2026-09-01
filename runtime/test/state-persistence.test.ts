import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { Runtime } from "../src/runtime.ts";
import { fixedClock } from "../src/core/clock.ts";
import { tempDir } from "./helpers.ts";

test("a workflow run survives a full runtime restart and resumes from the correct step", async () => {
  const { dir, cleanup } = tempDir();
  const storePath = join(dir, "runtime.sqlite");
  const clock = fixedClock("2026-09-01T00:00:00Z");

  let runId: string;
  let approvalId: string;

  // --- session 1: drive to the approval gate, then drop the runtime ---
  {
    const rt = Runtime.create({ storePath, clock });
    const task = rt.orchestrator.tasks.create({
      title: "add GET /health",
      description: "small additive backend endpoint returning a static JSON body",
    });
    const { run } = rt.orchestrator.plan(task);
    const driven = await rt.orchestrator.drive(run.id);
    assert.equal(driven.run.status, "APPROVAL_REQUIRED");
    runId = driven.run.id;
    approvalId = driven.run.pending_approval_id!;
    rt.close();
  }

  // --- session 2: a brand new process. Restore, approve, resume ---
  {
    const rt = Runtime.create({ storePath, clock });
    const run = rt.workflows.getRun(runId);
    assert.equal(run.status, "APPROVAL_REQUIRED");
    assert.equal(run.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(run.pending_approval_id, approvalId);
    assert.equal(rt.approvals.get(approvalId)!.state, "PENDING");

    rt.approvals.approve(approvalId, "human-founder", "approved after restart");
    const resumed = await rt.orchestrator.resume(runId);
    assert.ok(resumed.run.history.some((h) => h.step_id === "production"));
    assert.ok(["COMPLETED", "RUNNING"].includes(resumed.run.status));
    rt.close();
  }

  cleanup();
});

test("the audit ledger persists across restarts and only grows", async () => {
  const { dir, cleanup } = tempDir();
  const storePath = join(dir, "runtime.sqlite");
  const clock = fixedClock("2026-09-01T00:00:00Z");

  const rt1 = Runtime.create({ storePath, clock });
  rt1.audit.record({ action: "probe", reason: "first", result: "PASS" });
  const countAfter1 = rt1.audit.list(1_000_000).length;
  rt1.close();

  const rt2 = Runtime.create({ storePath, clock });
  assert.equal(rt2.audit.list(1_000_000).length, countAfter1);
  rt2.audit.record({ action: "probe", reason: "second", result: "PASS" });
  assert.equal(rt2.audit.list(1_000_000).length, countAfter1 + 1);
  rt2.close();

  cleanup();
});
