import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { startFakeOpenAiServer } from "./fake-openai-server.ts";
import { buildRealProvider } from "../src/models/real-provider.ts";
import { runSoftwareFactoryProof } from "../src/proof/software-factory.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";

const KEY = "fake-proof-key-abcdef0123456789";

function groqDescriptor(baseUrl: string) {
  return buildRealProvider({
    AI_COMPANY_REAL_PROVIDER: "groq",
    AI_COMPANY_REAL_BASE_URL: baseUrl,
    AI_COMPANY_REAL_MODEL: "openai/gpt-oss-120b",
    GROQ_API_KEY: KEY,
    AI_COMPANY_REAL_MAX_RETRIES: "1",
  }).descriptor!;
}

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), "sf-resume-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("REAL proof interrupted at qa RESUMES from the persisted checkpoint to Human approval - no completed stage or implementation re-run", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  // Run 1: the provider dies after the 6th real call (business_analysis, spec_review,
  // architecture, plan, implementation, code_review) so `qa` fails and the run is
  // left persisted as RUNNING at `qa` - exactly the interrupted-Codespace shape.
  const srv1 = await startFakeOpenAiServer({ reportCost: 0, serverErrorAfter: 6 });
  let runId: string;
  try {
    const first = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv1.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: { minIntervalMs: 0, jitterMs: 0, maxRetryCycles: 1 },
    });
    assert.equal(first.ok, false);
    assert.equal(first.humanApprovalStatus, "NOT_REACHED");
    assert.equal(first.providerError?.stage, "qa");
    runId = first.run_id!;
    assert.ok(runId);

    const runAfter1 = rt.workflows.getRun(runId);
    assert.equal(runAfter1.status, "RUNNING");
    assert.equal(runAfter1.current_step, "qa");
    const passed1 = runAfter1.history.filter((h) => h.result === "PASS").map((h) => h.step_id);
    assert.ok(passed1.includes("implementation"));
    assert.ok(passed1.includes("code_review"));
  } finally {
    await srv1.close();
  }

  // Run 2: a healthy provider. Resume the SAME persisted run from `qa`.
  const srv2 = await startFakeOpenAiServer({ reportCost: 0 });
  try {
    const resumed = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      resume: { runId: runId! },
      descriptor: groqDescriptor(srv2.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget({ used: 6 }),
      rateLimit: { minIntervalMs: 0, jitterMs: 0, maxRetryCycles: 1 },
    });

    // Reached the approval gate on the very same run.
    assert.equal(resumed.blocked, false, resumed.blockReason ?? "");
    assert.equal(resumed.ok, true, resumed.assertion);
    assert.equal(resumed.run_id, runId);
    assert.equal(resumed.humanApprovalStatus, "HUMAN_APPROVAL_REQUIRED");
    assert.equal(resumed.run_status, "APPROVAL_REQUIRED");
    assert.equal(resumed.project_state, "HUMAN_APPROVAL_REQUIRED");
    assert.ok(resumed.approval_id);

    // Only the remaining real stages were executed on the resume provider.
    assert.equal(srv2.requestCount(), 3, `expected 3 remaining real calls, saw ${srv2.requestCount()}`);

    // The report still shows the whole chain, and the completed stages are the
    // originals (not re-run): each stage appears exactly once.
    const byStage = Object.fromEntries(resumed.stages.map((s) => [s.stage, s]));
    for (const stage of ["business_analysis", "implementation", "code_review", "qa", "security", "release_review"]) {
      assert.ok(byStage[stage], `missing stage ${stage}`);
      assert.equal(byStage[stage]!.outcome, "PASS", `${stage} not PASS`);
    }
    const counts = resumed.stages.reduce<Record<string, number>>((m, s) => ((m[s.stage] = (m[s.stage] ?? 0) + 1), m), {});
    for (const [stage, c] of Object.entries(counts)) assert.equal(c, 1, `stage ${stage} appears ${c} times`);

    // Independent review preserved from the original run.
    assert.equal(byStage.implementation!.agentId, "backend-engineer");
    assert.equal(byStage.code_review!.agentId, "senior-code-reviewer");

    // QA re-ran the real test suite against the ALREADY-applied implementation.
    assert.ok(byStage.qa!.testEvidence);
    assert.equal(byStage.qa!.testEvidence!.exitCode, 0);
    assert.ok(byStage.qa!.testEvidence!.passed >= 1);
    assert.ok(byStage.security!.securityEvidence && byStage.security!.securityEvidence.length >= 2);

    // The implementation stage was NOT re-executed: exactly one real business_analysis
    // and one implementation model call exist across BOTH runs.
    const audit = rt.audit.list(1_000_000).filter((e) => e.task === resumed.task_id);
    assert.equal(audit.filter((e) => e.action === "real_model_call:business_analysis").length, 1);
    assert.equal(audit.filter((e) => e.action === "real_model_call:implementation").length, 1);
    assert.ok(audit.some((e) => e.action === "workflow_parked:feature-development.human_approval"));

    // Shared request budget kept counting across the interruption.
    assert.ok(resumed.budget!.used >= 9 && resumed.budget!.used <= resumed.budget!.ceiling);

    // No credential anywhere.
    assert.ok(!JSON.stringify(resumed).includes(KEY));
    assert.ok(!JSON.stringify(audit).includes(KEY));
  } finally {
    rt.close();
    await srv2.close();
    t.cleanup();
  }
});

test("proof resume refuses a run that has not passed implementation + code_review", async () => {
  const rt = memoryRuntime();
  const t = tmp();
  const srv = await startFakeOpenAiServer({ reportCost: 0, serverErrorAfter: 2 }); // dies at architecture
  try {
    const first = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
      rateLimit: { minIntervalMs: 0, jitterMs: 0, maxRetryCycles: 1 },
    });
    assert.equal(first.ok, false);

    const resumed = await runSoftwareFactoryProof(rt, {
      mode: "REAL",
      sleep: async () => {},
      resume: { runId: first.run_id! },
      descriptor: groqDescriptor(srv.baseUrl),
      buildRoot: t.dir,
      budget: new RequestBudget(),
    });
    assert.equal(resumed.blocked, true);
    assert.match(resumed.blockReason ?? resumed.assertion, /BLOCKED_RESUME/);
    assert.equal(resumed.humanApprovalStatus, "NOT_REACHED");
  } finally {
    rt.close();
    await srv.close();
    t.cleanup();
  }
});
