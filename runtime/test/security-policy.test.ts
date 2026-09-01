import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryRuntime } from "./helpers.ts";
import { loadRegistries } from "../src/registry/index.ts";
import { validateAgainst } from "../src/config/schema-validator.ts";
import { assertWorkflowGraph } from "../src/registry/workflow-registry.ts";
import { CRITICAL_ACTIONS } from "../src/registry/policy-registry.ts";
import type { WorkflowDefinition } from "../src/core/types.ts";

// Build spec section 35 - the load-bearing safety tests for the RUNTIME.

const reg = loadRegistries();

test("no agent can self-approve or decide any approval", () => {
  const rt = memoryRuntime();
  try {
    const req = rt.approvals.request({
      task_id: "t", run_id: "r", workflow_id: "feature-development", step_id: "human_approval",
      requested_by: "release-manager", requested_action: "production_deployment", reason: "x",
      risk_level: 5, impact: "x", environment: "production", tests_summary: "x",
      security_summary: "x", rollback_summary: "x", estimated_cost_usd: 0,
    });
    for (const who of reg.agents.ids()) {
      assert.throws(() => rt.approvals.approve(req.id, who), /NOT_HUMAN_FOUNDER/);
    }
  } finally {
    rt.close();
  }
});

test("no agent can escalate its own or another agent's permissions", () => {
  const rt = memoryRuntime();
  try {
    for (const who of ["engineering-director", "backend-engineer", "application-security-engineer"]) {
      const d = rt.policy.evaluate({
        agent: reg.agents.get(who), capability: null, action: "access_control_escalation",
        risk: 3, environment: "sandbox", paused: false,
      });
      assert.equal(d.effect, "APPROVAL_REQUIRED");
      assert.equal(d.approver, "human-founder");
    }
  } finally {
    rt.close();
  }
});

test("a developer cannot merge protected main", () => {
  const backend = reg.agents.get("backend-engineer");
  assert.equal(backend.allowed_tools.includes("github.merge"), false);
  assert.equal(reg.tools.isGrantable("github.merge"), false);
});

test("a developer cannot access production secrets by default", () => {
  for (const who of reg.agents.all()) {
    assert.equal(who.allowed_tools.includes("secrets.production"), false);
    assert.equal(who.allowed_tools.includes("secrets.rotate"), false);
  }
});

test("the release manager cannot independently deploy production", () => {
  const rm = reg.agents.get("release-manager");
  for (const cap of ["deploy.production", "deploy.staging", "github.merge", "db.migrate_production", "fs.write"]) {
    assert.equal(rm.allowed_tools.includes(cap), false);
  }
});

test("the security agent cannot override a Human Founder rejection", () => {
  const rt = memoryRuntime();
  try {
    const req = rt.approvals.request({
      task_id: "t", run_id: "r", workflow_id: "security-finding", step_id: "escalate",
      requested_by: "application-security-engineer", requested_action: "critical_security_architecture_change",
      reason: "x", risk_level: 5, impact: "x", environment: "production", tests_summary: "x",
      security_summary: "x", rollback_summary: "x", estimated_cost_usd: 0,
    });
    rt.approvals.reject(req.id, "human-founder", "no");
    assert.throws(() => rt.approvals.approve(req.id, "application-security-engineer"), /NOT_HUMAN_FOUNDER/);
    assert.equal(rt.approvals.get(req.id)!.state, "REJECTED");
  } finally {
    rt.close();
  }
});

test("the global pause blocks writes but not reads", () => {
  const rt = memoryRuntime();
  try {
    rt.control.pause("safety test");
    const write = rt.gateway.authorize({
      agentId: "backend-engineer", capability: "fs.write", action: "edit",
      taskId: "t", risk: 2, reason: "write during pause",
    });
    assert.equal(write.allowed, false);
    const read = rt.gateway.authorize({
      agentId: "backend-engineer", capability: "github.read", action: "read",
      taskId: "t", risk: 0, reason: "read during pause",
    });
    assert.equal(read.allowed, true);
  } finally {
    rt.close();
  }
});

test("an unknown capability and an unknown tool are denied", () => {
  const rt = memoryRuntime();
  try {
    const d1 = rt.gateway.authorize({
      agentId: "backend-engineer", capability: "totally.madeup", action: "x", taskId: "t", risk: 1, reason: "x",
    });
    assert.equal(d1.allowed, false);
  } finally {
    rt.close();
  }
});

test("a malformed agent is rejected by schema validation", () => {
  assert.equal(validateAgainst("agent.schema.json", { id: "bad" }).valid, false);
});

test("an invalid workflow transition is rejected", () => {
  const wf: WorkflowDefinition = {
    id: "x", name: "x", purpose: "a workflow with a dangling transition to prove rejection",
    trigger: ["t"], risk_level: 1,
    steps: [
      { id: "a", name: "a", owner: "system", action: "a", on_pass: "ghost", on_fail: "abort" },
      { id: "b", name: "b", owner: "system", action: "b", on_pass: "end", on_fail: "abort" },
    ],
    produces: ["x"], invariants: ["x"],
  };
  assert.throws(() => assertWorkflowGraph(wf));
});

test("a missing approval blocks a critical (Human-Founder-owned) workflow step", async () => {
  const rt = memoryRuntime();
  try {
    // architecture-change: proposal -> impact_review -> security_review -> human_decision
    const task = rt.orchestrator.tasks.create({
      title: "re-architect the service layer",
      description: "an architecture change to restructure the module boundaries",
    });
    const { run } = rt.orchestrator.plan(task);
    assert.equal(run.workflow_id, "architecture-change");
    const d = await rt.orchestrator.drive(run.id);
    assert.equal(d.run.status, "APPROVAL_REQUIRED");
    // The production step is never reached without an approval.
    assert.equal(d.run.history.some((h) => h.step_id === "production"), false);
  } finally {
    rt.close();
  }
});

test("every critical action is covered by a Human Founder approval rule", () => {
  for (const a of CRITICAL_ACTIONS) {
    assert.equal(reg.policies.approvalActions.get(a), "human-founder");
  }
});
