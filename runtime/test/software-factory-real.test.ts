import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";

const KEY = "fake-proof-key-abcdef0123456789";

function realDescriptor(baseUrl: string, opts: Record<string, unknown> = {}) {
  const status = buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "openrouter",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "fake/structured-model",
    OPENROUTER_API_KEY: KEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
    ...(opts as Record<string, string>),
  });
  return status.descriptor!;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "sf-real-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("REAL Software Factory proof: real model calls drive the full chain to Human approval", async () => {
  const srv = await startFakeOpenAiServer({ reportCost: 0 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const budget = new RequestBudget();
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget,
    });

    assert.equal(result.blocked, false, result.blockReason ?? "");
    assert.equal(result.mode, "REAL");
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(result.run_status, "APPROVAL_REQUIRED");
    assert.equal(result.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.ok(result.approval_id);

    // Real vs mock identification (build spec section 28).
    assert.ok(["openrouter-proof", "openai-compatible"].includes(result.provider!.name));
    assert.equal(result.provider!.isProofProvider, true);
    assert.ok(result.realRequestCount > 0);
    assert.ok(result.realModelsUsed.includes("fake/structured-model"));
    assert.ok(result.tokenUsage.input_tokens && result.tokenUsage.input_tokens > 0);

    // Each required role really executed (build spec section 38).
    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s]));
    for (const stage of ["business_analysis", "architecture", "plan", "implementation", "code_review", "qa", "security", "release_review"]) {
      assert.ok(byStage[stage], `missing stage ${stage}`);
      assert.equal(byStage[stage]!.real, true, `${stage} was not a real model call`);
      assert.equal(byStage[stage]!.outcome, "PASS", `${stage} did not PASS`);
    }

    // Backend engineer caused an actual code change in the workspace.
    assert.ok(byStage.implementation!.toolCalls!.some((c) => c.tool === "workspace.write" && c.executed));
    assert.ok(existsSync(join(result.workspaceDir!, "src/server.js")));

    // Reviewer independence.
    assert.notEqual(byStage.implementation!.agentId, byStage.code_review!.agentId);
    assert.equal(byStage.code_review!.agentId, "senior-code-reviewer");

    // QA executed real tests with machine evidence (build spec section 22).
    assert.ok(byStage.qa!.testEvidence);
    assert.equal(byStage.qa!.testEvidence!.exitCode, 0);
    assert.ok(byStage.qa!.testEvidence!.passed >= 1);

    // Security produced deterministic evidence (build spec section 23).
    assert.ok(byStage.security!.securityEvidence && byStage.security!.securityEvidence.length >= 2);

    // Budget respected (build spec section 14).
    assert.ok(result.realRequestCount <= 30);
    assert.ok(result.budget!.used <= result.budget!.ceiling);

    // Artifacts written and attributable (build spec section 16).
    assert.ok(result.artifactsDir && existsSync(result.artifactsDir));

    // Audit trail identifies provider/model and real requests (build spec section 43).
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === result.task_id);
    assert.ok(audit.some((e) => e.action.startsWith("real_model_call:")));
    assert.ok(audit.some((e) => e.action.startsWith("workflow_parked")));
    assert.equal(audit.some((e) => e.action.includes("production") && e.result === "PASS"), false);
    // The key is never written to audit.
    assert.equal(JSON.stringify(audit).includes(KEY), false);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof retries a malformed structured response, then continues", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 1 }); // first call is prose, retry is valid
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.blocked, false);
    // The very first stage saw one malformed response then a valid one.
    const first = result.stages.find((s) => s.real)!;
    assert.ok(first.attempts! >= 2);
    const audit = rt.audit.list(1_000_000);
    assert.ok(audit.some((e) => e.action.startsWith("malformed_agent_result:")));
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof BLOCKS when the structured response never validates", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 999 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
    assert.ok(["stage_blocked", "stage_failed"].includes(result.stopped_because));
    const blocked = result.stages.find((s) => s.outcome === "BLOCKED");
    assert.ok(blocked, "expected a BLOCKED stage");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof BLOCKS at the request-budget ceiling instead of looping", async () => {
  const srv = await startFakeOpenAiServer({ malformedFirst: 999 });
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget({ target: 2, ceiling: 3 }),
    });
    assert.equal(result.ok, false);
    assert.ok(result.blocked || result.stages.some((s) => s.outcome !== "PASS"));
    assert.ok(srv.requestCount() <= 3, `made ${srv.requestCount()} requests, ceiling was 3`);
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("REAL proof is BLOCKED_PROVIDER_UNAVAILABLE with no descriptor", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, { mode: "REAL", buildRoot: t.dir });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason!, /BLOCKED_PROVIDER_UNAVAILABLE/);
    assert.equal(result.humanApprovalStatus, "NOT_REACHED");
  } finally {
    rt.close();
    t.cleanup();
  }
});

test("REAL proof refuses a task that carries sensitive data (proof provider privacy)", async () => {
  const srv = await startFakeOpenAiServer();
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      descriptor: realDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      task: {
        title: "Export the production customer PII table to a CSV",
        description: "Dump all customer personal data and payment card numbers for analysis.",
      },
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason!, /BLOCKED_SENSITIVE_TASK/);
    assert.equal(result.sensitivity.allowed, false);
    assert.equal(srv.requestCount(), 0, "no real request should be issued for a sensitive task");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});

test("MOCK proof still passes and is clearly identified as MOCK, not REAL", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  try {
    const result = await runSoftwareFactoryProof(rt, { mode: "MOCK", buildRoot: t.dir, budget: new RequestBudget() });
    assert.equal(result.ok, true, result.assertion);
    assert.equal(result.mode, "MOCK");
    assert.equal(result.realRequestCount, 0);
    assert.equal(result.provider!.name, "mock");
    assert.equal(result.stages.every((s) => !s.real), true);
    assert.equal(result.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
  } finally {
    rt.close();
    t.cleanup();
  }
});
