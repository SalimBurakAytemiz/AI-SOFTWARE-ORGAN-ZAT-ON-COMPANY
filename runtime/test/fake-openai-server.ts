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
  /** Fail the first N requests with 500, then succeed. */
  serverErrorFirst?: number;
  /** Never respond (to exercise the client timeout). */
  hang?: boolean;
  /** Return a non-JSON / contract-invalid body for the first N requests. */
  malformedFirst?: number;
  /** Report a cost number in the response body. */
  reportCost?: number | null;
  /** Override the model id echoed back. */
  modelId?: string;
}

export interface FakeServerHandle {
  baseUrl: string;
  requestCount: () => number;
  lastAuthHeader: () => string | undefined;
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

function stageResponse(stageId: string, agentId: string): unknown {
  const base: Record<string, unknown> = {
    status: "PASS",
    summary: `${agentId} completed the '${stageId}' stage for the /health endpoint task.`,
    reasoningSummary: `For '${stageId}': follow the stage action, produce the required artifact, hand off. Additive change only.`,
    artifacts: [
      {
        path: `${stageId}.md`,
        kind: "report",
        content: `# ${stageId}\n\nFake-provider output for stage '${stageId}'. GET /health must return 200 and {"status":"ok"} with a test.`,
      },
    ],
    recommendations: [`Proceed past '${stageId}'.`],
    requestedToolCalls: [],
    handoff: { to: "next", why: `${stageId} done` },
    qualityEvidence: [{ check: `${stageId}-artifact`, result: "PASS", detail: "written" }],
    risks: [],
    errors: [],
  };
  if (stageId === "implementation") {
    base.requestedToolCalls = [
      { tool: "workspace.write", args: { path: "src/server.js", content: SERVER_JS }, reason: "add GET /health" },
      { tool: "workspace.write", args: { path: "test/health.test.js", content: HEALTH_TEST_JS }, reason: "add test" },
      { tool: "workspace.write", args: { path: "docs/health.md", content: "# GET /health\n\nReturns 200 and {\"status\":\"ok\"}.\n" }, reason: "docs" },
      { tool: "workspace.exec", args: { command: "npm test" }, reason: "run tests" },
    ];
  }
  if (["qa", "security", "code_review"].includes(stageId)) {
    base.requestedToolCalls = [{ tool: "workspace.list", args: {}, reason: "inspect the change" }];
  }
  return base;
}

export async function startFakeOpenAiServer(opts: FakeServerOptions = {}): Promise<FakeServerHandle> {
  let count = 0;
  let lastAuth: string | undefined;
  const modelId = opts.modelId ?? "fake/structured-model";

  const server: Server = createServer((req, res) => {
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
      if (opts.rateLimitFirst && n <= opts.rateLimitFirst) {
        res.writeHead(429, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: "rate limited" } }));
        return;
      }
      if (opts.serverErrorFirst && n <= opts.serverErrorFirst) {
        res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: "upstream" } }));
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
      const agentId = sysMsg.match(/agent id:\s*([a-z-]+)/)?.[1] ?? "agent";

      let content: string;
      if (opts.malformedFirst && n <= opts.malformedFirst) {
        content = "Sure! Here is my analysis in prose with no JSON object at all.";
      } else {
        content = JSON.stringify(stageResponse(stageId, agentId));
      }

      const payload = {
        id: `chatcmpl-fake-${n}`,
        model: modelId,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 },
        ...(typeof opts.reportCost === "number" ? { cost: opts.reportCost } : {}),
      };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requestCount: () => count,
    lastAuthHeader: () => lastAuth,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
