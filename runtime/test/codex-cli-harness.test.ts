import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import {
  CodexCliHarness,
  classifyCodexRun,
  runViaSpawn,
  type CodexRunExecFn,
} from "../src/agents/codex-cli-harness.ts";
import { resolvePremiumImplProvider } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";

/**
 * Runtime V1.1 - PREMIUM implementation via the Codex CLI harness (ChatGPT
 * login, no paid OpenAI API credit). Fully deterministic: `codex` is a mocked
 * exec/run, no network, no real auth. Every runtime quality gate stays
 * authoritative - Codex declaring success is never sufficient.
 *
 * Root cause fixed here (2026-09-02): `promisify(execFile)` left the Codex child
 * an open stdin pipe with no EOF; Codex 0.152.1 blocks in "Reading additional
 * input from stdin..." forever. The harness now uses `spawn` with
 * `stdio[0] = "ignore"` (stdin = /dev/null) and kills the whole process group on
 * timeout.
 */

const FAKE_OPENAI_KEY = "codex-test-fake-openai-key-should-be-stripped-0123456789";

const GOOD_SERVER_JS = `import { createServer } from "node:http";
export function handler(req, res) {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "demo-service" }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  createServer(handler).listen(Number(process.env.PORT ?? 3000));
}
`;

const GOOD_TEST_JS = `import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../src/server.js";
test("GET /health -> 200 {status:ok}", async () => {
  let status = 0;
  let body = "";
  const res = { writeHead(s) { status = s; }, end(b) { body = b ?? ""; } };
  handler({ method: "GET", url: "/health" }, res);
  assert.equal(status, 200);
  assert.deepEqual(JSON.parse(body), { status: "ok" });
});
`;

/** Options for the mocked `codex` command. */
interface CodexMock {
  version?: string;
  loginStdout?: string;
  /** Files the fake Codex "writes" per exec run (index 0 = primary, 1 = repair). */
  writesPerCall?: Record<string, string>[];
  /** Per-run exit code (default 0). */
  exitPerCall?: number[];
  /** Per-run stderr text (used by classifyCodexRun). */
  stderrPerCall?: string[];
  /** Per-run timed-out flag. */
  timedOutPerCall?: boolean[];
  /** Assert every env this mock receives has OPENAI_API_KEY stripped. */
  assertKeyStripped?: boolean;
  sink: { execCalls: number; prompts: string[]; sawKey: boolean };
}

/** Mock for `detect()` only (codex --version / codex login status). */
function makeCodexExec(mock: CodexMock) {
  return async (
    _file: string,
    args: string[],
    opts: { env?: NodeJS.ProcessEnv },
  ): Promise<{ stdout: string; stderr: string }> => {
    if (mock.assertKeyStripped && opts.env && "OPENAI_API_KEY" in opts.env) mock.sink.sawKey = true;
    if (args[0] === "--version") return { stdout: mock.version ?? "codex-cli 0.152.1", stderr: "" };
    if (args[0] === "login" && args[1] === "status") {
      return { stdout: mock.loginStdout ?? "Logged in using ChatGPT", stderr: "" };
    }
    return { stdout: "", stderr: "" };
  };
}

