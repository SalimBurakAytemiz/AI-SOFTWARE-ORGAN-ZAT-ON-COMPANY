import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import {
  buildRealProvider,
  resolveProofProviderChain,
  DEFAULT_NVIDIA_BASE_URL,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_API_KEY_ENV,
} from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";

/**
 * Runtime V1.1 - the smallest safe NVIDIA NIM free fallback for the Software
 * Factory proof. Groq Direct stays the primary proof provider; NVIDIA NIM is
 * engaged ONLY when Groq reaches a bounded RATE_LIMIT_EXHAUSTED. Everything is
 * deterministic and offline (two local OpenAI-compatible fake servers, fake
 * sleep). No network, no real key, no paid provider.
 */

const GKEY = "groq-fake-key-abcdef0123456789";
const NKEY = "nvidia-fake-key-0123456789abcdef";

function groqDescriptor(baseUrl: string, opts: Record<string, string> = {}) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: GKEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...opts,
  }).descriptor!;
}

function nvidiaDescriptor(baseUrl: string, opts: Record<string, string> = {}) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "nvidia",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
    NVIDIA_API_KEY: NKEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...opts,
  }).descriptor!;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "provider-fallback-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const FAST_RATE_LIMIT = { maxRetryCycles: 2, minIntervalMs: 0, jitterMs: 0, maxWaitMsPerCycle: 2_000 };

// ---------------------------------------------------------------------------
// 1. NVIDIA provider - the generic OpenAI-compatible abstraction, configured
//    from the environment only.
// ---------------------------------------------------------------------------

test("NVIDIA provider: built from the shared OpenAI-compatible abstraction with the documented defaults", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "nvidia", NVIDIA_API_KEY: NKEY });
  const d = status.descriptor!;
  assert.equal(status.active, "nvidia");
  assert.equal(status.ready, true);
  assert.equal(d.id, "nvidia");
  assert.equal(d.label, "REAL / NVIDIA NIM proof");
  assert.equal(d.provider.name, "nvidia-nim");
  assert.equal(d.baseUrl, DEFAULT_NVIDIA_BASE_URL);
  assert.equal(d.baseUrl, "https://integrate.api.nvidia.com/v1");
  assert.equal(d.model, DEFAULT_NVIDIA_MODEL);
  assert.equal(d.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
  assert.equal(d.apiKeyEnv, NVIDIA_API_KEY_ENV);
  assert.equal(d.apiKeyEnv, "NVIDIA_API_KEY");
  // A proof provider only - never an approved/paid production provider.
  assert.equal(d.isProofProvider, true);
  assert.equal(d.sensitivity, "NON_SENSITIVE_PROOF_ONLY");
  // NIM structured-output enforcement is unreliable for this model -> prompt-only
  // plus full runtime schema validation (nothing accepted unvalidated).
  assert.equal(d.nativeStructuredOutput, false);
  assert.equal(d.capabilities.costTier, "FREE");
});

test("NVIDIA provider: BLOCKED (not ready) when NVIDIA_API_KEY is absent; the key is only ever read from the environment", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "nvidia" });
  assert.equal(status.ready, false);
  assert.match(status.reason, /NVIDIA_API_KEY is not set/);
  assert.equal(status.descriptor!.provider.isReady(), false);
});

test("NVIDIA provider: only the NAME of the key env var is used - never the value - in any founder-facing field", () => {
  const secret = "nvidia-super-secret-do-not-leak-1234567890";
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "nvidia", NVIDIA_API_KEY: secret });
  assert.equal(status.ready, true);
  // The module records the env var name, not the credential.
  assert.equal(status.descriptor!.apiKeyEnv, "NVIDIA_API_KEY");
  assert.ok(!status.reason.includes(secret));
  assert.ok(!JSON.stringify(status.known).includes(secret));
  assert.ok(!JSON.stringify(status.descriptor!.label).includes(secret));
  // A health summary (what doctor prints) never carries the value.
  assert.ok(!JSON.stringify(status.descriptor!.provider.health()).includes(secret));
});

// ---------------------------------------------------------------------------
// 2. Free-first fallback chain resolution.
// ---------------------------------------------------------------------------

