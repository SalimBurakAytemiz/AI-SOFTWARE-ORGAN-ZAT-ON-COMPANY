import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAICompatibleProvider } from "../src/models/openai-compatible-provider.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { RateLimitError } from "../src/core/errors.ts";
import { MODEL_AUTHORED_RESULT_JSON_SCHEMA } from "../src/agents/agent-execution-result.ts";
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

test("generate() captures finish_reason and the applied max_output_tokens", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 }); // default finish_reason: "stop"
  try {
    const p = provider(srv.baseUrl);
    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "x", maxOutputTokens: 4321 });
    assert.equal(r.finish_reason, "stop");
    assert.equal(r.max_output_tokens, 4321);
  } finally {
    await srv.close();
  }
});

test("generate() surfaces finish_reason=length (and any casing) for a truncated completion", async () => {
  const srv = await startFakeOpenAiServer({ finishReason: "LENGTH" });
  try {
    const p = provider(srv.baseUrl);
    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "x", maxOutputTokens: 500 });
    // Normalised to lower-case so callers can compare against a fixed constant set.
    assert.equal(r.finish_reason, "length");
    assert.equal(r.max_output_tokens, 500);
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

test("a 429 throws RateLimitError immediately with the parsed reset window - NO burst retry inside the same window", async () => {
  const srv = await startFakeOpenAiServer({
    rateLimitFirst: 99,
    retryAfterHeader: "7",
    resetRequestsHeader: "12.5s",
    rateLimitHeaders: { limitRequests: 30, remainingRequests: 0, limitTokens: 6000, remainingTokens: 10 },
  });
  try {
    const p = provider(srv.baseUrl); // maxRetries 2 - but 429 must not be retried internally
    await assert.rejects(
      () => p.generate({ tier: "STANDARD_CODING", prompt: "x" }),
      (err: unknown) => {
        assert.ok(err instanceof RateLimitError, "expected a RateLimitError");
        assert.equal((err as RateLimitError).code, "PROVIDER_RATE_LIMITED");
        const rl = (err as RateLimitError).rateLimit!;
        assert.equal(rl.httpStatus, 429);
        assert.equal(rl.retryAfterMs, 7000);
        assert.equal(rl.resetRequestsMs, 12500);
        assert.equal(rl.remainingRequests, 0);
        assert.equal(rl.remainingTokens, 10);
        return true;
      },
    );
    // The provider issued exactly ONE HTTP call - it did not burst-retry the 429.
    assert.equal(srv.requestCount(), 1);
    assert.equal(p.rateLimit()?.retryAfterMs, 7000);
  } finally {
    await srv.close();
  }
});

test("structured output: strict json_schema request is generated when the capability is on", async () => {
  const okSrv = await startFakeOpenAiServer({ reportCost: 0 });
  try {
    const p = provider(okSrv.baseUrl, { capabilities: { jsonSchema: true, reasoningEffort: true } });
    const r = await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: X (qa)",
      responseSchema: {
        name: "AgentExecutionResult",
        schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA,
        strict: true,
      },
      reasoningEffort: "low",
    });
    assert.equal(r.structured_output, true);
    assert.equal(r.structured_output_mode, "json_schema");
    assert.equal(r.schema_rejection, null);
    // The wire request carried response_format: { type: "json_schema", strict: true }.
    assert.deepEqual(okSrv.responseFormatModes(), ["json_schema"]);
  } finally {
    await okSrv.close();
  }
});

test("structured output: a provider HTTP 400 that rejects the schema self-heals ONCE to response_format json_object", async () => {
  const pickySrv = await startFakeOpenAiServer({ reportCost: 0, rejectJsonSchema: true });
  try {
    const p = provider(pickySrv.baseUrl, { capabilities: { jsonSchema: true } });
    const schema = { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true };

    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (qa)", responseSchema: schema });
    assert.ok(r.text.length > 0, "self-healed: retried with json_object and succeeded");
    assert.equal(r.structured_output, false, "the schema was NOT enforced on this response");
    assert.equal(r.structured_output_mode, "json_object");
    assert.deepEqual(r.schema_rejection, { fellBackTo: "json_object", reason: "schema_unsupported" });

    // A subsequent call goes straight to json_object (no second json_schema attempt),
    // and does not re-report a fresh rejection.
    const r2 = await p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (qa)", responseSchema: schema });
    assert.equal(r2.structured_output_mode, "json_object");
    assert.equal(r2.schema_rejection, null);

    // Wire history: json_schema (rejected), json_object (fallback), json_object (subsequent).
    assert.deepEqual(pickySrv.responseFormatModes(), ["json_schema", "json_object", "json_object"]);
    // The API key never appears in the (redacted) error path either.
    assert.ok(!JSON.stringify(r).includes(KEY));
  } finally {
    await pickySrv.close();
  }
});