/** Mock for `runImplementation()` - the `codex exec` run. */
function makeCodexRunExec(mock: CodexMock): CodexRunExecFn {
  return async (args, opts) => {
    if (mock.assertKeyStripped && "OPENAI_API_KEY" in opts.env) mock.sink.sawKey = true;
    const i = mock.sink.execCalls;
    mock.sink.execCalls++;
    const cd = args[args.indexOf("--cd") + 1]!;
    mock.sink.prompts.push(args[args.length - 1]!);
    const writes = mock.writesPerCall?.[Math.min(i, (mock.writesPerCall?.length ?? 1) - 1)] ?? {};
    for (const [rel, content] of Object.entries(writes)) {
      const abs = join(cd, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
    const timedOut = mock.timedOutPerCall?.[i] ?? false;
    const exitCode = timedOut ? 124 : (mock.exitPerCall?.[i] ?? 0);
    return {
      exitCode,
      timedOut,
      killedProcessTree: timedOut,
      stdout: `{"type":"thread.started"}\n{"type":"turn.completed"}\ncodex\ntokens used 4,210\n`,
      stderr: mock.stderrPerCall?.[i] ?? "",
    };
  };
}

function harnessFor(mock: CodexMock, env: NodeJS.ProcessEnv = {}) {
  return new CodexCliHarness({
    exec: makeCodexExec(mock) as never,
    runExec: makeCodexRunExec(mock),
    env: { ...env },
    timeoutMs: 5_000,
    scratchDir: mkdtempSync(join(tmpdir(), "codex-scratch-")),
  });
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "codex-proof-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// 1-2. Detection.
// ---------------------------------------------------------------------------

test("codex detection: available + ChatGPT-logged-in from `codex --version` / `codex login status` only", async () => {
  const d = await harnessFor({ sink: { execCalls: 0, prompts: [], sawKey: false } }).detect();
  assert.equal(d.available, true);
  assert.equal(d.loggedIn, true);
  assert.equal(d.version, "codex-cli 0.152.1");
});

test("codex detection: not logged in when `codex login status` does not report ChatGPT", async () => {
  const d = await harnessFor({ sink: { execCalls: 0, prompts: [], sawKey: false }, loginStdout: "Not logged in" }).detect();
  assert.equal(d.available, true);
  assert.equal(d.loggedIn, false);
  assert.match(d.reason, /not logged in/i);
});

test("codex detection: unavailable when `codex --version` errors (no auth file read)", async () => {
  const exec = async (_f: string, args: string[]) => {
    if (args[0] === "--version") throw new Error("command not found: codex");
    return { stdout: "", stderr: "" };
  };
  const h = new CodexCliHarness({ exec: exec as never, env: {}, scratchDir: tmpdir() });
  const d = await h.detect();
  assert.equal(d.available, false);
  assert.equal(d.loggedIn, false);
});

// ---------------------------------------------------------------------------
// 3-4. Authorization / registration.
// ---------------------------------------------------------------------------

test("codex-cli premium is authorization-gated: authorized only with the explicit env flag", () => {
  assert.equal(resolvePremiumImplProvider({}).authorized, false);
  const s = resolvePremiumImplProvider({ AI_COMPANY_PREMIUM_IMPL_PROVIDER: "codex-cli" });
  assert.equal(s.authorized, true);
  assert.equal(s.kind, "codex-cli");
  assert.equal(s.descriptor, null);
  assert.equal(s.codex!.id, "codex-cli");
  assert.equal(resolvePremiumImplProvider({ AI_COMPANY_PREMIUM_IMPL_PROVIDER: "chatgpt" }).kind, "codex-cli");
});

test("codex harness strips OPENAI_API_KEY from the child environment (never uses a paid key)", async () => {
  const mock: CodexMock = { sink: { execCalls: 0, prompts: [], sawKey: false }, assertKeyStripped: true };
  const h = harnessFor(mock, { OPENAI_API_KEY: FAKE_OPENAI_KEY, PATH: "/usr/bin" });
  await h.detect();
  const t = tmp();
  try {
    const r = await h.runImplementation({ workspaceRoot: t.dir, prompt: "do the thing" });
    assert.equal(mock.sink.sawKey, false, "OPENAI_API_KEY reached the codex child env");
    assert.ok(!r.invocation.includes(FAKE_OPENAI_KEY));
    assert.ok(!r.stdoutTail.includes(FAKE_OPENAI_KEY));
    // The invocation records stdin is redirected from /dev/null.
    assert.match(r.invocation, /<\/dev\/null/);
  } finally {
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 6. Regression: process behaviour of the real spawn runner (via a stub bin).
// ---------------------------------------------------------------------------

function stubBin(dir: string, body: string): string {
  const p = join(dir, "stub.sh");
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

test("runViaSpawn: child that ignores stdin and exits 0 -> normal exit, stdout/stderr captured, stdin closed", async () => {
  const d = mkdtempSync(join(tmpdir(), "stub-"));
  try {
    // If stdin were an open pipe, `cat` would hang; with stdio ignore it EOFs instantly.
    const bin = stubBin(d, 'cat; echo "OUT_LINE"; echo "ERR_LINE" 1>&2; exit 0');
    const r = await runViaSpawn(bin, [], { cwd: d, env: process.env as NodeJS.ProcessEnv, timeoutMs: 10_000 });
    assert.equal(r.exitCode, 0);
    assert.equal(r.timedOut, false);
    assert.equal(r.killedProcessTree, false);
    assert.match(r.stdout, /OUT_LINE/);
    assert.match(r.stderr, /ERR_LINE/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("runViaSpawn: a child that hangs is killed at the deadline, and its whole process tree is reaped", async () => {
  const d = mkdtempSync(join(tmpdir(), "stub-"));
  try {
    // Spawn a background sleeper, write its pid, then sleep forever in the foreground.
    const bin = stubBin(d, `( sleep 300 & echo $! > "${d}/child.pid" ); sleep 300`);
    const t0 = Date.now();
    const r = await runViaSpawn(bin, [], { cwd: d, env: process.env as NodeJS.ProcessEnv, timeoutMs: 1_200 });
    assert.equal(r.timedOut, true);
    assert.equal(r.killedProcessTree, true);
    assert.ok(Date.now() - t0 < 8_000, "should return promptly after the timeout, not hang");
    // Give SIGKILL a moment, then assert the descendant sleeper is gone.
    await new Promise((res) => setTimeout(res, 500));
    const pid = Number(readFileSync(join(d, "child.pid"), "utf8").trim());
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    assert.equal(alive, false, `descendant pid ${pid} survived the process-tree kill`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("classifyCodexRun: TIMEOUT / SUCCESS / AUTH_REQUIRED / APPROVAL_BLOCKED / PROCESS_ERROR", () => {
  assert.equal(classifyCodexRun(124, true, "anything"), "CODEX_TIMEOUT");
  assert.equal(classifyCodexRun(0, false, "done"), "CODEX_SUCCESS");
  assert.equal(classifyCodexRun(1, false, "error: not logged in; please run `codex login`"), "CODEX_AUTH_REQUIRED");
  assert.equal(classifyCodexRun(1, false, "authentication expired, re-authenticate"), "CODEX_AUTH_REQUIRED");
  assert.equal(classifyCodexRun(1, false, "the command requires approval and none was granted"), "CODEX_APPROVAL_BLOCKED");
  assert.equal(classifyCodexRun(1, false, "operation not permitted by the sandbox"), "CODEX_APPROVAL_BLOCKED");
  assert.equal(classifyCodexRun(2, false, "some other failure"), "CODEX_PROCESS_ERROR");
});

// ---------------------------------------------------------------------------
// 5, 7-12. End-to-end through the Software Factory proof.
// ---------------------------------------------------------------------------

async function runProofWithCodex(mock: CodexMock, extraEnv: NodeJS.ProcessEnv = {}) {
  const rt = memoryRuntime();
  const t = tmp();
  const { startFakeOpenAiServer } = await import("./fake-openai-server.ts");
  const free = await startFakeOpenAiServer({ reportCost: 0, modelId: "groq/gpt-oss-fake" });
  const { buildRealProvider } = await import("../src/models/real-provider.ts");
  const freeDescriptor = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: free.baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: "free-fake-key-0123456789",
    AI_COMPANY_REAL_MAX_RETRIES: "1",
  }).descriptor!;
  const result = await runSoftwareFactoryProof(rt, {
    mode: "REAL",
    sleep: async () => {},
    descriptor: freeDescriptor,
    fallbackDescriptors: [],
    premiumImpl: {
      kind: "codex-cli",
      codexHarness: harnessFor(mock, { OPENAI_API_KEY: FAKE_OPENAI_KEY, ...extraEnv }),
      codexLabel: "PREMIUM / Codex CLI (ChatGPT)",
      codexModel: "",
    },
    buildRoot: t.dir,
    budget: new RequestBudget(),
  });
  const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
  return {
    result,
    audit,
    cleanup: async () => {
      rt.close();
      await free.close();
      t.cleanup();
    },
  };
}

test("codex premium: a correct implementation reaches Human approval; only the implementation stage uses Codex; reviewer independent", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    writesPerCall: [{ "src/server.js": GOOD_SERVER_JS, "test/health.test.js": GOOD_TEST_JS }],
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");

    assert.ok(result.premiumEscalation);
    assert.equal(result.premiumEscalation!.kind, "codex-cli");
    assert.equal(result.premiumEscalation!.provider, "codex-cli");
    assert.equal(result.premiumEscalation!.outcome, "PASS");
    assert.equal(result.premiumEscalation!.requests, 1);
    assert.equal(result.premiumEscalation!.repairs, 0);
    assert.equal(result.premiumEscalation!.codexTokensUsed, 4210);
    assert.deepEqual(result.premiumEscalation!.changedFiles.sort(), ["src/server.js", "test/health.test.js"]);

    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    assert.equal(byStage.implementation!.providerId, "codex-premium");
    for (const s of ["business_analysis", "spec_review", "architecture", "plan", "code_review", "qa", "security", "release_review"]) {
      assert.notEqual(byStage[s]!.providerId, "codex-premium", `${s} must not use Codex`);
    }
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);
    assert.equal(byStage.code_review!.agentId, "senior-code-reviewer");

    assert.equal(byStage.implementation!.testEvidence!.exitCode, 0);
    assert.ok(byStage.implementation!.testEvidence!.passed >= 1);
    assert.ok(audit.some((e) => e.action === "qa_test_execution:implementation" && e.result === "PASS"));
    assert.ok(audit.some((e) => e.action === "premium_escalation:implementation" && e.result === "PENDING"));
    assert.ok(audit.some((e) => e.action === "premium_escalation_result:implementation" && e.result === "PASS"));
    assert.ok(audit.some((e) => /status=CODEX_SUCCESS/.test(e.reason)));
    assert.equal(mock.sink.execCalls, 1);

    assert.ok(!JSON.stringify(result).includes(FAKE_OPENAI_KEY));
    assert.ok(!JSON.stringify(audit).includes(FAKE_OPENAI_KEY));
  } finally {
    await cleanup();
  }
});

test("codex premium: a first-pass failure gets ONE targeted repair (bounded to 2 execs), then PASSES", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    writesPerCall: [
      { "src/server.js": GOOD_SERVER_JS },
      { "src/server.js": GOOD_SERVER_JS, "test/health.test.js": GOOD_TEST_JS },
    ],
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.premiumEscalation!.outcome, "PASS");
    assert.equal(result.premiumEscalation!.requests, 2);
    assert.equal(result.premiumEscalation!.repairs, 1);
    assert.equal(mock.sink.execCalls, 2);
    assert.match(mock.sink.prompts[1]!, /REPAIR PASS/i);
    assert.match(mock.sink.prompts[1]!, /deterministic failure evidence/i);
    assert.ok(audit.some((e) => e.action === "premium_codex_exec:implementation:repair1"));
  } finally {
    await cleanup();
  }
});

test("codex premium: still failing after the one repair -> PREMIUM_IMPLEMENTATION_FAILED, STOP, no free fallback", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    writesPerCall: [{ "src/server.js": GOOD_SERVER_JS }, { "src/server.js": GOOD_SERVER_JS }], // never adds a test
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.equal(result.stopped_because, "premium_implementation_failed");
    assert.equal(result.premiumEscalation!.outcome, "PREMIUM_IMPLEMENTATION_FAILED");
    assert.equal(mock.sink.execCalls, 2, "bounded to one primary + one repair");
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.notEqual(impl.outcome, "PASS");
    assert.ok(impl.enforcement!.some((n) => /test/i.test(n)));
    assert.ok(!result.providerTransitions.some((tr) => tr.stage === "implementation"));
    assert.ok(!audit.some((e) => e.action === "provider_transition:implementation"));
    assert.ok(!audit.some((e) => e.action.startsWith("real_model_call:implementation")));
  } finally {
    await cleanup();
  }
});

test("codex premium: Codex not logged in -> PREMIUM_PROVIDER_UNAVAILABLE, STOP, no codex exec, no free fallback", async () => {
  const mock: CodexMock = { sink: { execCalls: 0, prompts: [], sawKey: false }, loginStdout: "Not logged in" };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.equal(result.stopped_because, "premium_provider_unavailable");
    assert.match(result.blockReason!, /PREMIUM_IMPLEMENTATION_FAILED/);
    assert.match(result.premiumEscalation!.detail, /BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE/);
    assert.equal(mock.sink.execCalls, 0, "no codex exec when not logged in");
    assert.ok(audit.some((e) => e.action === "premium_escalation_failed:implementation"));
    assert.ok(!result.providerTransitions.some((tr) => tr.stage === "implementation"));
  } finally {
    await cleanup();
  }
});

test("codex premium: `codex exec` returns CODEX_AUTH_REQUIRED at run time -> PREMIUM_PROVIDER_UNAVAILABLE, STOP, no repair", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    exitPerCall: [1],
    stderrPerCall: ["error: not logged in. Please run `codex login`."],
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.stopped_because, "premium_provider_unavailable");
    assert.equal(mock.sink.execCalls, 1, "no repair after an auth failure");
    assert.match(result.premiumEscalation!.detail, /CODEX_AUTH_REQUIRED/);
    assert.ok(audit.some((e) => e.action === "premium_escalation_failed:implementation"));
  } finally {
    await cleanup();
  }
});

test("codex premium: `codex exec` returns CODEX_APPROVAL_BLOCKED -> PREMIUM_PROVIDER_UNAVAILABLE, STOP, no repair", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    exitPerCall: [1],
    stderrPerCall: ["a shell command requires approval and none was granted"],
  };
  const { result, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.stopped_because, "premium_provider_unavailable");
    assert.match(result.premiumEscalation!.detail, /CODEX_APPROVAL_BLOCKED/);
  } finally {
    await cleanup();
  }
});