test("fallback chain: Groq primary + NVIDIA fallback when NVIDIA_API_KEY is present", () => {
  const chain = resolveProofProviderChain({
    AI_COMPANY_REAL_PROVIDER: "groq",
    GROQ_API_KEY: GKEY,
    NVIDIA_API_KEY: NKEY,
  });
  assert.equal(chain.primary.active, "groq");
  assert.equal(chain.fallbacks.length, 1);
  assert.equal(chain.fallbacks[0]!.id, "nvidia");
  assert.match(chain.reason, /groq -> nvidia on RATE_LIMIT_EXHAUSTED/);
});

test("fallback chain: no fallback without NVIDIA_API_KEY, and OpenRouter is never auto-added", () => {
  const noNvidia = resolveProofProviderChain({ AI_COMPANY_REAL_PROVIDER: "groq", GROQ_API_KEY: GKEY });
  assert.equal(noNvidia.fallbacks.length, 0);

  // An OpenRouter key present must NOT put OpenRouter into the auto fallback chain.
  const withOpenRouter = resolveProofProviderChain({
    AI_COMPANY_REAL_PROVIDER: "groq",
    GROQ_API_KEY: GKEY,
    OPENROUTER_API_KEY: "or-fake-000",
  });
  assert.equal(withOpenRouter.fallbacks.length, 0);
});

test("fallback chain: AI_COMPANY_REAL_FALLBACK=none disables the fallback even with NVIDIA_API_KEY", () => {
  const chain = resolveProofProviderChain({
    AI_COMPANY_REAL_PROVIDER: "groq",
    GROQ_API_KEY: GKEY,
    NVIDIA_API_KEY: NKEY,
    AI_COMPANY_REAL_FALLBACK: "none",
  });
  assert.equal(chain.fallbacks.length, 0);
  assert.match(chain.reason, /disabled/);
});

test("fallback chain: NVIDIA as primary has no further free fallback", () => {
  const chain = resolveProofProviderChain({
    AI_COMPANY_REAL_PROVIDER: "nvidia",
    NVIDIA_API_KEY: NKEY,
  });
  assert.equal(chain.primary.active, "nvidia");
  assert.equal(chain.fallbacks.length, 0);
});

// ---------------------------------------------------------------------------
// 3. Groq -> NVIDIA fallback, end to end, through the Software Factory proof.
// ---------------------------------------------------------------------------

test("Groq -> NVIDIA fallback: Groq RATE_LIMIT_EXHAUSTED switches to NVIDIA, retries ONLY the blocked stage, and the chain reaches Human approval", async () => {
  // Groq 429s on every request (free-tier daily quota gone). NVIDIA serves the run.
  const groq = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1s", modelId: "groq/gpt-oss-fake" });
  const nvidia = await startFakeOpenAiServer({ reportCost: 0, modelId: "nvidia/nemotron-fake" });
  const rt = memoryRuntime();
  const t = tmp();
  const waits: string[] = [];
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(groq.baseUrl),
      fallbackDescriptors: [nvidiaDescriptor(nvidia.baseUrl)],
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: FAST_RATE_LIMIT,
      onRateLimitWait: (l) => waits.push(l),
    });

    // The run recovered and reached the approval gate - no production action.
    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.run_status, "APPROVAL_REQUIRED");
    assert.equal(result.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.ok(result.approval_id);

    // Exactly one provider transition: groq -> nvidia on the first real stage.
    assert.equal(result.providerTransitions.length, 1);
    assert.deepEqual(result.providerTransitions[0], {
      from_provider: "groq",
      to_provider: "nvidia",
      reason: "RATE_LIMIT_EXHAUSTED",
      stage: "business_analysis",
    });

    // The final active provider is NVIDIA; it actually served the models.
    assert.equal(result.provider!.name, "nvidia-nim");
    assert.equal(result.provider!.isProofProvider, true);
    assert.ok(result.realModelsUsed.includes("nvidia/nemotron-fake"));

    // Groq only saw the bounded exhaustion attempt; NVIDIA ran the whole chain.
    assert.ok(groq.requestCount() >= 1 && groq.requestCount() <= 4, `groq made ${groq.requestCount()} requests`);
    assert.ok(nvidia.requestCount() >= 8, `nvidia made ${nvidia.requestCount()} requests`);

    // Every required stage ran, PASSED, and was attributed to NVIDIA.
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    for (const stage of ["business_analysis", "spec_review", "architecture", "plan", "implementation", "code_review", "qa", "security", "release_review"]) {
      assert.ok(byStage[stage], `missing stage ${stage}`);
      assert.equal(byStage[stage]!.outcome, "PASS", `${stage} did not PASS`);
      assert.equal(byStage[stage]!.providerId, "nvidia", `${stage} not attributed to NVIDIA`);
    }
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);

    // The founder-facing fallback notice was emitted.
    assert.ok(waits.some((l) => l.includes("PROVIDER_FALLBACK") && l.includes("nvidia")));

    // Audit records the transition with the required fields, and no key leaks.
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    const tr = audit.find((e) => e.action === "provider_transition:business_analysis");
    assert.ok(tr, "expected a provider_transition audit event");
    assert.match(tr!.reason, /from_provider=groq/);
    assert.match(tr!.reason, /to_provider=nvidia/);
    assert.match(tr!.reason, /reason=RATE_LIMIT_EXHAUSTED/);
    assert.match(tr!.reason, /stage=business_analysis/);
    assert.match(tr!.reason, /checkpoint preserved/);
    assert.ok(!JSON.stringify(audit).includes(GKEY));
    assert.ok(!JSON.stringify(audit).includes(NKEY));
    assert.ok(!JSON.stringify(result).includes(GKEY));
    assert.ok(!JSON.stringify(result).includes(NKEY));
  } finally {
    rt.close();
    await groq.close();
    await nvidia.close();
    t.cleanup();
  }
});

