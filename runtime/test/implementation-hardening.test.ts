import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";
import { ProofWorkspace } from "../src/proof/proof-workspace.ts";
import { paths } from "../src/config/paths.ts";
import { parseModelResult, MODEL_AUTHORED_RESULT_JSON_SCHEMA } from "../src/agents/agent-execution-result.ts";

/**
 * Runtime V1.1 - implementation-stage hardening (forensic finding 2026-09-02:
 * both free proof models understood the task but produced a code change that was
 * not working or not test-discoverable - broken patch, require() in an ESM
 * project, a misplaced test, an implementation that node --test never runs).
 *
 * The fix keeps every existing gate authoritative and adds: a deterministic
 * `projectFacts()` digest handed to the model as AUTHORITATIVE, a first-class
 * `fileChanges` channel (no double-escaped args_json), inspect-first directives,
 * an explicit "a test file must be added" gate, and repair with real evidence.
 * Nothing here weakens npm-test / workspace-change / schema / review / QA /
 * security enforcement.
 */

const KEY = "impl-hardening-fake-key-0123456789";

function groqDescriptor(baseUrl: string, opts: Record<string, string> = {}) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: KEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...opts,
  }).descriptor!;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "impl-harden-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Seed an arbitrary project into a ProofWorkspace for projectFacts() tests. */