test("structured output: Groq json_validate_failed (HTTP 400) also self-heals ONCE to json_object", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0, jsonValidateFailed: true });
  try {
    const p = provider(srv.baseUrl, { capabilities: { jsonSchema: true } });
    const r = await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: X (implementation)",
      responseSchema: { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true },
    });
    assert.ok(r.text.length > 0);
    assert.equal(r.structured_output_mode, "json_object");
    assert.deepEqual(r.schema_rejection, { fellBackTo: "json_object", reason: "json_validate_failed" });
    assert.deepEqual(srv.responseFormatModes(), ["json_schema", "json_object"]);
  } finally {
    await srv.close();
  }
});

test("a Groq-style HTTP 400 'rate_limit_exceeded' (request larger than the remaining TPM window) is treated as a rate limit, not a hard failure", async () => {
  const srv = await startFakeOpenAiServer({
    httpErrorStatus: 400,
    httpErrorBody: {
      error: {
        message:
          "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 4200, Requested 7100. Please try again in 4.53s.",
        type: "tokens",
        code: "rate_limit_exceeded",
      },
    },
  });
  try {
    const p = provider(srv.baseUrl, { capabilities: { jsonSchema: true } });
    await assert.rejects(
      () =>
        p.generate({
          tier: "STANDARD_CODING",
          prompt: "Stage: X (implementation)",
          responseSchema: { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true },
        }),
      (err: unknown) => {
        assert.ok(err instanceof RateLimitError, "a 400 TPM body must surface as RateLimitError so the scheduler waits");
        assert.equal((err as RateLimitError).code, "PROVIDER_RATE_LIMITED");
        assert.ok(!String((err as Error).message).includes(KEY));
        return true;
      },
    );
  } finally {
    await srv.close();
  }
});

test("a generic HTTP 400 surfaces the redacted, bounded response body in the error (never opaque, never a credential)", async () => {
  const srv = await startFakeOpenAiServer({
    httpErrorStatus: 400,
    httpErrorBody: { error: { message: "invalid 'temperature': must be <= 2", type: "invalid_request_error" } },
  });
  try {
    const p = provider(srv.baseUrl);
    await assert.rejects(
      () => p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (qa)" }),
      (err: unknown) => {
        assert.equal((err as { code?: string }).code, "PROVIDER_HTTP");
        assert.match(String((err as Error).message), /invalid 'temperature'/);
        assert.ok(!String((err as Error).message).includes(KEY));
        return true;
      },
    );
  } finally {
    await srv.close();
  }
});

test("structured output: when json_object ALSO 400s 'failed to generate JSON', it cascades ONCE to prompt-only with a bounded max_tokens bump", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0, jsonValidateFailedUntilPromptOnly: true });
  try {
    const p = provider(srv.baseUrl, { capabilities: { jsonSchema: true } });
    const r = await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: X (architecture)",
      maxOutputTokens: 2000,
      responseSchema: { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true },
    });
    assert.ok(r.text.length > 0, "prompt-only request finally returned a 200 body");
    assert.equal(r.structured_output_mode, "none");
    // Wire history: json_schema (400) -> json_object (400) -> none (200).
    assert.deepEqual(srv.responseFormatModes(), ["json_schema", "json_object", "none"]);
    // The token budget was raised on each degrade, bounded to <= 2x the request.
    const [s0, s1, s2] = srv.maxTokensSeen() as [number, number, number];
    assert.equal(s0, 2000);
    assert.ok(s1 > s0, "json_object retry raised max_tokens");
    assert.ok(s2 >= s1 && s2 <= 4000, "prompt-only retry raised again, bounded to 2x");
    // A subsequent call stays prompt-only (the instance learned the endpoint truncates structured JSON).
    const r2 = await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: X (architecture)",
      responseSchema: { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true },
    });
    assert.equal(r2.structured_output_mode, "none");
  } finally {
    await srv.close();
  }
});

test("structured output: the json_object fallback is still API-forced JSON, never prompt-only", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0, rejectJsonSchema: true });
  try {
    const p = provider(srv.baseUrl, { capabilities: { jsonSchema: true } });
    await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: X (qa)",
      responseSchema: { name: "AgentExecutionResult", schema: MODEL_AUTHORED_RESULT_JSON_SCHEMA, strict: true },
    });
    // The fallback request MUST still carry response_format (json_object) - it is
    // resilience, not a downgrade to unconstrained generation.
    assert.ok(srv.responseFormatModes().includes("json_object"));
    assert.ok(!srv.responseFormatModes().includes("none"));
  } finally {
    await srv.close();
  }
});

