import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A local, offline OpenAI-compatible chat-completions server for tests. It never
 * reaches the internet and costs nothing. It can simulate rate limiting, 5xx,
 * timeouts and malformed responses so the provider's retry/error paths are tested.
 */

export interface FakeServerOptions {
  /** Fail the first N requests with 429, then succeed. */
  rateLimitFirst?: number;
  /** Succeed the first N requests, then fail every later request with 429 (persistent quota exhaustion). */
  rateLimitAfter?: number;
  /**
   * Reply to every request with HTTP 429 and an OpenAI `insufficient_quota` /
   * `credit_balance_exhausted` body - a BILLING exhaustion, not a rate limit.
   * The runtime must classify this as non-retryable (ProviderQuotaExhaustedError)
   * and never feed it to the rate-limit scheduler.
   */
  quotaExhausted?: boolean;
  /** Fail the first N requests with 500, then succeed. */
  serverErrorFirst?: number;
  /** Succeed the first N requests, then fail every later request with 503 (simulates an interruption mid-chain). */
  serverErrorAfter?: number;
  /** Never respond (to exercise the client timeout). */
  hang?: boolean;
  /** Return a non-JSON / contract-invalid body for the first N requests. */
  malformedFirst?: number;
  /**
   * Reply to every request with this HTTP status and `httpErrorBody` (default
   * body `{ error: { message: "model unavailable" } }`). Use 404 to simulate
   * OpenRouter MODEL_UNAVAILABLE, 401/402 for auth/credit failures, etc.
   */
  httpErrorStatus?: number;
  httpErrorBody?: unknown;
  /** Report a cost number in the response body. */
  reportCost?: number | null;
  /** Override the model id echoed back. */
  modelId?: string;
  /** Override `choices[0].finish_reason` (default "stop"). */
  finishReason?: string;
  /**
   * HTTP status for `GET /models` (the reachability/auth probe endpoint).
   * Default 200 with a small model list. Set 429 to test RATE_LIMITED, 401/403
   * to test ERROR. `/models` requests never count toward `requestCount()`.
   */
  modelsStatus?: number;
  /**
   * For the first N requests, cut the valid structured-output body roughly in
   * half (an unbalanced, truncated JSON object) and report `finish_reason:
   * "length"` - simulating a completion cut off at the output-token cap.
   */
  truncateFirst?: number;
  /** Value of `Retry-After` on a 429 (seconds or a Go duration string). */
  retryAfterHeader?: string;
  /** Value of `x-ratelimit-reset-requests` on every response. */
  resetRequestsHeader?: string;
  /** Value of `x-ratelimit-reset-tokens` on every response. */
  resetTokensHeader?: string;
  /**
   * Emit `x-ratelimit-*-requests` / `-tokens` headers on every response.
   * `remaining` counts DOWN by one per chat/completions request so a scheduler
   * can pre-emptively wait. Defaults are generous (no pre-wait) unless set.
   */
  rateLimitHeaders?: { limitRequests?: number; remainingRequests?: number; limitTokens?: number; remainingTokens?: number };
  /**
   * Return HTTP 400 (schema-specific error) for a request carrying
   * `response_format: { type: "json_schema" }`, but serve a normal structured
   * body for a `response_format: { type: "json_object" }` request or a plain
   * request. Simulates a Groq endpoint that advertises structured output yet
   * rejects a specific schema - exercising the one-time json_object self-heal.
   */
  rejectJsonSchema?: boolean;
  /**
   * With `rejectJsonSchema`, also return a non-JSON prose body for the
   * json_object fallback request, so a test can prove the fallback response is
   * still run through AgentExecutionResult validation and a malformed one is
   * rejected (never accepted unvalidated).
   */
  malformedAfterSchemaFallback?: boolean;
  /**
   * For a `response_format: json_schema` request, return Groq's HTTP 400
   * `json_validate_failed` ("Failed to generate JSON") instead of a
   * schema-shape error. A `json_object` request is served normally. Simulates
   * the model failing to complete a schema-valid generation within the budget.
   */
  jsonValidateFailed?: boolean;
  /**
   * Return Groq's HTTP 400 `json_validate_failed` for BOTH `json_schema` AND
   * `json_object` requests (the model keeps truncating the object at the cap),
   * but serve a normal body for a prompt-only request. Exercises the
   * json_schema -> json_object -> prompt-only cascade and the bounded
   * max_tokens bump.
   */
  jsonValidateFailedUntilPromptOnly?: boolean;
  /**
   * On the FIRST implementation-stage request, write a syntactically broken test
   * so the runner's `npm test` fails; on the repair pass (prompt contains
   * "test_failure_repair") write the correct test. Exercises the bounded
   * one-shot test-repair loop.
   */
  brokenTestUntilRepair?: boolean;
  /** implementation stage: put the test at a path `node --test` does not discover. */
  implMisplacedTest?: boolean;
  /** implementation stage: author the server file with CommonJS `require()` in the ESM project. */
  implWrongModuleSyntax?: boolean;
  /** implementation stage: return NO fileChanges (code only in `artifacts`). */
  implNoFileChanges?: boolean;
  /** implementation stage: change the source but never add a test. */
  implNoTest?: boolean;
}

