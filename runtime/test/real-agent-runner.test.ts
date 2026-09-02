import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import {
  RealAgentRunner,
  clampMaxOutputTokens,
  DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
  MIN_AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MAX_OUTPUT_TOKENS_CEILING,
} from "../src/agents/real-agent-runner.ts";
import { ProofWorkspace } from "../src/proof/proof-workspace.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";
import { paths } from "../src/config/paths.ts";
import type { GenerateRequest, GenerateResult, ModelProvider } from "../src/models/provider.ts";
import { MODEL_TIERS } from "../src/core/types.ts";
import { RateLimitError } from "../src/core/errors.ts";
import { fixedClock } from "../src/core/clock.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";

/** Deterministic sleep: advances a fixed clock, never actually blocks. */
function fakeSleep() {
  const clock = fixedClock("2026-09-01T12:00:00.000Z");
  const slept: number[] = [];
  return { clock, slept, sleep: async (ms: number) => { slept.push(ms); clock.advance(ms); } };
}

/** A provider that returns whatever JSON the test wants, labelled as a non-mock provider. */
class StubProvider implements ModelProvider {
  readonly name = "stub-real";
  private readonly body: unknown;
  constructor(body: unknown) {
    this.body = body;
  }
  isReady() {
    return true;
  }
  health() {
    return { provider: this.name, status: "OK" as const, detail: "stub", tiers: MODEL_TIERS.filter((t) => t !== "NO_AI") };
  }
  async generate(_req: GenerateRequest): Promise<GenerateResult> {
    return {
      provider: this.name,
      model: "stub/model",
      tier: "STANDARD_CODING",
      text: JSON.stringify(this.body),
      usage: { input_tokens: 100, output_tokens: 50 },
      estimated_cost_usd: null,
      duration_ms: 1,
      finish_reason: "stop",
      max_output_tokens: 1500,
    };
  }
  usage() {
    return { input_tokens: 100, output_tokens: 50 };
  }
}

/**
 * A provider that plays back one scripted `GenerateResult` per call (the last
 * entry repeats if there are more calls than scripts), and records every
 * request it received - used to test the truncation-retry mechanics precisely.
 */
type ScriptEntry = Partial<GenerateResult> | { throw429: { retryAfterMs?: number; resetRequestsMs?: number } };

class ScriptedProvider implements ModelProvider {
  readonly name = "stub-real";
  readonly requests: GenerateRequest[] = [];
  private readonly responses: ScriptEntry[];
  constructor(responses: ScriptEntry[]) {
    this.responses = responses;
  }
  isReady() {
    return true;
  }
  health() {
    return { provider: this.name, status: "OK" as const, detail: "stub", tiers: MODEL_TIERS.filter((t) => t !== "NO_AI") };
  }
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    this.requests.push(req);
    const script = this.responses[Math.min(this.requests.length - 1, this.responses.length - 1)]!;
    if ("throw429" in script) {
      throw new RateLimitError("stub-real responded 429 (rate limited)", {
        httpStatus: 429,
        observedAtMs: 0,
        retryAfterMs: script.throw429.retryAfterMs ?? 3000,
        limitRequests: 30,
        remainingRequests: 0,
        resetRequestsMs: script.throw429.resetRequestsMs ?? 3000,
        limitTokens: 6000,
        remainingTokens: 0,
        resetTokensMs: null,
      });
    }
    return {
      provider: this.name,
      model: "stub/model",
      tier: req.tier,
      text: script.text ?? "",
      usage: script.usage ?? { input_tokens: 200, output_tokens: 50 },
      estimated_cost_usd: null,
      duration_ms: 1,
      finish_reason: script.finish_reason ?? "stop",
      max_output_tokens: req.maxOutputTokens,
      rate_limit: script.rate_limit ?? null,
      structured_output: script.structured_output,
    };
  }
  usage() {
    return { input_tokens: 200, output_tokens: 50 };
  }
}