test("codex premium: `codex exec` times out on primary + repair -> PREMIUM_IMPLEMENTATION_FAILED (bounded), no free fallback", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    timedOutPerCall: [true, true],
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.stopped_because, "premium_implementation_failed");
    assert.equal(mock.sink.execCalls, 2, "one primary + one repair, then stop");
    assert.ok(audit.some((e) => /status=CODEX_TIMEOUT/.test(e.reason) && /killedProcessTree=true/.test(e.reason)));
    assert.ok(!result.providerTransitions.some((tr) => tr.stage === "implementation"));
  } finally {
    await cleanup();
  }
});

test("codex premium: an out-of-scope file change is BLOCKED (only src/ test/ docs/ package.json allowed)", async () => {
  const mock: CodexMock = {
    sink: { execCalls: 0, prompts: [], sawKey: false },
    writesPerCall: [
      { "src/server.js": GOOD_SERVER_JS, "test/health.test.js": GOOD_TEST_JS, ".github/workflows/evil.yml": "on: push" },
    ],
  };
  const { result, audit, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.premiumEscalation!.outcome, "PREMIUM_IMPLEMENTATION_FAILED");
    assert.match(result.premiumEscalation!.detail, /outside the implementation scope/i);
    assert.match(result.premiumEscalation!.detail, /\.github\/workflows\/evil\.yml/);
    assert.ok(audit.some((e) => e.action === "premium_escalation_failed:implementation"));
  } finally {
    await cleanup();
  }
});

