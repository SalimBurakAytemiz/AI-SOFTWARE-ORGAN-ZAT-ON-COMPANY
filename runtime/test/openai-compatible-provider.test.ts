import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAICompatibleProvider } from "../src/models/openai-compatible-provider.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";

const KEY = "fake-key-do-not-log-1234567890abcdef";

function provider(baseUrl: string, extra: Record<string, unknown> = {}) {
  return new OpenAICompatibleProvider({
    name: "test-openai-compatible",
    baseUrl,
    apiKeyEnv: "TEST_PROVIDER_KEY",
    model: "test/model",
    timeoutMs: 1000,
    maxRetries: 2,
    retryBackoffMs: 5,
    env: { TEST_PROVIDER_KEY: KEY },
    isProofProvider: true,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    ...extra,
  });
}

test("provider is NOT_CONFIGURED when the API key env var is unset", () => {
  const p = new OpenAICompatibleProvider({
    name: "x",
    baseUrl: "https://example.invalid/v1",
    apiKeyEnv: "DEFINITELY_UNSET_KEY_VAR",
    model: "m",
    env: {},
  });
  assert.equal(p.isReady(), false);
  assert.equal(p.health().status, "NOT_CONFIGURED");
  assert.match(p.health().detail, /DEFINITELY_UNSET_KEY_VAR/);
});

test("provider health is OK and marks the proof provider", () => {
  const p = provider("http://127.0.0.1:1/v1");
  assert.equal(p.isReady(), true);
  const h = p.health();
  assert.equal(h.status, "OK");
  assert.match(h.detail, /PROOF_PROVIDER/);
  assert.match(h.detail, /NON_SENSITIVE_PROOF_ONLY/);
  assert.ok(!h.tiers.includes("NO_AI"));
});

test("generate() returns text + usage and records request count", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  try {
    const p = provider(srv.baseUrl);
    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (business_analysis)", system: "agent id: business-analyst" });
    assert.ok(r.text.length > 0);
    assert.equal(r.usage.input_tokens, 800);
    assert.equal(r.usage.output_tokens, 200);
    assert.equal(r.estimated_cost_usd, 0);
    assert.equal(p.requestCount(), 1);
    assert.equal(p.usage().input_tokens, 800);
  } finally {
    await srv.close();
  }
});

test("the API key is sent as a bearer token and never appears in errors", async () => {
  const srv = await startFakeOpenAiServer();
  try {
    const p = provider(srv.baseUrl);
    await p.generate({ tier: "STANDARD_CODING", prompt: "hello" });
    assert.equal(srv.lastAuthHeader(), `Bearer ${KEY}`);

    // Force an error and confirm the key is not in the message.
    const bad = provider("http://127.0.0.1:59999/v1", { maxRetries: 0, timeoutMs: 300 });
    await assert.rejects(
      () => bad.generate({ tier: "STANDARD_CODING", prompt: "hi" }),
      (err: Error) => {
        assert.ok(!err.message.includes(KEY), "key leaked into error message");
        return true;
      },
    );
  } finally {
    await srv.close();
  }
});

test("429 responses are retried and then succeed within maxRetries", async () => {
  const srv = await startFakeOpenAiServer({ rateLimitFirst: 2 });
  try {
    const p = provider(srv.baseUrl); // maxRetries 2 => 3 tries total
    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (qa)" });
    assert.ok(r.text.length > 0);
    assert.equal(srv.requestCount(), 3);
  } finally {
    await srv.close();
  }
});

test("429 that never clears eventually throws PROVIDER_RATE_LIMITED", async () => {
  const srv = await startFakeOpenAiServer({ rateLimitFirst: 99 });
  try {
    const p = provider(srv.baseUrl, { maxRetries: 1 });
    await assert.rejects(
      () => p.generate({ tier: "STANDARD_CODING", prompt: "x" }),
      /PROVIDER_RATE_LIMITED/,
    );
  } finally {
    await srv.close();
  }
});

test("5xx responses are retried, then throw PROVIDER_5XX if persistent", async () => {
  const srv = await startFakeOpenAiServer({ serverErrorFirst: 1 });
  try {
    const ok = provider(srv.baseUrl);
    const r = await ok.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (security)" });
    assert.ok(r.text.length > 0);
  } finally {
    await srv.close();
  }
  const srv2 = await startFakeOpenAiServer({ serverErrorFirst: 99 });
  try {
    const p = provider(srv2.baseUrl, { maxRetries: 1 });
    await assert.rejects(() => p.generate({ tier: "STANDARD_CODING", prompt: "x" }), /PROVIDER_5XX/);
  } finally {
    await srv2.close();
  }
});

test("a hanging endpoint triggers the client timeout", async () => {
  const srv = await startFakeOpenAiServer({ hang: true });
  try {
    const p = provider(srv.baseUrl, { timeoutMs: 150, maxRetries: 0 });
    await assert.rejects(() => p.generate({ tier: "STANDARD_CODING", prompt: "x" }), /PROVIDER_TIMEOUT/);
  } finally {
    await srv.close();
  }
});

test("buildRealProvider defaults to the OpenRouter proof config and is blocked without a key", () => {
  const status = buildRealProvider({});
  assert.ok(status.descriptor);
  assert.equal(status.ready, false);
  assert.match(status.reason, /OPENROUTER_API_KEY/);
  assert.equal(status.descriptor!.isProofProvider, true);
  assert.equal(status.descriptor!.sensitivity, "NON_SENSITIVE_PROOF_ONLY");
  assert.match(status.descriptor!.baseUrl, /openrouter\.ai/);
});

test("buildRealProvider can be disabled entirely", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "disabled" });
  assert.equal(status.descriptor, null);
  assert.equal(status.ready, false);
});

test("buildRealProvider accepts a generic OpenAI-compatible base URL and key var", () => {
  const status = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "openai-compatible",
    AI_COMPANY_REAL_BASE_URL: "https://my-gateway.example/v1",
    AI_COMPANY_REAL_MODEL: "some/model",
    AI_COMPANY_REAL_API_KEY_ENV: "MY_GATEWAY_KEY",
    MY_GATEWAY_KEY: "x",
  });
  assert.ok(status.descriptor);
  assert.equal(status.ready, true);
  assert.equal(status.descriptor!.apiKeyEnv, "MY_GATEWAY_KEY");
  assert.equal(status.descriptor!.label, "REAL / OpenAI-compatible");
});