function validBody(content: string) {
  return {
    status: "PASS",
    summary: "Completed the business analysis for the GET /health requirement.",
    reasoningSummary: "Reviewed the task, drafted requirements and acceptance criteria, handed off to review.",
    artifacts: [{ path: "business_analysis.md", kind: "report", content }],
    recommendations: ["proceed to spec review"],
    requestedToolCalls: [],
    handoff: { to: "engineering-director", why: "requirements ready for review" },
    qualityEvidence: [{ check: "requirements-complete", result: "PASS", detail: "scope and acceptance criteria captured" }],
    risks: [],
    errors: [],
  };
}

/** Text that starts a JSON object but is cut off mid-string - exactly what a
 *  token-limited completion looks like: the scanner opens braces/strings and
 *  never returns to depth 0, so `extractJsonObject` reports "unbalanced braces". */
const TRUNCATED_JSON_PREFIX =
  '{"status": "PASS", "summary": "Completed the business analysis and drafted the full requirements ' +
  "document covering scope, acceptance criteria, non-functional requirements and a lot more detail that";

function baseRunArgs(rt: ReturnType<typeof memoryRuntime>, w: ProofWorkspace) {
  const wf = rt.registries.workflows.get("feature-development");
  const step = wf.steps.find((s) => s.id === "business_analysis")!;
  const ba = rt.registries.agents.get("business-analyst");
  const task = rt.orchestrator.tasks.create({ title: "t", description: "d", project: "p" });
  const { run } = rt.orchestrator.plan(task);
  return {
    agent: ba,
    workflow: wf,
    step,
    task,
    run: rt.workflows.getRun(run.id),
    priorArtifacts: [],
    workspace: w,
    budget: new RequestBudget(),
  };
}

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "rar-"));
  const w = new ProofWorkspace({ buildRoot: dir, taskId: "task_test", seedFrom: join(paths.fixtures, "demo-service") });
  return { w, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("a read-only reviewer requesting workspace.write is DENIED by the gateway and nothing is written", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const wf = rt.registries.workflows.get("feature-development");
    const step = wf.steps.find((s) => s.id === "code_review")!;
    const reviewer = rt.registries.agents.get("senior-code-reviewer");
    const task = rt.orchestrator.tasks.create({ title: "t", description: "d", project: "p" });
    const { run } = rt.orchestrator.plan(task);

    const runner = new RealAgentRunner(
      rt.registries,
      new StubProvider({
        status: "PASS",
        summary: "review done",
        reasoningSummary: "looks additive; approving",
        artifacts: [{ path: "review.md", kind: "report", content: "# review" }],
        recommendations: [],
        requestedToolCalls: [
          { tool: "workspace.write", args: { path: "src/hack.js", content: "x" }, reason: "sneak an edit" },
        ],
        handoff: null,
        qualityEvidence: [],
        risks: [],
        errors: [],
      }),
      "REAL / stub",
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
    );

    const outcome = await runner.runStage({
      agent: reviewer,
      workflow: wf,
      step,
      task,
      run: rt.workflows.getRun(run.id),
      priorArtifacts: [],
      plan: {
        allowedRuntimeTools: ["workspace.read", "workspace.list"],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: true,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
      },
      workspace: w,
      budget: new RequestBudget(),
    });

    const write = outcome.toolCalls.find((c) => c.tool === "workspace.write")!;
    assert.equal(write.executed, false);
    assert.equal(write.decision, "DENY");
    assert.equal(w.hasChanges(), false);
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("tool_call_out_of_scope") || e.result === "BLOCKED"));
  } finally {
    rt.close();
    cleanup();
  }
});