test("codex premium: Codex writes nothing -> CODEX_NO_WORKSPACE_CHANGE, gates BLOCK fail-safe", async () => {
  const mock: CodexMock = { sink: { execCalls: 0, prompts: [], sawKey: false }, writesPerCall: [{}, {}] };
  const { result, cleanup } = await runProofWithCodex(mock);
  try {
    assert.equal(result.ok, false);
    assert.equal(result.premiumEscalation!.outcome, "PREMIUM_IMPLEMENTATION_FAILED");
    assert.match(result.premiumEscalation!.detail, /CODEX_NO_WORKSPACE_CHANGE/);
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.notEqual(impl.outcome, "PASS");
    assert.ok(impl.enforcement!.length > 0);
  } finally {
    await cleanup();
  }
});

test("no premium authorization -> the implementation stage never touches Codex", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  const { startFakeOpenAiServer } = await import("./fake-openai-server.ts");
  const free = await startFakeOpenAiServer({ reportCost: 0 });
  const { buildRealProvider } = await import("../src/models/real-provider.ts");
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: buildRealProvider({
        AI_COMPANY_REAL_PROVIDER: "groq",
        AI_COMPANY_REAL_BASE_URL: free.baseUrl,
        GROQ_API_KEY: "k-fake-0123456789",
        AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
      }).descriptor!,
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.premiumEscalation, null);
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.notEqual(impl.providerId, "codex-premium");
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    await free.close();
    t.cleanup();
  }
});