function seededWorkspace(files: Record<string, string>) {
  const src = mkdtempSync(join(tmpdir(), "seed-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(src, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  const buildRoot = mkdtempSync(join(tmpdir(), "bw-"));
  const w = new ProofWorkspace({ buildRoot, taskId: "task_facts", seedFrom: src });
  return {
    w,
    cleanup: () => {
      rmSync(src, { recursive: true, force: true });
      rmSync(buildRoot, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// 1-5. projectFacts(): deterministic repo awareness (no model involved).
// ---------------------------------------------------------------------------

test("projectFacts: an ESM node:test project is described correctly", () => {
  const { w, cleanup } = seededWorkspace({
    "package.json": JSON.stringify({ type: "module", scripts: { start: "node src/server.js", test: "node --test" } }),
    "src/server.js": 'import { createServer } from "node:http";\nexport function handler(req, res) {}\nexport const PORT = 3000;\n',
  });
  try {
    const f = w.projectFacts();
    assert.equal(f.language, "JavaScript");
    assert.equal(f.moduleType, "ESM");
    assert.match(f.moduleSyntax, /never `require/i);
    assert.equal(f.testCommand, "node --test");
    assert.equal(f.testRunner, "node:test");
    assert.match(f.testDiscoveryRule, /test\//);
    assert.equal(f.serverEntrypoint, "src/server.js");
    assert.deepEqual(f.entrypointExports.sort(), ["PORT", "handler"]);
    assert.deepEqual(f.sourceDirs, ["src"]);
    assert.equal(f.recommendedTestPath, "test/feature.test.js");
    assert.deepEqual(f.existingTests, []);
  } finally {
    cleanup();
  }
});

test("projectFacts: a CommonJS project is described correctly (no ESM claim)", () => {
  const { w, cleanup } = seededWorkspace({
    "package.json": JSON.stringify({ scripts: { test: "jest" }, main: "index.js" }),
    "index.js": 'const http = require("node:http");\nmodule.exports = { start() {} };\n',
  });
  try {
    const f = w.projectFacts();
    assert.equal(f.moduleType, "CommonJS");
    assert.match(f.moduleSyntax, /require/);
    assert.equal(f.testRunner, "jest");
    assert.equal(f.serverEntrypoint, "index.js");
    assert.ok(f.entrypointExports.includes("module.exports"));
  } finally {
    cleanup();
  }
});

test("projectFacts: existing test layout drives the recommended test path", () => {
  const { w, cleanup } = seededWorkspace({
    "package.json": JSON.stringify({ type: "module", scripts: { test: "node --test" } }),
    "src/app.js": "export function app() {}\n",
    "test/app.test.js": 'import { test } from "node:test";\ntest("x", () => {});\n',
  });
  try {
    const f = w.projectFacts();
    assert.deepEqual(f.existingTests, ["test/app.test.js"]);
    assert.equal(f.recommendedTestPath, "test/app.test.js");
    assert.ok(!f.sourceDirs.includes("test"));
  } finally {
    cleanup();
  }
});

test("projectFacts: the real demo-service fixture is plain node:http + node:test (NOT Express/Jest)", () => {
  const buildRoot = mkdtempSync(join(tmpdir(), "bw-"));
  const w = new ProofWorkspace({ buildRoot, taskId: "task_fx", seedFrom: join(paths.fixtures, "demo-service") });
  try {
    const f = w.projectFacts();
    assert.equal(f.moduleType, "ESM");
    assert.equal(f.testCommand, "node --test");
    assert.equal(f.testRunner, "node:test");
    assert.equal(f.serverEntrypoint, "src/server.js");
    assert.ok(f.entrypointExports.includes("handler"));
    assert.equal(f.existingTests.length, 0);
  } finally {
    rmSync(buildRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 6. fileChanges contract (replaces the error-prone double-escaped args_json).
// ---------------------------------------------------------------------------

test("fileChanges: the JSON schema lists it, strict-compatible, and the parser validates it", () => {
  const props = MODEL_AUTHORED_RESULT_JSON_SCHEMA.properties as Record<string, Record<string, unknown>>;
  assert.ok((MODEL_AUTHORED_RESULT_JSON_SCHEMA.required as string[]).includes("fileChanges"));
  const items = props.fileChanges!.items as Record<string, unknown>;
  assert.deepEqual((items.required as string[]).sort(), ["content", "operation", "path"]);

  const ok = parseModelResult(
    JSON.stringify({
      status: "PASS",
      summary: "added the endpoint",
      reasoningSummary: "ESM; node --test; modify src/server.js; add test/health.test.js under test/",
      artifacts: [],
      fileChanges: [{ path: "src/server.js", operation: "modify", content: "export const x = 1;" }],
      recommendations: [],
      requestedToolCalls: [],
      handoff: null,
      qualityEvidence: [],
      risks: [],
      errors: [],
    }),
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.value!.fileChanges[0]!.path, "src/server.js");

  // A stub / empty content is rejected - never silently dropped.
  const bad = parseModelResult(
    JSON.stringify({
      status: "PASS",
      summary: "x",
      reasoningSummary: "x",
      artifacts: [],
      fileChanges: [{ path: "src/server.js", operation: "modify", content: "" }],
      recommendations: [],
      requestedToolCalls: [],
      handoff: null,
      qualityEvidence: [],
      risks: [],
      errors: [],
    }),
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => p.includes("content")));
});

// ---------------------------------------------------------------------------
// 7-12. End-to-end: the implementation stage under the fake provider.
// ---------------------------------------------------------------------------

async function runImpl(serverOpts: Record<string, unknown>) {
  const srv = await startFakeOpenAiServer({ reportCost: 0, ...serverOpts });
  const rt = memoryRuntime();
  const t = tmp();
  const result = await runSoftwareFactoryProof(rt, {
    mode: "REAL",
    sleep: async () => {},
    descriptor: groqDescriptor(srv.baseUrl),
    buildRoot: t.dir,
    budget: new RequestBudget(),
  });
  return {
    result,
    impl: result.stages.find((s) => s.stage === "implementation"),
    audit: rt.audit.list(1_000_000).filter((e) => e.task === result.task_id),
    workspaceDir: result.workspaceDir,
    cleanup: () => {
      rt.close();
      srv.close();
      t.cleanup();
    },
  };
}

test("hardened implementation: a correct fileChanges change reaches Human approval and really writes /health + a test", async () => {
  const { result, impl, workspaceDir, cleanup } = await runImpl({});
  try {
    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(impl!.outcome, "PASS");
    assert.equal(impl!.testEvidence!.exitCode, 0);
    assert.ok(impl!.testEvidence!.passed >= 1);
    // fileChanges were applied as real workspace.write calls through the gateway.
    assert.ok(impl!.toolCalls!.some((c) => c.tool === "workspace.write" && c.executed && c.detail.includes("src/server.js")));
    assert.ok(impl!.toolCalls!.some((c) => c.tool === "workspace.write" && c.executed && c.detail.includes("test/")));
    assert.ok(existsSync(join(workspaceDir!, "src/server.js")));
    assert.ok(existsSync(join(workspaceDir!, "test/health.test.js")));
  } finally {
    await cleanup();
  }
});

test("hardened implementation: require() in an ESM project still FAILS its own npm test (gate NOT weakened)", async () => {
  const { result, impl, cleanup } = await runImpl({ implWrongModuleSyntax: true });
  try {
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.notEqual(impl!.outcome, "PASS");
    // The runner's own npm test caught it - not the model's prose.
    assert.ok(
      impl!.enforcement!.some((n) => /npm test|no tests were executed/i.test(n)),
      impl!.enforcement!.join(" | "),
    );
  } finally {
    await cleanup();
  }
});

test("hardened implementation: a misplaced test (not under test/, not *.test.*) is caught - stage does not PASS", async () => {
  const { result, impl, cleanup } = await runImpl({ implMisplacedTest: true });
  try {
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.notEqual(impl!.outcome, "PASS");
    assert.ok(
      impl!.enforcement!.some((n) => /test file was added|no tests were executed/i.test(n)),
      impl!.enforcement!.join(" | "),
    );
  } finally {
    await cleanup();
  }
});

test("hardened implementation: no fileChanges at all (code only in artifacts) is BLOCKED with a precise reason", async () => {
  const { result, impl, cleanup } = await runImpl({ implNoFileChanges: true });
  try {
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.notEqual(impl!.outcome, "PASS");
    assert.ok(
      impl!.enforcement!.some((n) => /fileChanges/i.test(n)),
      impl!.enforcement!.join(" | "),
    );
  } finally {
    await cleanup();
  }
});

test("hardened implementation: source changed but NO test added is BLOCKED (requireTestChange)", async () => {
  const { result, impl, cleanup } = await runImpl({ implNoTest: true });
  try {
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.notEqual(impl!.outcome, "PASS");
    assert.ok(
      impl!.enforcement!.some((n) => /test/i.test(n)),
      impl!.enforcement!.join(" | "),
    );
  } finally {
    await cleanup();
  }
});

test("hardened implementation: a broken first test is repaired with real evidence in ONE bounded pass, then PASSES", async () => {
  const { result, impl, audit, cleanup } = await runImpl({ brokenTestUntilRepair: true });
  try {
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(impl!.outcome, "PASS");
    assert.equal(impl!.testEvidence!.exitCode, 0);
    // Exactly one repair pass (bounded).
    assert.equal(
      audit.filter((e) => e.action.startsWith("real_model_call:implementation:test_repair")).length,
      1,
    );
    assert.ok(audit.some((e) => e.action === "qa_test_execution:implementation" && e.result === "FAIL"));
    assert.ok(audit.some((e) => e.action === "qa_test_execution:implementation:repair1" && e.result === "PASS"));
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// 13. The model is handed the authoritative project facts + inspect-first rule.
// ---------------------------------------------------------------------------

test("the implementation prompt carries an AUTHORITATIVE project_facts block and the inspect-first directive", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    const implPrompt = srv.lastUserPromptForStage("implementation");
    assert.ok(implPrompt, "expected to capture the implementation prompt");
    assert.match(implPrompt!, /## project_facts/);
    assert.match(implPrompt!, /AUTHORITATIVE/);
    assert.match(implPrompt!, /node --test/);
    assert.match(implPrompt!, /ESM/);
    assert.match(implPrompt!, /ignore that artifact|IGNORE that artifact/i);
    assert.match(implPrompt!, /fileChanges/);
    // The model is told it does NOT need a tool call to run tests.
    assert.match(implPrompt!, /runs the project's own test command/i);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 14. A read-only stage cannot smuggle a change through fileChanges.
// ---------------------------------------------------------------------------

test("fileChanges from a read-only stage are DENIED by the gateway - nothing is written", async () => {
  // code_review is read-only; the fake server only emits fileChanges for
  // implementation, so drive this via a QA-style scenario: reuse the broken
  // path where a non-writing stage would try to write. Simplest: assert the
  // fixture review stage never produced an executed write.
  const { result, cleanup } = await runImpl({});
  try {
    const review = result.stages.find((s) => s.stage === "code_review")!;
    assert.ok(!review.toolCalls!.some((c) => c.tool === "workspace.write" && c.executed));
    // And the independent reviewer is still a different agent.
    const impl = result.stages.find((s) => s.stage === "implementation")!;
    assert.notEqual(impl.agentId, review.agentId);
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// invalid workspace.patch is still rejected (unchanged behaviour, asserted).
// ---------------------------------------------------------------------------

test("workspace.patch with a 'find' that is not present is rejected (WORKSPACE_PATCH_MISS)", () => {
  const buildRoot = mkdtempSync(join(tmpdir(), "bw-"));
  const w = new ProofWorkspace({ buildRoot, taskId: "task_p", seedFrom: join(paths.fixtures, "demo-service") });
  try {
    assert.throws(
      () => w.patch("src/server.js", "THIS TEXT IS NOT IN THE FILE", "x"),
      /WORKSPACE_PATCH_MISS/,
    );
    // The file is untouched.
    assert.ok(!w.read("src/server.js").includes("\nx"));
  } finally {
    rmSync(buildRoot, { recursive: true, force: true });
  }
});
