import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime, runTask } from "./helpers.ts";
import { validateAgainst } from "../src/config/schema-validator.ts";

test("every audit event validates against audit-event.schema.json", async () => {
  const rt = memoryRuntime();
  try {
    await runTask(rt, "add GET /health, a small additive backend endpoint returning static JSON");
    const events = rt.audit.list(1_000_000);
    assert.ok(events.length > 10);
    for (const e of events) {
      const result = validateAgainst("audit-event.schema.json", e);
      assert.equal(result.valid, true, `${e.action}: ${result.errors.join(", ")}`);
    }
  } finally {
    rt.close();
  }
});

test("secrets are redacted from audit records", () => {
  const rt = memoryRuntime();
  try {
    // Synthetic non-secret strings that still match the redaction patterns.
    const fakeGh = "ghp_" + "x".repeat(36);
    const fakeKey = "sk-" + "x".repeat(24);
    rt.audit.record({
      action: "probe",
      reason: `token is ${fakeGh} in this text`,
      result: "PASS",
      error: `password="xxxxxxxx" and api_key=${fakeKey}`,
    });
    const last = rt.audit.list(1_000_000).at(-1)!;
    assert.equal(last.reason.includes(fakeGh), false);
    assert.match(last.reason, /\[REDACTED\]/);
    assert.match(last.error ?? "", /\[REDACTED\]/);
  } finally {
    rt.close();
  }
});

test("cost is recorded honestly; unconfigured budgets report NOT_CONFIGURED", async () => {
  const rt = memoryRuntime();
  try {
    await runTask(rt, "add GET /health, a small additive backend endpoint returning static JSON");
    const summary = rt.cost.summary();
    assert.equal(summary.budgets_configured, false);
    assert.ok(Object.values(summary.budgets).every((v) => v === "NOT_CONFIGURED"));
    assert.ok(summary.calls > 0);
    // The mock provider genuinely costs zero; nothing is invented.
    assert.equal(summary.total_known_cost_usd, 0);
  } finally {
    rt.close();
  }
});

test("an unknown provider cost is stored as null, never a placeholder number", () => {
  const rt = memoryRuntime();
  try {
    const rec = rt.cost.record({ provider: "future", model: "future-x", estimated_cost_usd: null });
    assert.equal(rec.estimated_cost_usd, null);
    assert.equal(rec.cost_known, false);
  } finally {
    rt.close();
  }
});
