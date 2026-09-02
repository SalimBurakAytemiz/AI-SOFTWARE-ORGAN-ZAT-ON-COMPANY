import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyProofSensitivity, PROOF_ENVIRONMENT_LABEL } from "../src/proof/proof-sensitivity.ts";
import { doctor, probeRealProvider } from "../src/core/doctor.ts";
import { Runtime } from "../src/runtime.ts";
import { fixedClock } from "../src/core/clock.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";

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

test("doctor shows a founder-friendly 'Groq Direct proof provider' row (preferred, NOT_CONFIGURED without a key)", () => {
  const rt = Runtime.create({ storePath: ":memory:", clock: fixedClock("2026-09-01T00:00:00.000Z"), env: {} });
  try {
    const report = doctor(rt);
    const groqRow = report.checks.find((c) => c.name === "Groq Direct proof provider")!;
    assert.ok(groqRow, "expected a 'Groq Direct proof provider' row");
    assert.equal(groqRow.status, "NOT_CONFIGURED");
    assert.match(groqRow.detail, /GROQ_API_KEY/);
    assert.match(groqRow.detail, /preferred proof provider/);
    // Groq is the default selection, so it is ACTIVE.
    assert.match(groqRow.detail, /ACTIVE/);
    // OpenRouter row is still present as the optional fallback.
    const orRow = report.checks.find((c) => c.name === "OpenRouter proof provider")!;
    assert.match(orRow.detail, /optional fallback/);
    assert.equal(report.healthy, true);
  } finally {
    rt.close();
  }
});

test("doctor shows Groq Direct OK and ACTIVE when GROQ_API_KEY is present", () => {
  const rt = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b", GROQ_API_KEY: "gsk-fake-for-doctor" },
  });
  try {
    const report = doctor(rt);
    const groqRow = report.checks.find((c) => c.name === "Groq Direct proof provider")!;
    assert.equal(groqRow.status, "OK");
    assert.match(groqRow.detail, /Groq Direct proof/);
    assert.match(groqRow.detail, /openai\/gpt-oss-120b/);
    assert.match(groqRow.detail, /NON_SENSITIVE_PROOF_ONLY/);
    assert.match(groqRow.detail, /not an approved production provider/);
    assert.match(groqRow.detail, /ACTIVE/);
    assert.equal(rt.realProvider.ready, true);
  } finally {
    rt.close();
  }
});

test("doctor shows the free-first fallback chain: groq -> nvidia when NVIDIA_API_KEY is present, OPTIONAL otherwise", () => {
  const withNvidia = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", GROQ_API_KEY: "gsk-fake", NVIDIA_API_KEY: "nv-fake" },
  });
  try {
    const row = doctor(withNvidia).checks.find((c) => c.name === "proof provider fallback chain")!;
    assert.ok(row, "expected a fallback-chain row");
    assert.equal(row.status, "OK");
    assert.match(row.detail, /groq -> nvidia on RATE_LIMIT_EXHAUSTED/);
    assert.equal(withNvidia.realProviderChain.fallbacks.length, 1);
    assert.equal(withNvidia.realProviderChain.fallbacks[0]!.id, "nvidia");
  } finally {
    withNvidia.close();
  }

  const noNvidia = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", GROQ_API_KEY: "gsk-fake" },
  });
  try {
    const row = doctor(noNvidia).checks.find((c) => c.name === "proof provider fallback chain")!;
    assert.equal(row.status, "OPTIONAL");
    assert.equal(doctor(noNvidia).checks.some((c) => c.status === "FAIL"), false);
  } finally {
    noNvidia.close();
  }
});

test("probeRealProvider maps live Groq Direct health to OK / RATE_LIMITED / ERROR / NOT_CONFIGURED", async () => {
  const ok = await startFakeOpenAiServer({});
  const rtOk = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: ok.baseUrl, GROQ_API_KEY: "gsk-fake" },
  });
  try {
    const c = await probeRealProvider(rtOk);
    assert.equal(c.status, "OK");
    assert.match(c.name, /Groq Direct/);
    assert.equal(ok.requestCount(), 0, "the live probe must not POST a completion");
  } finally {
    rtOk.close();
    await ok.close();
  }

  const limited = await startFakeOpenAiServer({ modelsStatus: 429 });
  const rtLimited = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: limited.baseUrl, GROQ_API_KEY: "gsk-fake" },
  });
  try {
    assert.equal((await probeRealProvider(rtLimited)).status, "RATE_LIMITED");
  } finally {
    rtLimited.close();
    await limited.close();
  }

  const denied = await startFakeOpenAiServer({ modelsStatus: 403 });
  const rtDenied = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: denied.baseUrl, GROQ_API_KEY: "gsk-fake" },
  });
  try {
    assert.equal((await probeRealProvider(rtDenied)).status, "ERROR");
  } finally {
    rtDenied.close();
    await denied.close();
  }

  const rtNoKey = Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    env: { AI_COMPANY_REAL_PROVIDER: "groq" },
  });
  try {
    assert.equal((await probeRealProvider(rtNoKey)).status, "NOT_CONFIGURED");
  } finally {
    rtNoKey.close();
  }
});