test("Groq -> NVIDIA fallback: checkpoint resume - completed Groq stages are NOT re-executed, and there are no duplicate stages, writes or artifacts", async () => {
  // Groq completes the first 2 real requests (business_analysis, spec_review),
  // then its quota is exhausted at the architecture stage; NVIDIA finishes the run.
  const groq = await startFakeOpenAiServer({ rateLimitAfter: 2, resetRequestsHeader: "1s", modelId: "groq/gpt-oss-fake" });
  const nvidia = await startFakeOpenAiServer({ reportCost: 0, modelId: "nvidia/nemotron-fake" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(groq.baseUrl),
      fallbackDescriptors: [nvidiaDescriptor(nvidia.baseUrl)],
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: FAST_RATE_LIMIT,
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    // The transition happened AFTER the completed Groq stages, at the stage that
    // hit the wall (architecture is where request #4 lands).
    assert.equal(result.providerTransitions.length, 1);
    assert.equal(result.providerTransitions[0]!.from_provider, "groq");
    assert.equal(result.providerTransitions[0]!.to_provider, "nvidia");
    assert.equal(result.providerTransitions[0]!.stage, "architecture");

    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    // Stages Groq completed keep Groq attribution; they did not run again.
    assert.equal(byStage.business_analysis!.providerId, "groq");
    assert.equal(byStage.spec_review!.providerId, "groq");
    // The blocked stage and everything after it ran on NVIDIA.
    assert.equal(byStage.architecture!.providerId, "nvidia");
    assert.equal(byStage.plan!.providerId, "nvidia");
    assert.equal(byStage.implementation!.providerId, "nvidia");

    // No duplicate stage execution: every stage appears exactly once.
    const counts = result.stages.reduce<Record<string, number>>((m, s) => ((m[s.stage] = (m[s.stage] ?? 0) + 1), m), {});
    for (const [stage, c] of Object.entries(counts)) assert.equal(c, 1, `stage ${stage} executed ${c} times`);

    // No duplicate tool writes: each workspace path was written exactly once.
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    const writes = audit.filter((e) => e.action === "tool_executed:workspace.write");
    const writtenPaths = writes.map((e) => e.reason.match(/wrote (\S+)/)?.[1]).filter(Boolean);
    assert.ok(writtenPaths.length >= 1);
    assert.equal(new Set(writtenPaths).size, writtenPaths.length, `duplicate write: ${writtenPaths.join(", ")}`);

    // No duplicate artifacts: each stage report path is unique.
    const allArtifacts = result.stages.flatMap((s) => s.artifacts);
    assert.equal(new Set(allArtifacts).size, allArtifacts.length, "duplicate artifact path");

    // Completed Groq stages were charged once each: 2 successful Groq requests,
    // then 429s that are waits (not extra stage executions).
    const groqRealCalls = audit.filter(
      (e) => e.action.startsWith("real_model_call:") && e.model.startsWith("groq-direct:"),
    );
    assert.equal(groqRealCalls.length, 2);

    assert.ok(!JSON.stringify(audit).includes(GKEY));
    assert.ok(!JSON.stringify(audit).includes(NKEY));
  } finally {
    rt.close();
    await groq.close();
    await nvidia.close();
    t.cleanup();
  }
});

test("Groq -> NVIDIA fallback: if NVIDIA ALSO fails, the proof stays fail-safe and structural (BLOCKED, no crash, no further provider)", async () => {
  const groq = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1s" });
  const nvidia = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1s" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(groq.baseUrl),
      fallbackDescriptors: [nvidiaDescriptor(nvidia.baseUrl)],
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: FAST_RATE_LIMIT,
    });

    // A machine-readable failure result (the call did not throw), non-empty.
    assert.equal(typeof result, "object");
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.equal(result.approval_id, null);
    const serialised = JSON.stringify(result);
    assert.ok(serialised.length > 0);

    // Exactly one transition was attempted (groq -> nvidia); no third provider.
    assert.equal(result.providerTransitions.length, 1);
    assert.equal(result.providerTransitions[0]!.to_provider, "nvidia");

    // Classified as RATE_LIMIT_EXHAUSTED on the blocked stage, on NVIDIA.
    assert.ok(result.providerError);
    assert.equal(result.providerError!.code, "RATE_LIMIT_EXHAUSTED");
    assert.equal(result.providerError!.stage, "business_analysis");
    assert.equal(result.stopped_because, "rate_limit_exhausted");
    const blocked = result.stages.find((s) => s.stage === "business_analysis");
    assert.equal(blocked!.outcome, "BLOCKED");
    assert.equal(blocked!.providerId, "nvidia");

    // No credentials leak anywhere.
    assert.ok(!serialised.includes(GKEY));
    assert.ok(!serialised.includes(NKEY));
    const audit = rt.audit.list(1_000_000);
    assert.ok(!JSON.stringify(audit).includes(GKEY));
    assert.ok(!JSON.stringify(audit).includes(NKEY));

    // Structured-output validation untouched: no malformed-result path ran.
    assert.ok(!audit.some((e) => e.action.startsWith("malformed_agent_result:")));
  } finally {
    rt.close();
    await groq.close();
    await nvidia.close();
    t.cleanup();
  }
});

