import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistries } from "../src/registry/index.ts";
import { ModelRouter } from "../src/models/router.ts";
import { MockModelProvider } from "../src/models/mock-provider.ts";

const reg = loadRegistries();
const router = new ModelRouter(reg.models, [new MockModelProvider()]);
const backend = reg.agents.get("backend-engineer");
const pm = reg.agents.get("product-manager");
const reviewer = reg.agents.get("senior-code-reviewer");

test("risk 0 deterministic work routes to NO_AI", () => {
  const d = router.route({ agent: pm, taskType: "config_validation", risk: 0 });
  assert.equal(d.tier, "NO_AI");
});

test("risk sets a hard floor that task type cannot lower", () => {
  const d = router.route({ agent: backend, taskType: "summary_or_release_notes", risk: 4 });
  assert.equal(d.tier, "ADVANCED_REASONING"); // floor for risk 4
});

test("code review routes to the critical review tier", () => {
  const d = router.route({ agent: reviewer, taskType: "code_review", risk: 4 });
  assert.equal(d.tier, "CRITICAL_REVIEW");
});

test("a task is never routed above the agent's own ceiling for non-floor reasons", () => {
  // product-manager ceiling is risk 2 -> STANDARD_CODING; a 'high complexity'
  // raiser must not push it past that when the floor does not require more.
  const d = router.route({ agent: pm, taskType: "requirements_analysis", risk: 2, complexity: "high" });
  assert.equal(["STANDARD_CODING"].includes(d.tier), true);
});

test("run() uses the mock provider and returns a deterministic result", async () => {
  const { decision, result } = await router.run(
    { agent: backend, taskType: "feature_implementation", risk: 3 },
    "implement the endpoint",
    { seed: 1 },
  );
  assert.equal(result.provider, "mock");
  assert.equal(result.estimated_cost_usd, 0);
  assert.ok(decision.tier !== "NO_AI");
  const again = await router.run(
    { agent: backend, taskType: "feature_implementation", risk: 3 },
    "implement the endpoint",
    { seed: 1 },
  );
  assert.equal(again.result.text, result.text);
});
