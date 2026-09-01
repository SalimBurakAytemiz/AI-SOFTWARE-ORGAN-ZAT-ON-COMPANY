import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistries } from "../src/registry/index.ts";
import { validateAgainst } from "../src/config/schema-validator.ts";
import { assertWorkflowGraph } from "../src/registry/workflow-registry.ts";
import { RegistryIntegrityError } from "../src/core/errors.ts";
import type { WorkflowDefinition } from "../src/core/types.ts";

test("registries load and cross-validate the Organization V1.0 configuration", () => {
  const reg = loadRegistries();
  assert.equal(reg.agents.ids().length, 18);
  assert.equal(reg.skills.ids().length, 22);
  assert.equal(reg.workflows.ids().length, 9);
  assert.equal(reg.policies.ids().length, 14);
  assert.ok(reg.tools.capabilities.size >= 40);
  assert.ok(reg.tools.nonGrantableIds().includes("github.merge"));
  assert.ok(reg.tools.nonGrantableIds().includes("deploy.production"));
});

test("human-founder is never loaded as an agent", () => {
  const reg = loadRegistries();
  assert.equal(reg.agents.byId.has("human-founder"), false);
});

test("a malformed agent definition fails schema validation", () => {
  const bad = { id: "x", title: "too short and missing everything" };
  const result = validateAgainst("agent.schema.json", bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("a workflow with an unresolved transition is rejected", () => {
  const wf: WorkflowDefinition = {
    id: "broken",
    name: "Broken",
    purpose: "a workflow that transitions to a step that does not exist at all",
    trigger: ["test"],
    risk_level: 1,
    steps: [
      { id: "a", name: "A", owner: "system", action: "do a", on_pass: "nowhere", on_fail: "abort" },
      { id: "b", name: "B", owner: "system", action: "do b", on_pass: "end", on_fail: "abort" },
    ],
    produces: ["nothing"],
    invariants: ["none"],
  };
  assert.throws(() => assertWorkflowGraph(wf), RegistryIntegrityError);
});

test("a production workflow with no human_approval step is rejected", () => {
  const wf: WorkflowDefinition = {
    id: "bypass",
    name: "Bypass",
    purpose: "a workflow that reaches production without a Human Founder approval step",
    trigger: ["test"],
    risk_level: 5,
    reaches_production: true,
    steps: [
      { id: "build", name: "Build", owner: "backend-engineer", action: "build", on_pass: "ship", on_fail: "abort" },
      {
        id: "ship",
        name: "Ship",
        owner: "human-founder",
        action: "deploy",
        project_state: "PRODUCTION",
        on_pass: "end",
        on_fail: "abort",
      },
    ],
    produces: ["a deploy"],
    invariants: ["none"],
  };
  assert.throws(() => assertWorkflowGraph(wf), /human_approval/);
});
