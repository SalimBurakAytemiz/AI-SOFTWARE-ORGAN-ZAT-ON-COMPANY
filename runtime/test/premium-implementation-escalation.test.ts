import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider, resolvePremiumImplProvider, DEFAULT_PREMIUM_IMPL_MODEL } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";
import { OpenAICompatibleProvider } from "../src/models/openai-compatible-provider.ts";
import { ProviderQuotaExhaustedError } from "../src/core/errors.ts";
import { MODEL_TIERS } from "../src/core/types.ts";

/**
 * Runtime V1.1 - PREMIUM implementation escalation (Human Founder authorized ONE
 * paid escalation for the implementation stage only, 2026-09-02). All
 * deterministic: local fake OpenAI-compatible server, no network, no real key,
 * bounded. Every gate stays authoritative; the premium model's own output is
 * never sufficient evidence of success.
 */

const GKEY = "premium-free-fake-key-0123456789";
const OKEY = "premium-openai-fake-key-abcdef0123456789";

function groqDescriptor(baseUrl: string) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: GKEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
  }).descriptor!;
}

function premiumDescriptor(baseUrl: string, extra: Record<string, string> = {}) {
  const s = resolvePremiumImplProvider({
    AI_COMPANY_PREMIUM_IMPL_PROVIDER: "openai",
    AI_COMPANY_PREMIUM_IMPL_BASE_URL: baseUrl,
    OPENAI_API_KEY: OKEY,
    ...extra,
  });
  return s;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "premium-esc-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// 1. resolvePremiumImplProvider - authorization gating + secret hygiene.
// ---------------------------------------------------------------------------

test("premium provider: NOT authorized without the explicit env flag (never auto-selected)", () => {
  assert.equal(resolvePremiumImplProvider({}).authorized, false);
  assert.equal(resolvePremiumImplProvider({ OPENAI_API_KEY: OKEY }).authorized, false);
  assert.equal(resolvePremiumImplProvider({ AI_COMPANY_PREMIUM_IMPL_PROVIDER: "anthropic" }).authorized, false);
});

test("premium provider: authorized + ready with the flag and OPENAI_API_KEY; the key is only read by name", () => {
  const s = resolvePremiumImplProvider({ AI_COMPANY_PREMIUM_IMPL_PROVIDER: "openai", OPENAI_API_KEY: OKEY });
  assert.equal(s.authorized, true);
  assert.equal(s.ready, true);
  assert.equal(s.descriptor!.id, "openai");
  assert.equal(s.descriptor!.costTier, "PREMIUM");
  assert.equal(s.descriptor!.apiKeyEnv, "OPENAI_API_KEY");
  assert.equal(s.descriptor!.model, DEFAULT_PREMIUM_IMPL_MODEL);
  assert.equal(s.descriptor!.modelSource, "default-priority-list");
  assert.ok(!JSON.stringify(s.reason).includes(OKEY));
  assert.ok(!JSON.stringify(s.descriptor!.label).includes(OKEY));

  const explicit = resolvePremiumImplProvider({
    AI_COMPANY_PREMIUM_IMPL_PROVIDER: "openai",
    OPENAI_API_KEY: OKEY,
    AI_COMPANY_PREMIUM_IMPL_MODEL: "gpt-4.1",
  });
  assert.equal(explicit.descriptor!.model, "gpt-4.1");
  assert.equal(explicit.descriptor!.modelSource, "AI_COMPANY_PREMIUM_IMPL_MODEL");
});

test("premium provider: authorized but BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE without the key", () => {
  const s = resolvePremiumImplProvider({ AI_COMPANY_PREMIUM_IMPL_PROVIDER: "openai" });
  assert.equal(s.authorized, true);
  assert.equal(s.ready, false);
  assert.match(s.reason, /BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE/);
});

// ---------------------------------------------------------------------------
// 2. ProviderQuotaExhaustedError - billing 429 is non-retryable, not a rate limit.
// ---------------------------------------------------------------------------

test("OpenAI 429 insufficient_quota is classified as ProviderQuotaExhaustedError (non-retryable), not a rate limit", async () => {
  const srv = await startFakeOpenAiServer({ quotaExhausted: true });
  try {
    const p = new OpenAICompatibleProvider({
      name: "openai-premium-impl",
      baseUrl: srv.baseUrl,
      apiKeyEnv: "OPENAI_API_KEY",
      model: "gpt-4.1",
      maxRetries: 3,
      tokenParam: "max_completion_tokens",
      omitTemperature: true,
      env: { OPENAI_API_KEY: OKEY },
    });
    await assert.rejects(
      () => p.generate({ tier: MODEL_TIERS.find((t) => t !== "NO_AI")!, prompt: "hi", maxOutputTokens: 32 }),
      (e: unknown) => {
        assert.ok(e instanceof ProviderQuotaExhaustedError, `got ${(e as Error).name}`);
        assert.equal((e as ProviderQuotaExhaustedError).code, "PROVIDER_QUOTA_EXHAUSTED");
        assert.ok(!String((e as Error).message).includes(OKEY));
        return true;
      },
    );
    // Non-retryable: exactly one request was made despite maxRetries=3.
    assert.equal(srv.requestCount(), 1);
  } finally {
    await srv.close();
  }
});

// ---------------------------------------------------------------------------
// 3. End-to-end: premium used ONLY for implementation; other stages on free.
// ---------------------------------------------------------------------------

test("premium escalation: implementation runs on OpenAI, every other real stage on the free provider, chain reaches Human approval", async () => {
  const free = await startFakeOpenAiServer({ reportCost: 0, modelId: "groq/gpt-oss-fake" });
  const openai = await startFakeOpenAiServer({ reportCost: 0, modelId: "gpt-4.1" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(free.baseUrl),
      premiumImpl: { kind: "openai" as const, openaiDescriptor: premiumDescriptor(openai.baseUrl, { AI_COMPANY_PREMIUM_IMPL_MODEL: "gpt-4.1" }).descriptor! },
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    // Premium escalation recorded and PASSED every deterministic gate.
    assert.ok(result.premiumEscalation, "expected premiumEscalation to be set");
    assert.equal(result.premiumEscalation!.stage, "implementation");
    assert.equal(result.premiumEscalation!.provider, "openai-premium-impl");
    assert.equal(result.premiumEscalation!.model, "gpt-4.1");
    assert.equal(result.premiumEscalation!.outcome, "PASS");
    assert.ok(result.premiumEscalation!.requests >= 1 && result.premiumEscalation!.requests <= 2);

    // Only the implementation stage touched OpenAI; every other real stage the free server.
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    assert.equal(byStage.implementation!.providerId, "openai-premium");
    for (const s of ["business_analysis", "spec_review", "architecture", "plan", "code_review", "qa", "security", "release_review"]) {
      assert.notEqual(byStage[s]!.providerId, "openai-premium", `${s} must not use premium`);
    }
    assert.ok(openai.requestCount() >= 1 && openai.requestCount() <= 2, `openai got ${openai.requestCount()} requests`);
    assert.ok(free.requestCount() >= 8, `free got ${free.requestCount()} requests`);

    // Independent reviewer - the premium implementer does NOT review its own work.
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);
    assert.equal(byStage.code_review!.agentId, "senior-code-reviewer");

    // Every deterministic gate still ran and passed.
    assert.equal(byStage.implementation!.testEvidence!.exitCode, 0);
    assert.ok(byStage.implementation!.testEvidence!.passed >= 1);
    assert.ok(byStage.qa!.testEvidence);
    assert.ok(byStage.security!.securityEvidence && byStage.security!.securityEvidence.length >= 2);

    // Audit records the escalation + result, no key leaks.
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(audit.some((e) => e.action === "premium_escalation:implementation" && e.result === "PENDING"));
    assert.ok(audit.some((e) => e.action === "premium_escalation_result:implementation" && e.result === "PASS"));
    assert.ok(!JSON.stringify(audit).includes(OKEY));
    assert.ok(!JSON.stringify(audit).includes(GKEY));
    assert.ok(!JSON.stringify(result).includes(OKEY));
  } finally {
    rt.close();
    await free.close();
    await openai.close();
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 4. Premium quota/billing exhausted -> PREMIUM_IMPLEMENTATION_FAILED, STOP,
//    no free fallback, no premium retry, no further spend.
// ---------------------------------------------------------------------------

test("premium escalation: OpenAI credit exhausted -> PREMIUM_IMPLEMENTATION_FAILED, no free fallback, no retry", async () => {
  const free = await startFakeOpenAiServer({ reportCost: 0 });
  const openai = await startFakeOpenAiServer({ quotaExhausted: true });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(free.baseUrl),
      fallbackDescriptors: [],
      premiumImpl: { kind: "openai" as const, openaiDescriptor: premiumDescriptor(openai.baseUrl).descriptor! },
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.match(result.blockReason!, /PREMIUM_IMPLEMENTATION_FAILED/);
    assert.equal(result.stopped_because, "premium_provider_unavailable");
    assert.ok(result.premiumEscalation);
    assert.equal(result.premiumEscalation!.outcome, "PREMIUM_IMPLEMENTATION_FAILED");
    assert.match(result.premiumEscalation!.detail, /BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE/);

    // Non-retryable: OpenAI hit exactly once (no scheduler wait cycles, no burst).
    assert.equal(openai.requestCount(), 1, `openai got ${openai.requestCount()} requests`);
    // The implementation stage never fell back to the free provider.
    const implRealCalls = rt.audit
      .list(1_000_000)
      .filter((e) => e.task === result.task_id && e.action.startsWith("real_model_call:implementation"));
    assert.ok(!implRealCalls.some((e) => e.model.startsWith("groq")));
    assert.ok(!result.providerTransitions.some((tr) => tr.stage === "implementation"));

    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(audit.some((e) => e.action === "premium_escalation_failed:implementation"));
    assert.ok(!JSON.stringify(audit).includes(OKEY));
    assert.ok(!JSON.stringify(result).includes(OKEY));
    // No rate-limit scheduler waiting happened for a billing failure.
    assert.equal(result.rateLimitWaits.filter((w) => w.stage === "implementation").length, 0);
  } finally {
    rt.close();
    await free.close();
    await openai.close();
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 5. Premium produces bad code -> gates catch it -> STOP (no gate weakened).
// ---------------------------------------------------------------------------

test("premium escalation: premium output that fails a gate -> PREMIUM_IMPLEMENTATION_FAILED, no free fallback, bounded to 2 requests", async () => {
  const free = await startFakeOpenAiServer({ reportCost: 0 });
  // Premium writes source but never a discoverable test, on both the primary
  // attempt and the repair -> requireTestChange + npm-test-0-passing FAIL.
  const openai = await startFakeOpenAiServer({ reportCost: 0, implNoTest: true, modelId: "gpt-4.1" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(free.baseUrl),
      fallbackDescriptors: [groqDescriptor(free.baseUrl)],
      premiumImpl: { kind: "openai" as const, openaiDescriptor: premiumDescriptor(openai.baseUrl).descriptor! },
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.equal(result.stopped_because, "premium_implementation_failed");
    assert.ok(result.premiumEscalation);
    assert.equal(result.premiumEscalation!.outcome, "PREMIUM_IMPLEMENTATION_FAILED");

    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.equal(impl.providerId, "openai-premium");
    assert.notEqual(impl.outcome, "PASS");
    assert.ok(impl.enforcement!.some((n) => /test/i.test(n)), impl.enforcement!.join(" | "));

    // Bounded: one primary attempt + at most one targeted test-repair (<= 2 premium requests).
    assert.ok(openai.requestCount() <= 2, `openai got ${openai.requestCount()} requests`);

    // No free fallback for the premium implementation stage.
    assert.ok(!result.providerTransitions.some((tr) => tr.stage === "implementation"));
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(!audit.some((e) => e.action === "provider_transition:implementation"));
    assert.ok(!JSON.stringify(audit).includes(OKEY));
  } finally {
    rt.close();
    await free.close();
    await openai.close();
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 6. No premium descriptor -> unchanged free-only behaviour.
// ---------------------------------------------------------------------------

test("no premium descriptor: the implementation stage stays on the free chain (premium never auto-engaged)", async () => {
  const free = await startFakeOpenAiServer({ reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(free.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.premiumEscalation, null);
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.notEqual(impl.providerId, "openai-premium");
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    await free.close();
    t.cleanup();
  }
});