export interface FakeServerHandle {
  baseUrl: string;
  requestCount: () => number;
  lastAuthHeader: () => string | undefined;
  /** The `response_format.type` seen on each chat/completions request, in order ("none" when absent). */
  responseFormatModes: () => string[];
  /** The `max_tokens` seen on each chat/completions request, in order. */
  maxTokensSeen: () => number[];
  /** The most recent user-message content seen for a given workflow stage, or undefined. */
  lastUserPromptForStage: (stageId: string) => string | undefined;
  close: () => Promise<void>;
}

const SERVER_JS = [
  'import { createServer } from "node:http";',
  "export function handler(req, res) {",
  '  if (req.method === "GET" && req.url === "/health") {',
  '    res.writeHead(200, { "content-type": "application/json" });',
  '    res.end(JSON.stringify({ status: "ok" }));',
  "    return;",
  "  }",
  '  res.writeHead(404, { "content-type": "application/json" });',
  '  res.end(JSON.stringify({ error: "not found" }));',
  "}",
  "export function createDemoServer() { return createServer(handler); }",
  "",
].join("\n");

const HEALTH_TEST_JS = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  'import { handler } from "../src/server.js";',
  "function call(method, url) {",
  "  return new Promise((resolve) => {",
  "    const chunks = [];",
  "    const res = {",
  "      writeHead(s) { this.statusCode = s; },",
  '      end(b) { chunks.push(b ?? ""); resolve({ status: this.statusCode, body: chunks.join("") }); },',
  "    };",
  "    handler({ method, url }, res);",
  "  });",
  "}",
  "test(\"GET /health returns 200 and status ok\", async () => {",
  '  const r = await call("GET", "/health");',
  "  assert.equal(r.status, 200);",
  '  assert.deepEqual(JSON.parse(r.body), { status: "ok" });',
  "});",
  "",
].join("\n");

const BROKEN_TEST_JS = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  'import { handler } from "../src/server.js";',
  'test("GET /health", async () => {',
  "  const r = await call(",           // deliberate syntax error: unterminated call
  "});",
  "",
].join("\n");

interface StageOpts {
  repairPass?: boolean;
  brokenTest?: boolean;
  /** implementation: write the test to a path `node --test` does NOT discover. */
  misplacedTest?: boolean;
  /** implementation: write `require()` into the ESM file (wrong module syntax). */
  wrongModuleSyntax?: boolean;
  /** implementation: return NO fileChanges at all (model produced only prose/artifacts). */
  noFileChanges?: boolean;
  /** implementation: change source but do NOT add a test. */
  noTest?: boolean;
}

/** The correct ESM server file (SERVER_JS already contains the /health branch). */
const SERVER_WITH_HEALTH_JS = SERVER_JS;

/** Same behaviour but authored with CommonJS `require()` in an ESM project - invalid. */
const SERVER_WITH_HEALTH_CJS =
  'const { createServer } = require("node:http");\n' +
  "function handler(req, res) {\n" +
  '  if (req.method === "GET" && req.url === "/health") {\n' +
  '    res.writeHead(200, { "content-type": "application/json" });\n' +
  '    res.end(JSON.stringify({ status: "ok" }));\n' +
  "    return;\n" +
  "  }\n" +
  '  res.writeHead(404, { "content-type": "application/json" });\n' +
  '  res.end(JSON.stringify({ error: "not found" }));\n' +
  "}\n" +
  "module.exports = { handler };\n";

