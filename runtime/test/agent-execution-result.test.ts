import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelResult, extractJsonObject } from "../src/agents/agent-execution-result.ts";

const VALID = {
  status: "PASS",
  summary: "Wrote the business analysis with acceptance criteria.",
  reasoningSummary: "Derived stories from the task; added negative cases; handed to architect.",
  artifacts: [{ path: "business_analysis.md", kind: "report", content: "# BA\n..." }],
  recommendations: ["Proceed to architecture"],
  requestedToolCalls: [],
  handoff: { to: "solution-architect", why: "spec ready" },
  qualityEvidence: [{ check: "acceptance-criteria-present", result: "PASS", detail: "3 criteria" }],
  risks: [],
  errors: [],
};

test("parses a clean JSON object", () => {
  const r = parseModelResult(JSON.stringify(VALID));
  assert.equal(r.ok, true);
  assert.equal(r.value!.status, "PASS");
  assert.equal(r.value!.artifacts.length, 1);
});

test("parses JSON wrapped in a ```json fence with surrounding prose", () => {
  const text = `Sure, here is my result:\n\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\`\n\nLet me know!`;
  const r = parseModelResult(text);
  assert.equal(r.ok, true);
  assert.equal(r.value!.handoff!.to, "solution-architect");
});

test("parses a leading-prose + trailing-prose object without a fence", () => {
  const text = `My analysis: ${JSON.stringify(VALID)} -- done.`;
  const r = parseModelResult(text);
  assert.equal(r.ok, true);
});

test("rejects a response with no JSON object", () => {
  const r = parseModelResult("Here is a prose-only answer with no structure.");
  assert.equal(r.ok, false);
  assert.ok(r.problems.length > 0);
});

test("rejects an object missing required fields", () => {
  const r = parseModelResult(JSON.stringify({ status: "MAYBE", summary: "x" }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("status")));
  assert.ok(r.problems.some((p) => p.includes("reasoningSummary")));
});

test("rejects an invalid artifact kind", () => {
  const bad = { ...VALID, artifacts: [{ path: "x.md", kind: "essay", content: "" }] };
  const r = parseModelResult(JSON.stringify(bad));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("kind")));
});

test("validates requestedToolCalls shape", () => {
  const withCalls = {
    ...VALID,
    requestedToolCalls: [
      { tool: "workspace.write", args: { path: "src/server.js", content: "..." }, reason: "add endpoint" },
      { tool: "", args: {}, reason: "bad" },
    ],
  };
  const r = parseModelResult(JSON.stringify(withCalls));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("requestedToolCalls[1].tool")));
});

test("extractJsonObject handles nested braces and strings with braces", () => {
  const obj = '{"a": {"b": 1}, "s": "text with } brace"}';
  const { json } = extractJsonObject(`prefix ${obj} suffix`);
  assert.equal(json, obj);
});
