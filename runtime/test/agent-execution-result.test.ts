import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseModelResult,
  extractJsonObject,
  MODEL_AUTHORED_RESULT_JSON_SCHEMA,
  schemaObjectNodes,
} from "../src/agents/agent-execution-result.ts";

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

// Regression (Runtime V1.1, 2026-09-01): a VALID top-level result whose artifact
// bodies contain ``` fenced code blocks must not be sliced apart by the
// fence-stripping heuristic. This was the confirmed real blocker at
// business_analysis once the Groq strict schema started returning clean JSON.
test("extractJsonObject keeps a valid object whose string values contain ``` fenced code", () => {
  const obj = {
    ...VALID,
    artifacts: [
      {
        path: "business_analysis.md",
        kind: "report",
        content: "# BA\n\nExample handler:\n```js\napp.get('/health', (req, res) => { res.json({ status: 'ok' }); });\n```\n\nDone.",
      },
    ],
  };
  const text = JSON.stringify(obj, null, 2);
  const { json } = extractJsonObject(text);
  assert.ok(json, "expected the whole object to be extracted");
  assert.deepEqual(JSON.parse(json!), obj);
  const parsed = parseModelResult(text);
  assert.equal(parsed.ok, true, parsed.problems.join("; "));
  assert.equal(parsed.value!.artifacts[0]!.content.includes("```js"), true);
});

test("parseModelResult accepts the strict-path shape: one clean object, no prose, fenced artifact bodies", () => {
  const body = {
    status: "PASS",
    summary: "Requirements captured for GET /health.",
    reasoningSummary: "Derived acceptance criteria; no tools needed at this stage.",
    artifacts: [
      { path: "ba.md", kind: "report", content: "```json\n{\"status\":\"ok\"}\n```\nplus prose { with a brace" },
      { path: "notes.md", kind: "doc", content: "second artifact { another brace }" },
    ],
    recommendations: ["proceed"],
    requestedToolCalls: [],
    handoff: { to: "solution-architect", why: "spec ready" },
    qualityEvidence: [{ check: "criteria", result: "PASS", detail: "3 criteria" }],
    risks: [],
    errors: [],
  };
  const parsed = parseModelResult(JSON.stringify(body));
  assert.equal(parsed.ok, true, parsed.problems.join("; "));
  assert.equal(parsed.value!.artifacts.length, 2);
  assert.equal(parsed.value!.handoff!.to, "solution-architect");
});

// ---------------------------------------------------------------------------
// Regression (Runtime V1.1, 2026-09-01): the AgentExecutionResult JSON Schema
// must be a Groq strict-Structured-Output-compatible subset. The confirmed
// blocking cause was an unconstrained tool-args object and a `["object","null"]`
// union on `handoff`.
// ---------------------------------------------------------------------------

test("MODEL_AUTHORED_RESULT_JSON_SCHEMA is Groq strict-compatible: every object is closed and fully required", () => {
  for (const { path, node } of schemaObjectNodes()) {
    assert.equal(node.type, "object", `${path}: object node must have a single string type "object"`);
    assert.equal(node.additionalProperties, false, `${path}: additionalProperties must be false`);
    const props = Object.keys((node.properties as Record<string, unknown>) ?? {});
    const required = (node.required as string[]) ?? [];
    assert.deepEqual(
      [...required].sort(),
      [...props].sort(),
      `${path}: 'required' must list every property for strict mode`,
    );
  }
});

test("MODEL_AUTHORED_RESULT_JSON_SCHEMA has no unconstrained object and no type-union anywhere", () => {
  const serialised = JSON.stringify(MODEL_AUTHORED_RESULT_JSON_SCHEMA);
  assert.equal(/"additionalProperties":\s*true/.test(serialised), false, "no additionalProperties:true");
  // No `"type": [ ... ]` array unions - strict mode wants a single string type.
  assert.equal(/"type":\s*\[/.test(serialised), false, "no type-array unions (use anyOf)");
});

test("nullable handoff is expressed as anyOf: [ <bounded object>, { type: 'null' } ]", () => {
  const handoff = (MODEL_AUTHORED_RESULT_JSON_SCHEMA.properties as Record<string, unknown>).handoff as Record<
    string,
    unknown
  >;
  assert.ok(Array.isArray(handoff.anyOf), "handoff must use anyOf");
  const branches = handoff.anyOf as Record<string, unknown>[];
  assert.equal(branches.length, 2);
  const obj = branches.find((b) => b.type === "object")!;
  const nul = branches.find((b) => b.type === "null")!;
  assert.ok(obj && nul, "one bounded object branch and one null branch");
  assert.equal(obj.additionalProperties, false);
  assert.deepEqual((obj.required as string[]).sort(), ["to", "why"]);
});

test("tool-call arguments are a bounded string (args_json), not an open object", () => {
  const items = (
    (MODEL_AUTHORED_RESULT_JSON_SCHEMA.properties as Record<string, unknown>).requestedToolCalls as Record<
      string,
      unknown
    >
  ).items as Record<string, unknown>;
  const props = items.properties as Record<string, Record<string, unknown>>;
  assert.equal(props.args, undefined, "the open 'args' object is gone");
  assert.equal(props.args_json!.type, "string");
  assert.deepEqual((items.required as string[]).sort(), ["args_json", "reason", "tool"]);
});

test("parseModelResult parses args_json into a real object after validation", () => {
  const body = {
    ...VALID,
    requestedToolCalls: [
      {
        tool: "workspace.write",
        args_json: JSON.stringify({ path: "src/server.js", content: "// code" }),
        reason: "add endpoint",
      },
      { tool: "workspace.list", args_json: "{}", reason: "inspect" },
    ],
  };
  const r = parseModelResult(JSON.stringify(body));
  assert.equal(r.ok, true, r.problems.join("; "));
  assert.deepEqual(r.value!.requestedToolCalls[0]!.args, { path: "src/server.js", content: "// code" });
  assert.deepEqual(r.value!.requestedToolCalls[1]!.args, {});
});

test("parseModelResult rejects a malformed args_json string - never silently dropped", () => {
  const body = {
    ...VALID,
    requestedToolCalls: [{ tool: "workspace.write", args_json: "{not valid json", reason: "x" }],
  };
  const r = parseModelResult(JSON.stringify(body));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("args_json")));
});

test("parseModelResult rejects args_json that is not a JSON object (array / scalar)", () => {
  for (const bad of ['["a","b"]', '"just a string"', "42"]) {
    const body = { ...VALID, requestedToolCalls: [{ tool: "workspace.exec", args_json: bad, reason: "x" }] };
    const r = parseModelResult(JSON.stringify(body));
    assert.equal(r.ok, false, `expected rejection for args_json=${bad}`);
  }
});

test("parseModelResult still accepts an inline args object (json_object fallback / back-compat)", () => {
  const body = {
    ...VALID,
    requestedToolCalls: [{ tool: "workspace.write", args: { path: "a.js", content: "x" }, reason: "y" }],
  };
  const r = parseModelResult(JSON.stringify(body));
  assert.equal(r.ok, true, r.problems.join("; "));
  assert.deepEqual(r.value!.requestedToolCalls[0]!.args, { path: "a.js", content: "x" });
});