function stageResponse(stageId: string, agentId: string, opts: StageOpts = {}): unknown {
  const base: Record<string, unknown> = {
    status: "PASS",
    summary: `${agentId} completed the '${stageId}' stage for the /health endpoint task.`,
    reasoningSummary:
      stageId === "implementation"
        ? "ESM (package.json type=module); test command `node --test`; modifying handler in src/server.js; " +
          "adding test/health.test.js which node --test discovers because it is under test/."
        : `For '${stageId}': follow the stage action, produce the required artifact, hand off. Additive change only.`,
    artifacts: [
      {
        path: `${stageId}.md`,
        kind: "report",
        content: `# ${stageId}\n\nFake-provider output for stage '${stageId}'. GET /health must return 200 and {"status":"ok"} with a test.`,
      },
    ],
    fileChanges: [],
    recommendations: [`Proceed past '${stageId}'.`],
    requestedToolCalls: [],
    handoff: { to: "next", why: `${stageId} done` },
    qualityEvidence: [{ check: `${stageId}-artifact`, result: "PASS", detail: "written" }],
    risks: [],
    errors: [],
  };
  if (stageId === "implementation") {
    // "Stubborn" bad behaviours persist through the repair pass (a model that
    // never grasps the fix) so a test observes the deterministic gate, not a
    // lucky retry. `brokenTest` is the ONE scenario that self-heals on repair.
    if (opts.noFileChanges) {
      base.fileChanges = [];
      base.artifacts = [{ path: "implementation.md", kind: "code", content: SERVER_WITH_HEALTH_JS }];
    } else if (opts.wrongModuleSyntax) {
      base.fileChanges = [
        { path: "src/server.js", operation: "modify", content: SERVER_WITH_HEALTH_CJS },
        { path: "test/health.test.js", operation: "create", content: HEALTH_TEST_JS },
      ];
    } else if (opts.misplacedTest) {
      base.fileChanges = [
        { path: "src/server.js", operation: "modify", content: SERVER_WITH_HEALTH_JS },
        { path: "docs/health-check.js", operation: "create", content: HEALTH_TEST_JS },
      ];
    } else if (opts.noTest) {
      base.fileChanges = [{ path: "src/server.js", operation: "modify", content: SERVER_WITH_HEALTH_JS }];
    } else {
      const testContent = opts.brokenTest && !opts.repairPass ? BROKEN_TEST_JS : HEALTH_TEST_JS;
      base.fileChanges = [
        { path: "src/server.js", operation: "modify", content: SERVER_WITH_HEALTH_JS },
        { path: "test/health.test.js", operation: "create", content: testContent },
      ];
    }
  }
  if (stageId === "code_review") {
    // Only code_review still offers read-only workspace tools. qa/security are
    // assessment-only (the runtime runs npm test / the security checks itself),
    // so a tool call there would be out of scope.
    base.requestedToolCalls = [{ tool: "workspace.list", args_json: "{}", reason: "inspect the change" }];
  }
  return base;
}