test("rate-limit metadata never carries a credential", async () => {
  const srv = await startFakeOpenAiServer({
    rateLimitHeaders: { limitRequests: 30, remainingRequests: 15, limitTokens: 6000, remainingTokens: 4000 },
    resetRequestsHeader: "3s",
  });
  try {
    const p = provider(srv.baseUrl);
    const r = await p.generate({ tier: "STANDARD_CODING", prompt: "Stage: X (qa)" });
    assert.ok(r.rate_limit, "expected rate_limit on the successful result");
    assert.equal(r.rate_limit!.remainingRequests, 15);
    assert.equal(r.rate_limit!.resetRequestsMs, 3000);
    assert.ok(!JSON.stringify(r.rate_limit).includes(KEY));
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

test("a 404 model-unavailable response surfaces as PROVIDER_HTTP and is not retried", async () => {
  const srv = await startFakeOpenAiServer({
    httpErrorStatus: 404,
    httpErrorBody: { error: { message: "No endpoints found for model", code: 404 } },
  });
  try {
    const p = provider(srv.baseUrl, { maxRetries: 2 });
    await assert.rejects(
      () => p.generate({ tier: "STANDARD_CODING", prompt: "x" }),
      /PROVIDER_HTTP/,
    );
    assert.equal(srv.requestCount(), 1, "a 4xx model-unavailable error must not be retried");
  } finally {
    await srv.close();
  }
});

test("buildRealProvider defaults to the Groq Direct proof config and is blocked without a key", () => {
  const status = buildRealProvider({});
  assert.ok(status.descriptor);
  assert.equal(status.active, "groq");
  assert.equal(status.ready, false);
  assert.match(status.reason, /GROQ_API_KEY/);
  assert.match(status.reason, /BLOCKED_PROVIDER_UNAVAILABLE/);
  assert.equal(status.descriptor!.id, "groq");
  assert.equal(status.descriptor!.label, "REAL / Groq Direct proof");
  assert.equal(status.descriptor!.apiKeyEnv, "GROQ_API_KEY");
  assert.equal(status.descriptor!.isProofProvider, true);
  assert.equal(status.descriptor!.sensitivity, "NON_SENSITIVE_PROOF_ONLY");
  assert.match(status.descriptor!.baseUrl, /api\.groq\.com/);
});

test("Groq Direct default proof model is openai/gpt-oss-120b", () => {
  const status = buildRealProvider({});
  assert.equal(status.descriptor!.model, "openai/gpt-oss-120b");
});

test("Groq Direct: missing GROQ_API_KEY -> descriptor present, not ready, no key read", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "groq" });
  assert.ok(status.descriptor, "descriptor is still built so doctor can report it");
  assert.equal(status.ready, false);
  assert.equal(status.descriptor!.provider.isReady(), false);
  assert.match(status.reason, /GROQ_API_KEY is not set/);
});

test("Groq Direct: GROQ_API_KEY present -> ready, real (non-mock) provider", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "groq", GROQ_API_KEY: "gsk-fake-not-a-real-key-000" });
  assert.equal(status.ready, true);
  assert.equal(status.descriptor!.provider.name, "groq-direct");
  assert.notEqual(status.descriptor!.provider.name, "mock");
  assert.equal(status.descriptor!.provider.health().status, "OK");
  assert.match(status.descriptor!.provider.health().detail, /PROOF_PROVIDER/);
  assert.match(status.descriptor!.provider.health().detail, /NON_SENSITIVE_PROOF_ONLY/);
});

test("Groq Direct: explicit AI_COMPANY_REAL_MODEL override is honoured", () => {
  const status = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_MODEL: "llama-3.3-70b-versatile",
    GROQ_API_KEY: "gsk-fake-000",
  });
  assert.equal(status.descriptor!.model, "llama-3.3-70b-versatile");
  assert.notEqual(status.descriptor!.model, "openai/gpt-oss-120b");
});

test("AI_COMPANY_REAL_MODEL is an explicit override of the default model id", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_MODEL: "some-vendor/some-model", GROQ_API_KEY: "gsk-fake-000" });
  assert.equal(status.descriptor!.model, "some-vendor/some-model");
  const dflt = buildRealProvider({});
  assert.notEqual(status.descriptor!.model, dflt.descriptor!.model);
});

test("OpenRouter is still supported as the optional fallback proof provider", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-fake-000" });
  assert.equal(status.active, "openrouter");
  assert.equal(status.ready, true);
  assert.equal(status.descriptor!.id, "openrouter");
  assert.equal(status.descriptor!.label, "REAL / OpenRouter proof");
  assert.equal(status.descriptor!.provider.name, "openrouter-proof");
  assert.equal(status.descriptor!.model, "openrouter/free");
  assert.match(status.descriptor!.baseUrl, /openrouter\.ai/);
  assert.equal(status.descriptor!.sensitivity, "NON_SENSITIVE_PROOF_ONLY");
});

