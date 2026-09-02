import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistries } from "../src/registry/index.ts";
import { assembleAgentPrompt } from "../src/agents/prompt-assembler.ts";
import type { Task } from "../src/core/types.ts";

const reg = loadRegistries();
const wf = reg.workflows.get("feature-development");
const task: Task = {
  id: "task_test",
  title: "Add a GET /health endpoint",
  description: "Return 200 and { status: 'ok' } with tests.",
  project: "runtime-proof-v1.1",
  requested_by: "human-founder",
  priority: "normal",
  risk: 4,
  status: "CLASSIFIED",
  workflow_id: "feature-development",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

function stage(id: string) {
  return wf.steps.find((s) => s.id === id)!;
}

test("assembles constitution constraints, role, skills, outputs, contract - not a repo dump", () => {
  const agent = reg.agents.get("backend-engineer");
  const p = assembleAgentPrompt({
    reg,
    agent,
    workflow: wf,
    step: stage("implementation"),
    task,
    priorArtifacts: [],
    allowedRuntimeTools: ["workspace.write", "workspace.exec"],
  });
  assert.match(p.system, /Human Founder is the supreme authority/);
  assert.match(p.system, /AI Backend Engineer/);
  assert.match(p.prompt, /## your_role/);
  assert.match(p.prompt, /## your_quality_gates/);
  assert.match(p.prompt, /## tools_you_may_request/);
  assert.match(p.prompt, /workspace\.write/);
  assert.match(p.prompt, /required_output_contract/);
  assert.match(p.prompt, /"requestedToolCalls"/);
  // Bounded: nothing like a whole repository is present.
  assert.ok(p.contextBytes < 30_000, `context too large: ${p.contextBytes}`);
});

test("context budgeting truncates low-priority sections to fit the byte budget", () => {
  const agent = reg.agents.get("solution-architect");
  const big = "x".repeat(50_000);
  const p = assembleAgentPrompt({
    reg,
    agent,
    workflow: wf,
    step: stage("architecture"),
    task,
    priorArtifacts: [
      { stage: "business_analysis", agentId: "business-analyst", path: "business_analysis.md", excerpt: big },
    ],
    allowedRuntimeTools: [],
    contextBudgetBytes: 8_000,
  });
  assert.ok(p.contextBytes <= 14_000, `budget not respected: ${p.contextBytes}`);
  assert.ok(p.truncated.length > 0);
});

test("prior-stage artifacts are included when small", () => {
  const agent = reg.agents.get("senior-code-reviewer");
  const p = assembleAgentPrompt({
    reg,
    agent,
    workflow: wf,
    step: stage("code_review"),
    task,
    priorArtifacts: [
      { stage: "implementation", agentId: "backend-engineer", path: "impl.md", excerpt: "added GET /health" },
    ],
    allowedRuntimeTools: ["workspace.read"],
    workspaceDiff: "diff --git a/src/server.js b/src/server.js\n+  /health",
  });
  assert.match(p.prompt, /prior_stage_artifacts/);
  assert.match(p.prompt, /added GET \/health/);
  assert.match(p.prompt, /proof_workspace_diff/);
});