export async function startFakeOpenAiServer(opts: FakeServerOptions = {}): Promise<FakeServerHandle> {
  let count = 0;
  let lastAuth: string | undefined;
  const responseFormatModes: string[] = [];
  const maxTokensSeen: number[] = [];
  const lastPromptByStage = new Map<string, string>();
  const modelId = opts.modelId ?? "fake/structured-model";

  /** Rate-limit headers for a response after `n` chat/completions requests. */
  const rlHeaders = (n: number, is429: boolean): Record<string, string> => {
    const h: Record<string, string> = {};
    const rl = opts.rateLimitHeaders;
    if (rl) {
      if (rl.limitRequests != null) h["x-ratelimit-limit-requests"] = String(rl.limitRequests);
      if (rl.remainingRequests != null) {
        h["x-ratelimit-remaining-requests"] = String(Math.max(0, rl.remainingRequests - (n - 1)));
      }
      if (rl.limitTokens != null) h["x-ratelimit-limit-tokens"] = String(rl.limitTokens);
      if (rl.remainingTokens != null) h["x-ratelimit-remaining-tokens"] = String(rl.remainingTokens);
    }
    if (opts.resetRequestsHeader) h["x-ratelimit-reset-requests"] = opts.resetRequestsHeader;
    if (opts.resetTokensHeader) h["x-ratelimit-reset-tokens"] = opts.resetTokensHeader;
    if (is429 && opts.retryAfterHeader) h["retry-after"] = opts.retryAfterHeader;
    return h;
  };

  const server: Server = createServer((req, res) => {
    // Reachability / auth probe endpoint - never counted, no completion tokens.
    if (req.method === "GET" && req.url?.includes("/models")) {
      lastAuth = req.headers.authorization;
      const s = opts.modelsStatus ?? 200;
      res
        .writeHead(s, { "content-type": "application/json" })
        .end(JSON.stringify(s === 200 ? { data: [{ id: modelId, object: "model" }] } : { error: { message: `models ${s}` } }));
      return;
    }
    if (req.method !== "POST" || !req.url?.includes("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    count++;
    lastAuth = req.headers.authorization;
    const n = count;

    if (opts.hang) return; // never responds

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let bodyJson: Record<string, unknown> = {};
      try {
        bodyJson = JSON.parse(body) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const rf = bodyJson.response_format as { type?: string } | undefined;
      const rfType = typeof rf?.type === "string" ? rf.type : "none";
      responseFormatModes.push(rfType);
      maxTokensSeen.push(Number(bodyJson.max_tokens) || 0);

      if (opts.jsonValidateFailedUntilPromptOnly && (rfType === "json_schema" || rfType === "json_object")) {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(
            JSON.stringify({
              error: {
                message:
                  "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
                type: "invalid_request_error",
                code: "json_validate_failed",
                failed_generation: '{"status":"PASS","summary":"truncated before close',
              },
            }),
          );
        return;
      }

      if (opts.jsonValidateFailed && rfType === "json_schema") {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(
            JSON.stringify({
              error: {
                message:
                  "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
                type: "invalid_request_error",
                code: "json_validate_failed",
                failed_generation: '{"status":"PASS","summary":"partial',
              },
            }),
          );
        return;
      }
      if (opts.rejectJsonSchema && rfType === "json_schema") {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(
            JSON.stringify({
              error: {
                message:
                  "invalid json_schema for response_format: the provided schema is not a supported strict subset for this model",
                type: "invalid_request_error",
                param: "response_format.json_schema.schema",
              },
            }),
          );
        return;
      }
      if (typeof opts.httpErrorStatus === "number") {
        const body = opts.httpErrorBody ?? { error: { message: "model unavailable" } };
        res
          .writeHead(opts.httpErrorStatus, { "content-type": "application/json" })
          .end(JSON.stringify(body));
        return;
      }
      if (opts.quotaExhausted) {
        res
          .writeHead(429, { "content-type": "application/json" })
          .end(
            JSON.stringify({
              error: {
                message:
                  "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
                type: "insufficient_quota",
                param: null,
                code: "credit_balance_exhausted",
              },
            }),
          );
        return;
      }
      if (opts.rateLimitFirst && n <= opts.rateLimitFirst) {
        res
          .writeHead(429, { "content-type": "application/json", ...rlHeaders(n, true) })
          .end(JSON.stringify({ error: { message: "rate limited" } }));
        return;
      }
      if (typeof opts.rateLimitAfter === "number" && n > opts.rateLimitAfter) {
        res
          .writeHead(429, { "content-type": "application/json", ...rlHeaders(n, true) })
          .end(JSON.stringify({ error: { message: "rate limited: free-tier quota exhausted" } }));
        return;
      }
      if (opts.serverErrorFirst && n <= opts.serverErrorFirst) {
        res
          .writeHead(503, { "content-type": "application/json", ...rlHeaders(n, false) })
          .end(JSON.stringify({ error: { message: "upstream" } }));
        return;
      }
      if (typeof opts.serverErrorAfter === "number" && n > opts.serverErrorAfter) {
        res
          .writeHead(503, { "content-type": "application/json", ...rlHeaders(n, false) })
          .end(JSON.stringify({ error: { message: "upstream (interrupted mid-chain)" } }));
        return;
      }

      let parsed: { messages?: { role: string; content: string }[] } = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        /* ignore */
      }
      const userMsg = parsed.messages?.find((m) => m.role === "user")?.content ?? "";
      const sysMsg = parsed.messages?.find((m) => m.role === "system")?.content ?? "";
      const stageId = userMsg.match(/Stage:\s*.+?\(([a-z_]+)\)/)?.[1] ?? "unknown";
      lastPromptByStage.set(stageId, userMsg);
      const agentId = sysMsg.match(/agent id:\s*([a-z-]+)/)?.[1] ?? "agent";

      let content: string;
      let finishReason = opts.finishReason ?? "stop";
      if (opts.malformedAfterSchemaFallback && rfType === "json_object") {
        content = "Sure! Here is my analysis in prose with no JSON object at all.";
      } else if (opts.malformedFirst && n <= opts.malformedFirst) {
        content = "Sure! Here is my analysis in prose with no JSON object at all.";
      } else if (opts.truncateFirst && n <= opts.truncateFirst) {
        const full = JSON.stringify(stageResponse(stageId, agentId));
        content = full.slice(0, Math.floor(full.length * 0.5));
        finishReason = "length";
      } else {
        content = JSON.stringify(
          stageResponse(stageId, agentId, {
            repairPass: /test_failure_repair/.test(userMsg),
            brokenTest: Boolean(opts.brokenTestUntilRepair),
            misplacedTest: Boolean(opts.implMisplacedTest),
            wrongModuleSyntax: Boolean(opts.implWrongModuleSyntax),
            noFileChanges: Boolean(opts.implNoFileChanges),
            noTest: Boolean(opts.implNoTest),
          }),
        );
      }

      const payload = {
        id: `chatcmpl-fake-${n}`,
        model: modelId,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }],
        usage: { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 },
        ...(typeof opts.reportCost === "number" ? { cost: opts.reportCost } : {}),
      };
      res
        .writeHead(200, { "content-type": "application/json", ...rlHeaders(n, false) })
        .end(JSON.stringify(payload));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requestCount: () => count,
    lastAuthHeader: () => lastAuth,
    responseFormatModes: () => [...responseFormatModes],
    maxTokensSeen: () => [...maxTokensSeen],
    lastUserPromptForStage: (stageId: string) => lastPromptByStage.get(stageId),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
