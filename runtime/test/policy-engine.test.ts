import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistries } from "../src/registry/index.ts";
import { PolicyEngine } from "../src/policy/policy-engine.ts";

const reg = loadRegistries();
const engine = new PolicyEngine(reg);
const backend = reg.agents.get("backend-engineer");
const reviewer = reg.agents.get("senior-code-reviewer");

const base = {
  environment: "sandbox" as const,
  paused: false,
  risk: 2 as const,
};

test("default deny: a capability the agent was not granted is denied", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: "deploy.staging", action: "deploy" });
  assert.equal(d.effect, "DENY");
});

test("unknown capability is denied", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: "made.up", action: "x" });
  assert.equal(d.effect, "DENY");
  assert.match(d.reason, /unknown capability/);
});

test("non-grantable capability is denied even if somehow listed", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: "github.merge", action: "merge" });
  assert.equal(d.effect, "DENY");
  assert.equal(d.matched_rules.includes("agent-permissions:NON_GRANTABLE_NEVER"), true);
});

test("forbidden beats allowed", () => {
  // backend-engineer forbids deploy.production (non-grantable anyway) -> DENY
  const d = engine.evaluate({ ...base, agent: backend, capability: "db.migrate_production", action: "migrate" });
  assert.equal(d.effect, "DENY");
});

test("granted capability within ceiling is allowed", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: "github.create_pr", action: "open_pr" });
  assert.equal(d.effect, "ALLOW");
});

test("a critical action always requires Human Founder approval", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: null, action: "production_deployment" });
  assert.equal(d.effect, "APPROVAL_REQUIRED");
  assert.equal(d.approver, "human-founder");
});

test("preparation is always allowed", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: null, action: "prepare" });
  assert.equal(d.effect, "ALLOW");
});

test("RISK 5 work requires Human Founder approval", () => {
  const d = engine.evaluate({ ...base, agent: backend, capability: null, action: "implement", risk: 5 });
  assert.equal(d.effect, "APPROVAL_REQUIRED");
});

test("reviewer is denied write capabilities (structural independence)", () => {
  const d = engine.evaluate({ ...base, agent: reviewer, capability: "fs.write", action: "edit" });
  assert.equal(d.effect, "DENY");
});

test("a non-agent (system) caller cannot use a capability", () => {
  const d = engine.evaluate({ ...base, agent: null, capability: "github.create_pr", action: "open_pr" });
  assert.equal(d.effect, "DENY");
});
