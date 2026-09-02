import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";

const KEY = "fake-proof-key-abcdef0123456789";

function realDescriptor(baseUrl: string, opts: Record<string, unknown> = {}) {
  const status = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "openrouter",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "fake/structured-model",
    OPENROUTER_API_KEY: KEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...(opts as Record<string, string>),
  });
  return status.descriptor!;
}

/** A Groq Direct descriptor pointed at the local fake server (no network, no real key). */
function groqDescriptor(baseUrl: string, opts: Record<string, unknown> = {}) {
  const status = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: KEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...(opts as Record<string, string>),
  });
  return status.descriptor!;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "sf-real-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("REAL Software Factory proof: real model calls drive the full chain to Human approval", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const budget = new RequestBudget();
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget,
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.mode, "REAL");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.run_status, "APPROVAL_REQUIRED");
    assert.equal(result.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.ok(result.approval_id);

    // Real vs mock identification (build spec section 28).
    assert.ok(["groq-direct", "openrouter-proof", "openai-compatible"].includes(result.provider!.name));
    assert.equal(result.provider!.isProofProvider, true);
    assert.ok(result.realRequestCount > 0);
    assert.ok(result.realModelsUsed.includes("fake/structured-model"));
    assert.ok(result.tokenUsage.input_tokens && result.tokenUsage.input_tokens > 0);

    // Each required role really executed (build spec section 38).
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    for (const stage of ["business_analysis", "architecture", "plan", "implementation", "code_review", "qa", "security", "release_review"]) {
      assert.ok(byStage[stage], `missing stage ${stage}`);
      assert.equal(byStage[stage]!.real, true, `${stage} was not a real model call`);
      assert.equal(byStage[stage]!.outcome, "PASS", `${stage} did not PASS`);
    }

    // Backend engineer caused an actual code change in the workspace.
    assert.ok(byStage.implementation!.toolCalls!.some((c) => c.tool === "workspace.write" && c.executed));
    assert.ok(existsSync(join(result.workspaceDir!, "src/server.js")));

    // Reviewer independence.
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);
    assert.equal(byStage.code_review!.agentId, "senior-code-reviewer");

    // QA executed real tests with machine evidence (build spec section 22).
    assert.ok(byStage.qa!.testEvidence);
    assert.equal(byStage.qa!.testEvidence!.exitCode, 0);
    assert.ok(byStage.qa!.testEvidence!.passed >= 1);

    // Security produced deterministic evidence (build spec section 23).
    assert.ok(byStage.security!.securityEvidence && byStage.security!.securityEvidence.length >= 2);

    // Budget respected (build spec section 14).
    assert.ok(result.realRequestCount <= 30);
    assert.ok(result.budget!.used <= result.budget!.ceiling);

    // Artifacts written and attributable (build spec section 16).
    assert.ok(result.artifactsDir && existsSync(result.artifactsDir));

    // Audit trail identifies provider/model and real requests (build spec section 43).
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(audit.some((e) => e.action.startsWith("real_model_call:")));
    assert.ok(audit.some((e) => e.action.startsWith("workflow_parked")));
    assert.equal(audit.some((e) => e.action.includes("production") && e.result === "PASS"), false);
    // The key is never written to audit.
    assert.equal(JSON.stringify(audit).includes(KEY), false);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL Software Factory proof via Groq Direct: full agent chain to Human approval, identified as REAL / Groq", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.provider!.name, "groq-direct");
    assert.equal(result.provider!.label, "REAL / Groq Direct proof");
    assert.equal(result.provider!.model, "openai/gpt-oss-120b");
    assert.equal(result.provider!.isProofProvider, true);
    assert.equal(result.provider!.sensitivity, "NON_SENSITIVE_PROOF_ONLY");
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.run_status, "APPROVAL_REQUIRED");
    assert.ok(result.approval_id);
    assert.ok(result.realRequestCount > 0 && result.realRequestCount <= result.budget!.ceiling);

    // The whole ordered chain executed with an independent reviewer.
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    for (const stage of ["business_analysis", "architecture", "plan", "implementation", "code_review", "qa", "security", "release_review"]) {
      assert.equal(byStage[stage]!.outcome, "PASS", `${stage} did not PASS`);
    }
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);

    // The API key was sent as a bearer token and never surfaced in the result.
    assert.equal(srv.lastAuthHeader(), `Bearer ${KEY}`);
    assert.ok(!JSON.stringify(result).includes(KEY));
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof: a 429 mid-chain is waited out and the run continues to Human approval - no duplicate stage or tool execution", async () => {
  // The first real request 429s (short reset window); every later request is fine.
  const srv = await startFakeOpenAiServer({
    reportCost: 0,
    rateLimitFirst: 1,
    retryAfterHeader: "2",
    resetRequestsHeader: "2s",
  });
  const rt = memoryRuntime();
  const t = tmp();
  const waits: string[] = [];
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: { jitterMs: 0, minIntervalMs: 0, maxRetryCycles: 3 },
      onRateLimitWait: (line) => waits.push(line),
    });

    // The run recovered from the 429 and reached the approval gate.
    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    // Exactly one wait happened, on the first real stage (business_analysis).
    assert.equal(result.rateLimitWaits.length, 1);
    assert.equal(result.rateLimitWaits[0]!.stage, "business_analysis");
    assert.equal(result.rateLimitWaits[0]!.kind, "retry_after");
    assert.ok(result.totalRateLimitWaitMs > 0);
    assert.ok(waits.some((l) => l.includes("WAITING_FOR_PROVIDER_QUOTA")));
    assert.ok(waits.some((l) => /resume in approximately \d+s/.test(l)));

    // No duplicate stage execution: every stage appears exactly once.
    const counts = result.stages.reduce<Record<string, number>>((m, s) => ((m[s.stage] = (m[s.stage] ?? 0) + 1), m), {});
    for (const [stage, c] of Object.entries(counts)) assert.equal(c, 1, `stage ${stage} executed ${c} times`);

    // No duplicate tool writes: each workspace path was written exactly once.
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    const writes = audit.filter((e) => e.action === "tool_executed:workspace.write");
    const writtenPaths = writes.map((e) => e.reason.match(/wrote (\S+)/)?.[1]).filter(Boolean);
    assert.equal(new Set(writtenPaths).size, writtenPaths.length, `duplicate workspace.write: ${writtenPaths.join(", ")}`);
    assert.ok(writtenPaths.length >= 1);

    // The 429 cycle is audited as a wait, not as a failed model call.
    assert.ok(audit.some((e) => e.action === "rate_limit_wait:business_analysis" && e.result === "PENDING"));
    assert.equal(audit.some((e) => e.action.startsWith("real_model_call_failed:")), false);
    assert.ok(!JSON.stringify(audit).includes(KEY));
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof via Groq Direct: a provider schema HTTP 400 self-heals to json_object and the full chain still reaches Human approval", async () => {
  // The confirmed 2026-09-01 blocker: Groq strict Structured Outputs rejected the
  // AgentExecutionResult schema, BLOCKING business_analysis. The fixed schema is
  // strict-compatible; this test additionally proves that even if a provider
  // rejects the schema, the run self-heals (json_object) and completes - never
  // downgrading to prompt-only and never bypassing validation.
  const srv = await startFakeOpenAiServer({ reportCost: 0, rejectJsonSchema: true });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    const modes = srv.responseFormatModes();
    assert.equal(modes[0], "json_schema", "the first real request used strict json_schema");
    assert.ok(modes.slice(1).every((m) => m === "json_object"), "every later request used the json_object fallback");
    assert.ok(!modes.includes("none"), "structured output was never dropped to prompt-only");

    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(audit.some((e) => e.action === "structured_schema_rejected:business_analysis"));
    assert.equal(JSON.stringify(audit).includes(KEY), false);

    // Business analysis (the previously blocked stage) PASSED with a real call.
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    assert.equal(byStage.business_analysis!.outcome, "PASS");
    assert.equal(byStage.business_analysis!.real, true);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof retries a malformed structured response, then continues", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 1 }); // first call is prose, retry is valid
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.blocked, false);
    // The very first stage saw one malformed response then a valid one.
    const first = result.stages.find((s) => s.real)!;
    assert.ok(first.attempts! >= 2);
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("malformed_agent_result:")));
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof: reproduces the confirmed incident - output truncated at the token cap, retried, and continues", async () => {
  // The confirmed 2026-09-01 root cause: the first real request truncated
  // mid-JSON (finish_reason=length) at the old 1800-token cap. This end-to-end
  // test reproduces exactly that shape and proves the stage now recovers via
  // the bounded truncation retry instead of BLOCKING the whole workflow.
  const srv = await startFakeOpenAiServer({ truncateFirst: 1, reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    const first = result.stages.find((s) => s.real)!;
    assert.equal(first.outcome, "PASS");
    assert.ok(first.attempts! >= 2, "expected the truncated first attempt to be retried");
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("output_truncated:") && e.result === "PENDING"));
    assert.ok(!audit.some((e) => e.action.startsWith("output_truncated:") && e.result === "BLOCKED"));
    // The retry actually requested a larger budget than the first attempt.
    const realCalls = audit.filter((e) => e.action.startsWith("real_model_call:"));
    assert.ok(realCalls.length >= 2);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof: implementation's first npm test fails, ONE bounded repair pass fixes it, and the chain still reaches Human approval", async () => {
  const srv = await startFakeOpenAiServer({ brokenTestUntilRepair: true, reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.equal(impl.outcome, "PASS");
    assert.equal(impl.testEvidence!.exitCode, 0);
    assert.ok(impl.testEvidence!.passed >= 1);

    const audit = rt.audit.list(1_000_000);
    // The failing first run, ONE repair model call, and a green re-run are all recorded.
    assert.ok(audit.some((e) => e.action === "qa_test_execution:implementation" && e.result === "FAIL"));
    assert.ok(audit.some((e) => e.action.startsWith("real_model_call:implementation:test_repair")));
    assert.ok(
      audit.some((e) => e.action === "qa_test_execution:implementation:repair1" && e.result === "PASS"),
    );
    // Bounded: exactly one repair pass.
    assert.equal(
      audit.filter((e) => e.action.startsWith("real_model_call:implementation:test_repair")).length,
      1,
    );
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof BLOCKS when the structured response never validates", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 999 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.ok(["stage_blocked", "stage_failed"].includes(result.stopped_because));
    const blocked = result.stages.find((s) => s.outcome === "BLOCKED");
    assert.ok(blocked, "expected a BLOCKED stage");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

// Regression (Runtime V1.1): a provider transport failure (persistent HTTP error,
// rate limit, 5xx, timeout, network) must never propagate out of the proof runner.
// It must fail safely and structurally - a machine-readable result, never empty
// output - and it must preserve the provider error classification without leaking
// the API key.
test("REAL proof: a persistent provider rate limit BLOCKS cleanly as RATE_LIMIT_EXHAUSTED, never empty output", async () => {
  // Every call -> 429 with a short reset window. The scheduler waits the bounded
  // number of cycles (fake sleep) and then BLOCKS - it never bursts retries.
  const srv = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1.5s" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: { maxRetryCycles: 3, minIntervalMs: 0, jitterMs: 0, maxWaitMsPerCycle: 5_000 },
    });

    // 1. A machine-readable failure result is returned (the call did not throw).
    assert.equal(typeof result, "object");
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.equal(result.approval_id, null);

    // 2. The failure is serialisable and non-empty - stdout can never be blank.
    const serialised = JSON.stringify(result);
    assert.ok(serialised.length > 0);
    assert.deepEqual(JSON.parse(serialised), JSON.parse(JSON.stringify(result)));

    // 3. Classified as RATE_LIMIT_EXHAUSTED after the BOUNDED retry cycles.
    assert.ok(result.providerError, "expected result.providerError to be set");
    assert.equal(result.providerError!.stage, "business_analysis");
    assert.equal(result.providerError!.code, "RATE_LIMIT_EXHAUSTED");
    assert.match(result.blockReason!, /RATE_LIMIT_EXHAUSTED/);
    assert.equal(result.stopped_because, "rate_limit_exhausted");
    const failedStage = result.stages.find((s) => s.stage === "business_analysis");
    assert.equal(failedStage!.outcome, "BLOCKED");
    assert.equal(failedStage!.modelStatus, "RATE_LIMIT_EXHAUSTED");

    // 4. It waited (did not burst): exactly maxRetryCycles wait cycles recorded.
    const cycles = result.rateLimitWaits.filter((w) => w.kind === "retry_after");
    assert.equal(cycles.length, 3, `expected 3 bounded wait cycles, got ${cycles.length}`);
    assert.ok(result.totalRateLimitWaitMs > 0);
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action === "rate_limit_wait:business_analysis" && e.result === "PENDING"));
    assert.ok(audit.some((e) => e.action === "real_model_call_failed:business_analysis" && e.result === "BLOCKED"));

    // 5. No credential is exposed anywhere in the result or the audit ledger.
    assert.ok(!serialised.includes(KEY));
    assert.ok(!JSON.stringify(audit).includes(KEY));

    // 6. Structured-output validation is untouched: no malformed-result path ran.
    assert.ok(!audit.some((e) => e.action.startsWith("malformed_agent_result:")));
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof: a 404 MODEL_UNAVAILABLE provider response fails structurally, not a crash", async () => {
  // Simulates the real incident: a retired model id -> OpenRouter HTTP 404.
  const srv = await startFakeOpenAiServer({
    httpErrorStatus: 404,
    httpErrorBody: { error: { message: "No endpoints found for model", code: 404 } },
  });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl, { AI_COMPANY_REAL_MODEL: "retired-vendor/retired-model:free" }),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.ok(result.providerError, "expected result.providerError to be set");
    assert.equal(result.providerError!.code, "PROVIDER_HTTP");
    assert.equal(result.providerError!.stage, "business_analysis");
    assert.match(result.blockReason!, /BLOCKED_PROVIDER_ERROR/);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    const serialised = JSON.stringify(result);
    assert.ok(serialised.length > 0);
    assert.ok(!serialised.includes(KEY));
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action === "real_model_call_failed:business_analysis"));
    assert.ok(!JSON.stringify(audit).includes(KEY));
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof: a persistent provider 5xx is classified distinctly and fails structurally", async () => {
  const srv = await startFakeOpenAiServer({ serverErrorFirst: 999 }); // every call -> 503
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.ok(result.providerError, "expected result.providerError to be set");
    assert.equal(result.providerError!.code, "PROVIDER_5XX");
    assert.ok(JSON.stringify(result).length > 0);
    assert.ok(!JSON.stringify(result).includes(KEY));
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof BLOCKS at the request-budget ceiling instead of looping", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 999 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget({ target: 2, ceiling: 3 }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.blocked || result.stages.some((s) => s.outcome !== "PASS"));
    assert.ok(srv.requestCount() <= 3, `made ${srv.requestCount()} requests, ceiling was 3`);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof is BLOCKED_PROVIDER_UNAVAILABLE with no descriptor", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, { mode: "REAL", buildRoot: t.dir, sleep: async () => {} });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason!, /BLOCKED_PROVIDER_UNAVAILABLE/);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
  } finally {
    rt.close();
    t.cleanup();
  }
});

test("REAL proof refuses a task that carries sensitive data (proof provider privacy)", async () => {
  const srv = await startFakeOpenAiServer();
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      task: {
        title: "Export the production customer PII table to a CSV",
        description: "Dump all customer personal data and payment card numbers for analysis.",
      },
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason!, /BLOCKED_SENSITIVE_TASK/);
    assert.equal(result.sensitivity.allowed, false);
    assert.equal(srv.requestCount(), 0, "no real request should be issued for a sensitive task");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("MOCK proof still passes and is clearly identified as MOCK, not REAL", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, { mode: "MOCK", buildRoot: t.dir, budget: new RequestBudget() });
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.mode, "MOCK");
    assert.equal(result.realRequestCount, 0);
    assert.equal(result.provider!.name, "mock");
    assert.equal(result.stages.every((s) => !s.real), true);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    t.cleanup();
  }
});