test("the request budget ceiling aborts a stage cleanly (no uncontrolled loop)", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const wf = rt.registries.workflows.get("feature-development");
    const step = wf.steps.find((s) => s.id === "business_analysis")!;
    const ba = rt.registries.agents.get("business-analyst");
    const task = rt.orchestrator.tasks.create({ title: "t", description: "d", project: "p" });
    const { run } = rt.orchestrator.plan(task);

    const runner = new RealAgentRunner(
      rt.registries,
      new StubProvider("prose only, never valid"),
      "REAL / stub",
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
    );
    const budget = new RequestBudget({ target: 1, ceiling: 1 });

    await assert.rejects(
      () =>
        runner.runStage({
          agent: ba,
          workflow: wf,
          step,
          task,
          run: rt.workflows.getRun(run.id),
          priorArtifacts: [],
          plan: {
            allowedRuntimeTools: [],
            includeWorkspaceFiles: false,
            includeWorkspaceDiff: false,
            runTests: false,
            runSecurityScan: false,
            requireWorkspaceChange: false,
          },
          workspace: w,
          budget,
        }),
      /REQUEST_BUDGET_EXCEEDED/,
    );
    assert.equal(budget.count, 1);
  } finally {
    rt.close();
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Regression: output-token budget (build spec section 29 update). The original
// 1800-token cap truncated the AgentExecutionResult JSON before it closed. The
// runner now defaults to a larger, still-bounded budget, classifies a failed
// parse as OUTPUT_TRUNCATED vs MALFORMED, and retries truncation once with a
// raised (still bounded) budget and a compact-JSON instruction.
// ---------------------------------------------------------------------------

test("clampMaxOutputTokens: bounded, never unlimited", () => {
  assert.equal(clampMaxOutputTokens(undefined, DEFAULT_AGENT_MAX_OUTPUT_TOKENS), DEFAULT_AGENT_MAX_OUTPUT_TOKENS);
  assert.equal(clampMaxOutputTokens(8000, DEFAULT_AGENT_MAX_OUTPUT_TOKENS), 8000);
  // A caller cannot ask for an unbounded budget - it clamps to the ceiling.
  assert.equal(clampMaxOutputTokens(1_000_000, DEFAULT_AGENT_MAX_OUTPUT_TOKENS), AGENT_MAX_OUTPUT_TOKENS_CEILING);
  assert.equal(clampMaxOutputTokens(0, DEFAULT_AGENT_MAX_OUTPUT_TOKENS), MIN_AGENT_MAX_OUTPUT_TOKENS);
});

test("REAL stage: a large but complete structured response (> old 1800-token limit) PASSES in one attempt", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    // ~2200 output tokens by the runtime's own estimate (chars/4) - would have
    // exceeded the old 1800-token cap, but is well under the new 6000 default.
    const bigContent = "Requirements detail. ".repeat(400);
    const provider = new ScriptedProvider([
      { text: JSON.stringify(validBody(bigContent)), finish_reason: "stop", usage: { input_tokens: 500, output_tokens: 2200 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit);

    const outcome = await runner.runStage({
      ...baseRunArgs(rt, w),
      plan: {
        allowedRuntimeTools: [],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: false,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
      },
    });

    assert.equal(outcome.outcome, "PASS");
    assert.equal(outcome.attempts, 1);
    assert.equal(provider.requests[0]!.maxOutputTokens, DEFAULT_AGENT_MAX_OUTPUT_TOKENS);
    const audit = rt.audit.list(1_000_000);
    assert.ok(!audit.some((e) => e.action.startsWith("output_truncated:") || e.action.startsWith("malformed_agent_result:")));
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: finish_reason=length is detected as OUTPUT_TRUNCATED, retried once, and the retry succeeds", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const provider = new ScriptedProvider([
      // Attempt 1: cut off mid-string, provider reports the length stop reason.
      { text: TRUNCATED_JSON_PREFIX, finish_reason: "length", usage: { input_tokens: 500, output_tokens: 500 } },
      // Attempt 2 (retry, raised budget): a complete, valid response.
      { text: JSON.stringify(validBody("concise requirements")), finish_reason: "stop", usage: { input_tokens: 520, output_tokens: 180 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit);

    const outcome = await runner.runStage({
      ...baseRunArgs(rt, w),
      plan: {
        allowedRuntimeTools: [],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: false,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
        maxOutputTokens: 1200, // small, explicit budget (above the floor) so the retry-doubling is easy to assert
      },
    });

    assert.equal(outcome.outcome, "PASS");
    assert.equal(outcome.attempts, 2);
    assert.equal(provider.requests.length, 2);
    assert.equal(provider.requests[0]!.maxOutputTokens, 1200);
    // Truncation retry doubles the budget (bounded), unlike a plain malformed retry.
    assert.equal(provider.requests[1]!.maxOutputTokens, 2400);
    assert.match(provider.requests[1]!.prompt, /TRUNCATED/);
    assert.match(provider.requests[1]!.prompt, /compact|minified/i);

    const audit = rt.audit.list(1_000_000);
    const truncatedEvent = audit.find((e) => e.action.startsWith("output_truncated:"));
    assert.ok(truncatedEvent, "expected an output_truncated audit event for attempt 1");
    assert.equal(truncatedEvent!.result, "PENDING");
    assert.match(truncatedEvent!.reason, /finish_reason=length/);
    assert.ok(!audit.some((e) => e.action.startsWith("malformed_agent_result:")), "truncation must not be logged as plain malformed");
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: truncation that persists through the bounded retry BLOCKS as OUTPUT_TRUNCATED", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const provider = new ScriptedProvider([
      { text: TRUNCATED_JSON_PREFIX, finish_reason: "length", usage: { input_tokens: 500, output_tokens: 500 } },
      { text: TRUNCATED_JSON_PREFIX, finish_reason: "length", usage: { input_tokens: 500, output_tokens: 1000 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit);

    const outcome = await runner.runStage({
      ...baseRunArgs(rt, w),
      plan: {
        allowedRuntimeTools: [],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: false,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
        maxOutputTokens: 500,
      },
    });

    assert.equal(outcome.outcome, "BLOCKED");
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.modelStatus, "OUTPUT_TRUNCATED");
    assert.equal(outcome.execution.status, "BLOCKED");
    assert.match(outcome.execution.summary, /truncat/i);
    assert.ok(outcome.enforcementNotes.some((n) => /truncat/i.test(n)));
    // Never guessed a result and never fabricated an artifact from a truncated body.
    assert.deepEqual(outcome.execution.artifacts, []);

    const audit = rt.audit.list(1_000_000);
    const final = audit.filter((e) => e.action.startsWith("output_truncated:")).at(-1);
    assert.ok(final);
    assert.equal(final!.result, "BLOCKED");
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: malformed (non-truncated) output still BLOCKS as MALFORMED, not OUTPUT_TRUNCATED - validation is not weakened", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    // Complete, well-formed-looking prose response (no truncation signal at all):
    // finish_reason "stop" and output_tokens far below the requested budget.
    const provider = new ScriptedProvider([
      { text: "Sure! Here is my analysis in prose with no JSON object at all.", finish_reason: "stop", usage: { input_tokens: 300, output_tokens: 40 } },
      { text: "Still just prose, no JSON here either.", finish_reason: "stop", usage: { input_tokens: 300, output_tokens: 40 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit);

    const outcome = await runner.runStage({
      ...baseRunArgs(rt, w),
      plan: {
        allowedRuntimeTools: [],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: false,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
      },
    });

    assert.equal(outcome.outcome, "BLOCKED");
    assert.equal(outcome.modelStatus, "MALFORMED");
    // The retry budget was NOT doubled - only a truncation retry raises it.
    assert.equal(provider.requests[1]!.maxOutputTokens, provider.requests[0]!.maxOutputTokens);

    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("malformed_agent_result:")));
    assert.ok(!audit.some((e) => e.action.startsWith("output_truncated:")));
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: StagePlan.maxOutputTokens overrides the runner default (clamped to the ceiling, never unlimited)", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const provider = new ScriptedProvider([
      { text: JSON.stringify(validBody("short")), finish_reason: "stop", usage: { input_tokens: 100, output_tokens: 40 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit);

    await runner.runStage({
      ...baseRunArgs(rt, w),
      plan: {
        allowedRuntimeTools: [],
        includeWorkspaceFiles: false,
        includeWorkspaceDiff: false,
        runTests: false,
        runSecurityScan: false,
        requireWorkspaceChange: false,
        maxOutputTokens: 999_999, // must never reach the provider unbounded
      },
    });

    assert.equal(provider.requests[0]!.maxOutputTokens, AGENT_MAX_OUTPUT_TOKENS_CEILING);
  } finally {
    rt.close();
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Rate-limit hardening (build spec sections 12, 14). All tests use a fake sleep
// that advances a fixed clock - nothing actually waits.
// ---------------------------------------------------------------------------

const analysisPlan = {
  allowedRuntimeTools: [] as string[],
  includeWorkspaceFiles: false,
  includeWorkspaceDiff: false,
  runTests: false,
  runSecurityScan: false,
  requireWorkspaceChange: false,
  maxOutputTokens: 2000,
};

test("REAL stage: a 429 is followed by a reset-window wait, then a successful retry of the SAME stage", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  const ft = fakeSleep();
  try {
    const provider = new ScriptedProvider([
      { throw429: { retryAfterMs: 9000, resetRequestsMs: 9000 } },
      { text: JSON.stringify(validBody("concise requirements")), finish_reason: "stop", usage: { input_tokens: 300, output_tokens: 120 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit, {
      clock: ft.clock,
      sleep: ft.sleep,
      rateLimit: { jitterMs: 0, minIntervalMs: 0, maxRetryCycles: 3 },
    });

    const outcome = await runner.runStage({ ...baseRunArgs(rt, w), plan: analysisPlan });

    assert.equal(outcome.outcome, "PASS");
    assert.equal(provider.requests.length, 2, "the same stage was retried exactly once after the wait");
    assert.deepEqual(ft.slept, [9000], "waited exactly the Retry-After window, once");
    assert.equal(outcome.rateLimitWaits.length, 1);
    assert.equal(outcome.rateLimitWaits[0]!.kind, "retry_after");
    assert.equal(outcome.rateLimitWaits[0]!.cycle, 1);

    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action === "rate_limit_wait:business_analysis" && e.result === "PENDING"));
    // The 429 cycle did NOT consume a structured attempt: only one real_model_call is PASS.
    assert.equal(audit.filter((e) => e.action === "real_model_call:business_analysis" && e.result === "PASS").length, 1);
    // Credential-free.
    assert.ok(!JSON.stringify(audit).includes("Bearer"));
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: repeated 429 across the bounded cycles BLOCKS as RATE_LIMIT_EXHAUSTED with the checkpoint preserved", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  const ft = fakeSleep();
  try {
    const provider = new ScriptedProvider([
      { throw429: { retryAfterMs: 4000 } },
      { throw429: { retryAfterMs: 4000 } },
      { throw429: { retryAfterMs: 4000 } },
      { throw429: { retryAfterMs: 4000 } },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit, {
      clock: ft.clock,
      sleep: ft.sleep,
      rateLimit: { jitterMs: 0, minIntervalMs: 0, maxRetryCycles: 3 },
    });

    const args = baseRunArgs(rt, w);
    await assert.rejects(
      () => runner.runStage({ ...args, plan: analysisPlan }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as { code?: string }).code, "RATE_LIMIT_EXHAUSTED");
        return true;
      },
    );

    // Bounded: exactly maxRetryCycles waits, then give up (4 HTTP attempts total).
    assert.equal(ft.slept.length, 3);
    assert.equal(provider.requests.length, 4);

    // Checkpoint preserved: the workflow run is untouched (still RUNNING, the
    // stage was never submitted/marked complete - no duplicate or partial progress).
    const run = rt.workflows.getRun(args.run.id);
    assert.equal(run.status, "RUNNING");
    assert.ok(!run.history.some((h) => h.step_id === "business_analysis" && h.result === "PASS"));
    // No successful model call, no tool execution, no cost row for a completed call.
    const audit = rt.audit.list(1_000_000);
    assert.ok(!audit.some((e) => e.action === "real_model_call:business_analysis" && e.result === "PASS"));
    assert.ok(!audit.some((e) => e.action.startsWith("tool_executed:")));
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: the AgentExecutionResult JSON Schema is sent as response_format when the provider supports it", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const provider = new ScriptedProvider([
      { text: JSON.stringify(validBody("ok")), finish_reason: "stop", structured_output: true },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit, {
      nativeStructuredOutput: true,
    });
    await runner.runStage({ ...baseRunArgs(rt, w), plan: analysisPlan });

    const rs = provider.requests[0]!.responseSchema!;
    assert.ok(rs, "expected responseSchema to be passed to the provider");
    assert.equal(rs.name, "AgentExecutionResult");
    assert.equal(rs.strict, true);
    assert.equal((rs.schema as Record<string, unknown>).additionalProperties, false);
    assert.ok(Array.isArray((rs.schema as Record<string, unknown>).required));
    // Reasoning effort defaults low, or per-plan.
    assert.equal(provider.requests[0]!.reasoningEffort, "low");
  } finally {
    rt.close();
    cleanup();
  }
});

test("REAL stage: nativeStructuredOutput=false omits response_format (provider-agnostic; still validated)", async () => {
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const provider = new ScriptedProvider([
      { text: JSON.stringify(validBody("ok")), finish_reason: "stop" },
    ]);
    const runner = new RealAgentRunner(rt.registries, provider, "REAL / stub", rt.gateway, rt.cost, rt.observability, rt.audit, {
      nativeStructuredOutput: false,
    });
    const outcome = await runner.runStage({ ...baseRunArgs(rt, w), plan: analysisPlan });
    assert.equal(provider.requests[0]!.responseSchema, undefined);
    assert.equal(outcome.outcome, "PASS"); // parsing/validation still ran
  } finally {
    rt.close();
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Regression (Runtime V1.1): a PROOF_PROVIDER that advertises JSON-Schema
// structured output but rejects THIS schema with HTTP 400 must self-heal ONCE to
// response_format json_object, record safe (credential-free) telemetry, and keep
// full AgentExecutionResult validation on the fallback response.
// ---------------------------------------------------------------------------

const KEY_400 = "gsk-fake-schema-400-key-000";

function groqProviderAt(baseUrl: string) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: KEY_400,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
  }).descriptor!.provider;
}

test("REAL stage: a provider HTTP 400 rejecting the schema falls back to json_object once and still PASSES (validated)", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0, rejectJsonSchema: true });
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const runner = new RealAgentRunner(
      rt.registries,
      groqProviderAt(srv.baseUrl),
      "REAL / Groq Direct proof",
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
      { nativeStructuredOutput: true },
    );
    const outcome = await runner.runStage({ ...baseRunArgs(rt, w), plan: analysisPlan });

    assert.equal(outcome.outcome, "PASS");
    assert.equal(outcome.attempts, 1, "the schema fallback is internal to the provider - not a structured retry");

    const modes = srv.responseFormatModes();
    assert.equal(modes[0], "json_schema", "first wire request used strict json_schema");
    assert.equal(modes[1], "json_object", "after the 400 it fell back to json_object");

    const audit = rt.audit.list(1_000_000);
    const rej = audit.find((e) => e.action === "structured_schema_rejected:business_analysis");
    assert.ok(rej, "expected a structured_schema_rejected audit event");
    assert.equal(rej!.result, "PENDING");
    assert.match(rej!.reason, /HTTP 400/);
    assert.match(rej!.reason, /json_object/);
    assert.match(rej!.reason, /parsed and validated/);
    const call = audit.find((e) => e.action === "real_model_call:business_analysis" && e.result === "PASS");
    assert.match(call!.reason, /structured_output_mode=json_object/);

    // No credential anywhere.
    assert.equal(JSON.stringify(audit).includes(KEY_400), false);
  } finally {
    rt.close();
    await srv.close();
    cleanup();
  }
});

test("REAL stage: a malformed json_object fallback response is still REJECTED - validation is not bypassed", async () => {
  const srv = await startFakeOpenAiServer({
    reportCost: 0,
    rejectJsonSchema: true,
    malformedAfterSchemaFallback: true, // the json_object fallback returns prose, not JSON
  });
  const rt = memoryRuntime();
  const { w, cleanup } = workspace();
  try {
    const runner = new RealAgentRunner(
      rt.registries,
      groqProviderAt(srv.baseUrl),
      "REAL / Groq Direct proof",
      rt.gateway,
      rt.cost,
      rt.observability,
      rt.audit,
      { nativeStructuredOutput: true },
    );
    const outcome = await runner.runStage({ ...baseRunArgs(rt, w), plan: analysisPlan });

    // The fallback did not smuggle unvalidated output through: the stage BLOCKS.
    assert.equal(outcome.outcome, "BLOCKED");
    assert.equal(outcome.modelStatus, "MALFORMED");
    assert.deepEqual(outcome.execution.artifacts, []);

    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action === "structured_schema_rejected:business_analysis"));
    assert.ok(audit.some((e) => e.action.startsWith("malformed_agent_result:")));
    assert.equal(JSON.stringify(audit).includes(KEY_400), false);
  } finally {
    rt.close();
    await srv.close();
    cleanup();
  }
});
