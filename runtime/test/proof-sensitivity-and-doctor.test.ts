import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyProofSensitivity, PROOF_ENVIRONMENT_LABEL } from "../src/proof/proof-sensitivity.ts";
import { doctor } from "../src/core/doctor.ts";
import { Runtime } from "../src/runtime.ts";
import { fixedClock } from "../src/core/clock.ts";

test("benign feature tasks are permitted for non-sensitive proof execution", () => {
  const v = classifyProofSensitivity(
    "Add a GET /health endpoint",
    "Return 200 and { status: 'ok' } with tests and docs.",
  );
  assert.equal(v.allowed, true);
  assert.equal(v.classification, PROOF_ENVIRONMENT_LABEL);
});

test("tasks with PII / payment / production secrets are blocked", () => {
  for (const [title, desc] of [
    ["Export customer PII", "dump all customer personal data"],
    ["Migrate payment data", "move cardholder PAN and CVV records"],
    ["Rotate production secrets", "read the production api key and store it"],
    ["Analyse confidential production dataset", "load the confidential production records"],
  ] as const) {
    const v = classifyProofSensitivity(title, desc);
    assert.equal(v.allowed, false, `${title} should be blocked`);
    assert.ok(v.matched.length > 0);
  }
});

test("doctor reports the real/proof provider rows and never FAILs when unconfigured", () => {
  const rt = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: {}, // no real provider key
  });
  try {
    const report = doctor(rt);
    assert.equal(report.healthy, true);
    const names = report.checks.map((c) => c.name);
    assert.ok(names.includes("OpenAI-compatible provider"));
    assert.ok(names.some((n) => n.includes("OpenRouter proof provider")));
    const proofRow = report.checks.find((c) => c.name.includes("OpenRouter proof provider"))!;
    assert.equal(proofRow.status, "NOT_CONFIGURED");
    assert.equal(report.checks.some((c) => c.status === "FAIL"), false);
  } finally {
    rt.close();
  }
});

test("doctor shows the proof provider READY (and labelled) when a key is present", () => {
  const rt = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "fake-key-for-doctor-test" },
  });
  try {
    const report = doctor(rt);
    const proofRow = report.checks.find((c) => c.name.includes("OpenRouter proof provider"))!;
    assert.equal(proofRow.status, "OK");
    assert.match(proofRow.detail, /PROOF_PROVIDER/);
    assert.match(proofRow.detail, /NON_SENSITIVE_PROOF_ONLY/);
    assert.match(proofRow.detail, /not an approved production provider/);
    assert.equal(rt.realProvider.ready, true);
  } finally {
    rt.close();
  }
});
