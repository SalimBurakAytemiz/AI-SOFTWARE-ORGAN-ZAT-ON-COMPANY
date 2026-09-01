import { createHash } from "node:crypto";
import type { ModelTier } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";
import type {
  GenerateRequest,
  GenerateResult,
  ModelProvider,
  ProviderHealth,
  Usage,
} from "./provider.ts";

/**
 * Deterministic local model provider (build spec section 11 - mandatory). Produces
 * a stable, hash-derived response for any request so the entire acceptance suite
 * runs with no paid API key. It does not pretend to be a real developer; it exists
 * to prove routing, hand-off, gating, persistence, audit and approval flow.
 */
export class MockModelProvider implements ModelProvider {
  readonly name = "mock";
  private inTokens = 0;
  private outTokens = 0;

  isReady(): boolean {
    return true;
  }

  health(): ProviderHealth {
    return {
      provider: this.name,
      status: "OK",
      detail: "deterministic offline provider; no API key required",
      tiers: [...MODEL_TIERS],
    };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const seedMaterial = `${req.seed ?? 0}|${req.tier}|${req.system ?? ""}|${req.prompt}|${req.context ?? ""}`;
    const digest = createHash("sha256").update(seedMaterial).digest("hex");
    const text = isStructuredContract(req.prompt)
      ? renderStructuredResult(req, digest)
      : this.render(req, digest);

    const input_tokens = estimateTokens(`${req.system ?? ""} ${req.prompt} ${req.context ?? ""}`);
    const output_tokens = estimateTokens(text);
    this.inTokens += input_tokens;
    this.outTokens += output_tokens;

    return {
      provider: this.name,
      model: `mock-${req.tier.toLowerCase()}`,
      tier: req.tier,
      text,
      usage: { input_tokens, output_tokens },
      estimated_cost_usd: 0, // the mock provider genuinely costs zero
      duration_ms: Math.max(1, Date.now() - started),
    };
  }

  usage(): Usage {
    return { input_tokens: this.inTokens, output_tokens: this.outTokens };
  }

  private render(req: GenerateRequest, digest: string): string {
    const tag = digest.slice(0, 12);
    return [
      `[mock:${req.tier}] deterministic response ${tag}`,
      `request: ${firstLine(req.prompt)}`,
      req.context ? `context-bytes: ${req.context.length}` : "context: none",
    ].join("\n");
  }
}

function firstLine(s: string): string {
  return (s.split("\n")[0] ?? "").slice(0, 200);
}

/** True when the caller used the RealAgentRunner structured output contract. */
function isStructuredContract(prompt: string): boolean {
  return prompt.includes("required_output_contract") && prompt.includes('"requestedToolCalls"');
}

/**
 * Deterministic, contract-valid AgentExecutionResult for the mock provider so the
 * REAL agent pipeline (prompt assembly -> parse -> validate -> gateway -> tools)
 * is fully exercised offline. This is the runtime's honest "mock developer": it is
 * clearly a mock model, and mock runs are always labelled MOCK, never REAL.
 */
function renderStructuredResult(req: GenerateRequest, digest: string): string {
  const tag = digest.slice(0, 10);
  const stage = req.prompt.match(/Stage:\s*.+?\(([a-z_]+)\)/)?.[1] ?? "unknown";
  const agentId = (req.system ?? "").match(/agent id:\s*([a-z-]+)/)?.[1] ?? "unknown-agent";

  const base = {
    status: "PASS" as const,
    summary: `[mock ${tag}] ${agentId} completed the '${stage}' stage deterministically.`,
    reasoningSummary: `Deterministic mock decision for '${stage}': follow the stage action, produce the required artifact, hand off. No hidden reasoning.`,
    artifacts: [
      {
        path: `${stage}.md`,
        kind: "report" as const,
        content: `# ${stage} (mock)\n\nDeterministic mock output for stage '${stage}' by ${agentId}.\nThis proves routing, structure and hand-off - not that a mock model is a developer.\n`,
      },
    ],
    recommendations: [`Proceed to the next stage after '${stage}'.`],
    requestedToolCalls: [] as unknown[],
    handoff: { to: "next-stage", why: `'${stage}' complete` },
    qualityEvidence: [
      { check: `${stage}-produced-required-artifact`, result: "PASS" as const, detail: "artifact written" },
    ],
    risks: [],
    errors: [],
  };

  if (stage === "implementation") {
    base.requestedToolCalls = [
      {
        tool: "workspace.write",
        args: {
          path: "src/server.js",
          content: MOCK_SERVER_JS,
        },
        reason: "add the GET /health endpoint required by the task",
      },
      {
        tool: "workspace.write",
        args: {
          path: "test/health.test.js",
          content: MOCK_HEALTH_TEST_JS,
        },
        reason: "add an automated test for the GET /health endpoint",
      },
      {
        tool: "workspace.write",
        args: {
          path: "package.json",
          content: MOCK_PACKAGE_JSON,
        },
        reason: "ensure `npm test` runs the new test directory",
      },
      { tool: "workspace.exec", args: { command: "npm test" }, reason: "run the tests I just added" },
    ];
    base.summary = `[mock ${tag}] backend-engineer added GET /health + a test to the disposable workspace.`;
  }

  if (stage === "qa" || stage === "security" || stage === "code_review") {
    base.requestedToolCalls = [
      { tool: "workspace.list", args: {}, reason: `inspect the change for the '${stage}' gate` },
    ];
  }

  return JSON.stringify(base, null, 2);
}

const MOCK_SERVER_JS = [
  "// Disposable fixture service used by the Agent Runtime proof workflow.",
  'import { createServer } from "node:http";',
  "",
  "export function handler(req, res) {",
  '  if (req.method === "GET" && req.url === "/health") {',
  '    res.writeHead(200, { "content-type": "application/json" });',
  '    res.end(JSON.stringify({ status: "ok" }));',
  "    return;",
  "  }",
  '  if (req.method === "GET" && req.url === "/") {',
  '    res.writeHead(200, { "content-type": "application/json" });',
  '    res.end(JSON.stringify({ service: "demo-service" }));',
  "    return;",
  "  }",
  '  res.writeHead(404, { "content-type": "application/json" });',
  '  res.end(JSON.stringify({ error: "not found" }));',
  "}",
  "",
  "export function createDemoServer() {",
  "  return createServer(handler);",
  "}",
  "",
].join("\n");

const MOCK_HEALTH_TEST_JS = `import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../src/server.js";

function call(method, url) {
  return new Promise((resolve) => {
    const req = { method, url };
    const chunks = [];
    const res = {
      writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
      end(body) { chunks.push(body ?? ""); resolve({ status: this.statusCode, body: chunks.join("") }); },
    };
    handler(req, res);
  });
}

test("GET /health returns 200 and { status: 'ok' }", async () => {
  const r = await call("GET", "/health");
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { status: "ok" });
});
`;

const MOCK_PACKAGE_JSON = `{
  "name": "demo-service",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Disposable fixture service for the Agent Runtime proof workflow. Not a product.",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  }
}
`;

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.trim().length / 4));
}

export function isTier(x: string): x is ModelTier {
  return (MODEL_TIERS as readonly string[]).includes(x);
}
