import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";
import { RuntimePausedError } from "../src/core/errors.ts";

test("pause blocks task planning and execution; resume restores it", async () => {
  const rt = memoryRuntime();
  try {
    const task = rt.orchestrator.tasks.create({
      title: "add GET /health",
      description: "a small additive backend endpoint returning static JSON",
    });
    const { run } = rt.orchestrator.plan(task);

    rt.control.pause("kill switch test");
    assert.equal(rt.control.isPaused(), true);
    await assert.rejects(() => rt.orchestrator.drive(run.id), RuntimePausedError);

    const task2 = rt.orchestrator.tasks.create({ title: "x", description: "another additive endpoint" });
    assert.throws(() => rt.orchestrator.plan(task2), RuntimePausedError);

    rt.control.resume();
    assert.equal(rt.control.isPaused(), false);
    const driven = await rt.orchestrator.drive(run.id);
    assert.equal(driven.run.status, "APPROVAL_REQUIRED");
  } finally {
    rt.close();
  }
});

test("pause still allows status, audit reads and analysis", () => {
  const rt = memoryRuntime();
  try {
    rt.control.pause("reason");
    assert.doesNotThrow(() => rt.audit.list(10));
    assert.doesNotThrow(() => rt.orchestrator.tasks.list());
    const read = rt.gateway.authorize({
      agentId: "engineering-director", capability: "github.read", action: "read",
      taskId: "t", risk: 0, reason: "read during pause",
    });
    assert.equal(read.allowed, true);
  } finally {
    rt.close();
  }
});

test("an ordinary agent cannot lift the global pause", () => {
  // There is no runtime API that lets an agent id clear the pause flag; only
  // RuntimeControl (driven by the CLI as the Human Founder) can.
  const rt = memoryRuntime();
  try {
    rt.control.pause("reason");
    const keys = Object.keys(rt.gateway) as string[];
    assert.equal(keys.includes("resume"), false);
    assert.equal(keys.includes("pause"), false);
    assert.equal(rt.control.isPaused(), true);
  } finally {
    rt.close();
  }
});