test("known providers list reports Groq (preferred) and OpenRouter presence without reading key values", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "groq", OPENROUTER_API_KEY: "or-fake-000" });
  const groq = status.known.find((k) => k.id === "groq")!;
  const or = status.known.find((k) => k.id === "openrouter")!;
  assert.equal(groq.preferred, true);
  assert.equal(groq.active, true);
  assert.equal(groq.configured, false); // no GROQ_API_KEY
  assert.equal(or.preferred, false);
  assert.equal(or.active, false);
  assert.equal(or.configured, true); // OPENROUTER_API_KEY present
});

test("buildRealProvider can be disabled entirely", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "disabled" });
  assert.equal(status.descriptor, null);
  assert.equal(status.ready, false);
  assert.equal(status.active, "disabled");
});

test("an unknown AI_COMPANY_REAL_PROVIDER is rejected, not silently defaulted", () => {
  const status = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "totally-made-up" });
  assert.equal(status.descriptor, null);
  assert.equal(status.active, "unknown");
  assert.match(status.reason, /unknown AI_COMPANY_REAL_PROVIDER/);
});

test("provider independence: same generic client serves Groq and OpenRouter (only config differs)", () => {
  const groq = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "groq", GROQ_API_KEY: "gsk-fake-000" });
  const or = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-fake-000" });
  // Same class, different configuration - no per-vendor HTTP/model client.
  assert.equal(groq.descriptor!.provider.constructor, or.descriptor!.provider.constructor);
  assert.notEqual(groq.descriptor!.baseUrl, or.descriptor!.baseUrl);
  assert.equal(groq.descriptor!.sensitivity, or.descriptor!.sensitivity);
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

test("Groq Direct: live probe classifies OK / RATE_LIMITED / ERROR without spending completion tokens", async () => {
  // OK: /models reachable
  const ok = await startFakeOpenAiServer({});
  try {
    const p = buildRealProvider(
      { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: ok.baseUrl, GROQ_API_KEY: "gsk-fake-000" },
    ).descriptor!.provider;
    const h = await p.probe();
    assert.equal(h.status, "OK");
    assert.equal(ok.requestCount(), 0, "probe must not POST a completion");
  } finally {
    await ok.close();
  }

  // RATE_LIMITED: /models returns 429
  const limited = await startFakeOpenAiServer({ modelsStatus: 429 });
  try {
    const p = buildRealProvider(
      { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: limited.baseUrl, GROQ_API_KEY: "gsk-fake-000" },
    ).descriptor!.provider;
    assert.equal((await p.probe()).status, "RATE_LIMITED");
  } finally {
    await limited.close();
  }

  // ERROR: credential rejected
  const denied = await startFakeOpenAiServer({ modelsStatus: 401 });
  try {
    const p = buildRealProvider(
      { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: denied.baseUrl, GROQ_API_KEY: "gsk-fake-000" },
    ).descriptor!.provider;
    assert.equal((await p.probe()).status, "ERROR");
  } finally {
    await denied.close();
  }

  // NOT_CONFIGURED: no key
  const noKey = buildRealProvider({ AI_COMPANY_REAL_PROVIDER: "groq" }).descriptor!.provider;
  assert.equal((await noKey.probe()).status, "NOT_CONFIGURED");
});

test("Groq Direct: a 429 completion is classified PROVIDER_RATE_LIMITED (rate-limit classification preserved)", async () => {
  const srv = await startFakeOpenAiServer({ rateLimitFirst: 99 });
  try {
    const p = buildRealProvider(
      { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: srv.baseUrl, AI_COMPANY_REAL_MAX_RETRIES: "1", GROQ_API_KEY: "gsk-fake-000" },
    ).descriptor!.provider;
    await assert.rejects(() => p.generate({ tier: "STANDARD_CODING", prompt: "x" }), /PROVIDER_RATE_LIMITED/);
  } finally {
    await srv.close();
  }
});

test("Groq Direct: a valid structured completion parses through the provider unchanged", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  try {
    const p = buildRealProvider(
      { AI_COMPANY_REAL_PROVIDER: "groq", AI_COMPANY_REAL_BASE_URL: srv.baseUrl, GROQ_API_KEY: "gsk-fake-000" },
    ).descriptor!.provider;
    const r = await p.generate({
      tier: "STANDARD_CODING",
      prompt: "Stage: Business analysis (business_analysis)",
      system: "agent id: business-analyst",
    });
    assert.equal(r.provider, "groq-direct");
    assert.ok(r.text.includes('"status"'));
    assert.equal(r.finish_reason, "stop");
    assert.equal(srv.lastAuthHeader(), "Bearer gsk-fake-000");
  } finally {
    await srv.close();
  }
});
