import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryRuntime } from "./helpers.ts";
import { RealAgentRunner } from "../src/agents/real-agent-runner.ts";
import { ProofWorkspace } from "../src/proof/proof-workspace.ts";
import { RequestBudget } from "../src/proof/request-budget.ts";
import { paths } from "../src/config/paths.ts";
import type { GenerateRequest, GenerateResult, ModelProvider } from "../src/models/provider.ts";
import { MODEL_TIERS } from "../src/core/types.ts";

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
    };
  }
  usage() {
    return { input_tokens: 100, output_tokens: 50 };
  }
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