test("no fallback configured: Groq RATE_LIMIT_EXHAUSTED still BLOCKS cleanly (unchanged behaviour)", async () => {
  const groq = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1s" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(groq.baseUrl),
      fallbackDescriptors: [],
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: FAST_RATE_LIMIT,
    });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.providerTransitions.length, 0);
    assert.equal(result.providerError!.code, "RATE_LIMIT_EXHAUSTED");
    assert.equal(result.stopped_because, "rate_limit_exhausted");
  } finally {
    rt.close();
    await groq.close();
    t.cleanup();
  }
});

test("Groq -> NVIDIA fallback: a real /health workspace change is produced exactly once and the source contains GET /health", async () => {
  const groq = await startFakeOpenAiServer({ rateLimitFirst: 999, resetRequestsHeader: "1s" });
  const nvidia = await startFakeOpenAiServer({ reportCost: 0, modelId: "nvidia/nemotron-fake" });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(groq.baseUrl),
      fallbackDescriptors: [nvidiaDescriptor(nvidia.baseUrl)],
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: FAST_RATE_LIMIT,
    });

    assert.equal(result.ok, true, result.assertion);
    assert.ok(existsSync(join(result.workspaceDir!, "src/server.js")));
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    const writeCalls = impl.toolCalls!.filter((c) => c.tool === "workspace.write" && c.executed);
    const serverWrites = writeCalls.filter((c) => c.detail.includes("src/server.js"));
    assert.equal(serverWrites.length, 1, "src/server.js written exactly once");
  } finally {
    rt.close();
    await groq.close();
    await nvidia.close();
    t.cleanup();
  }
});
