import type { RiskLevel } from "../core/types.ts";

/**
 * The structured contract every model-backed agent must return (build spec
 * sections 9, 10, 11, 29). Uncontrolled prose between agents is not allowed. The
 * model response is parsed and validated against this shape; a malformed result
 * is retried within policy limits and then BLOCKS the workflow - it is never
 * silently guessed.
 *
 * Note on reasoning (build spec section 10): `reasoningSummary` is a short,
 * engineer-auditable decision rationale only. Hidden/private chain-of-thought is
 * neither requested nor stored.
 */

export interface RequestedToolCall {
  /** A runtime tool name, e.g. workspace.write, workspace.exec, workspace.patch. */
  tool: string;
  /**
   * Arguments for the tool (path, content, command, ...). On the wire the model
   * authors these as `args_json` - a JSON object literal serialised to a string -
   * because provider-native strict Structured Outputs (Groq) reject an
   * unconstrained `{ "type": "object", "additionalProperties": true }`. The string
   * is parsed into this object ONLY after the response has passed JSON-Schema
   * validation, and the result still flows through the Capability Gateway and the
   * workspace tool executor unchanged - nothing about adjudication is relaxed.
   */
  args: Record<string, unknown>;
  /** Why the agent wants this call - recorded, then adjudicated by the gateway. */
  reason: string;
}

/**
 * A concrete, applied code change (build spec sections 9, 22). This is the
 * FIRST-CLASS way a model expresses "change this file" - it is NOT a documentation
 * artifact and it does NOT require the double-escaped `args_json` string form that
 * a free model routinely gets wrong. Each entry is a COMPLETE file (never a
 * fragment or a prose stub). The runner applies each one as a `workspace.write`
 * through the Capability Gateway - same adjudication, same audit, same path jail.
 */
export interface FileChange {
  /** Workspace-relative path, e.g. "src/server.js" or "test/health.test.js". */
  path: string;
  /** "create" a new file or "modify" an existing one (advisory; the runner writes either way). */
  operation: "create" | "modify";
  /** The COMPLETE new file text. Must be valid in the project's module system. */
  content: string;
}

export interface AgentArtifact {
  /** Relative path under build/proof/<task-id>/ OR the proof workspace. */
  path: string;
  /** One of: report | doc | code | test | plan | evidence. */
  kind: "report" | "doc" | "code" | "test" | "plan" | "evidence";
  /** The artifact body (markdown, code, ...). */
  content: string;
}

export interface QualityEvidenceItem {
  check: string;
  result: "PASS" | "FAIL" | "NOT_RUN";
  detail: string;
}

export interface AgentExecutionResult {
  executionId: string;
  agentId: string;
  role: string;
  taskId: string;
  workflowId: string;
  stage: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  summary: string;
  reasoningSummary: string;
  artifacts: AgentArtifact[];
  fileChanges: FileChange[];
  recommendations: string[];
  requestedToolCalls: RequestedToolCall[];
  handoff: { to: string; why: string } | null;
  qualityEvidence: QualityEvidenceItem[];
  risks: string[];
  errors: string[];
  usage: {
    provider: string;
    model: string;
    real: boolean;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost_usd: number | null;
    duration_ms: number;
    request_number: number;
  };
}

/** The subset the model is asked to produce; the runtime fills the rest. */
export interface ModelAuthoredResult {
  status: "PASS" | "FAIL" | "BLOCKED";
  summary: string;
  reasoningSummary: string;
  artifacts: AgentArtifact[];
  fileChanges: FileChange[];
  recommendations: string[];
  requestedToolCalls: RequestedToolCall[];
  handoff: { to: string; why: string } | null;
  qualityEvidence: QualityEvidenceItem[];
  risks: string[];
  errors: string[];
}

export interface ParseOutcome {
  ok: boolean;
  value: ModelAuthoredResult | null;
  problems: string[];
}

/**
 * JSON Schema for `ModelAuthoredResult`, used for provider-native Structured
 * Outputs (`response_format: { type: "json_schema", strict: true }`) on models
 * that support it (Groq gpt-oss). This is DEFENCE IN DEPTH: `parseModelResult`
 * still validates every response, whether or not the API enforced the schema -
 * the schema is never a substitute for validation.
 *
 * Groq strict-Structured-Output compatibility (confirmed root cause,
 * 2026-09-01): every object MUST set `additionalProperties: false` and list
 * every one of its properties in `required`; `type` MUST be a single string, so
 * a nullable object is expressed as `anyOf: [ <object schema>, { type: "null" } ]`
 * rather than `type: ["object", "null"]`; and an unconstrained
 * `{ type: "object", additionalProperties: true }` is rejected outright. Tool
 * arguments - which are genuinely open-ended - are therefore carried as
 * `args_json`, a bounded `string` holding a serialised JSON object that
 * `parseModelResult` parses only AFTER schema validation succeeds.
 */
export const MODEL_AUTHORED_RESULT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "summary",
    "reasoningSummary",
    "artifacts",
    "fileChanges",
    "recommendations",
    "requestedToolCalls",
    "handoff",
    "qualityEvidence",
    "risks",
    "errors",
  ],
  properties: {
    status: { type: "string", enum: ["PASS", "FAIL", "BLOCKED"] },
    summary: { type: "string" },
    reasoningSummary: { type: "string" },
    artifacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "kind", "content"],
        properties: {
          path: { type: "string" },
          kind: { type: "string", enum: ["report", "doc", "code", "test", "plan", "evidence"] },
          content: { type: "string" },
        },
      },
    },
    fileChanges: {
      type: "array",
      description:
        "Concrete code changes to APPLY to the workspace. Each entry is one COMPLETE file. " +
        "Use this - not `artifacts`, not `requestedToolCalls` `args_json` - for every source and test " +
        "file you add or modify. Empty array on a non-code stage.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "operation", "content"],
        properties: {
          path: { type: "string", description: "workspace-relative path, e.g. src/server.js" },
          operation: { type: "string", enum: ["create", "modify"] },
          content: { type: "string", description: "the complete new file text" },
        },
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
    requestedToolCalls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tool", "args_json", "reason"],
        properties: {
          tool: {
            type: "string",
            enum: ["workspace.read", "workspace.list", "workspace.write", "workspace.patch", "workspace.exec"],
          },
          args_json: {
            type: "string",
            description:
              "The tool arguments as a JSON object literal serialised to a string, " +
              'e.g. "{\\"path\\":\\"src/server.js\\",\\"content\\":\\"...\\"}". ' +
              'Use "{}" when the tool takes no arguments. Parsed and re-validated after schema validation.',
          },
          reason: { type: "string" },
        },
      },
    },
    handoff: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["to", "why"],
          properties: {
            to: { type: "string" },
            why: { type: "string" },
          },
        },
        { type: "null" },
      ],
    },
    qualityEvidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["check", "result", "detail"],
        properties: {
          check: { type: "string" },
          result: { type: "string", enum: ["PASS", "FAIL", "NOT_RUN"] },
          detail: { type: "string" },
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    errors: { type: "array", items: { type: "string" } },
  },
};

/**
 * Every object node in `MODEL_AUTHORED_RESULT_JSON_SCHEMA` (recursively, through
 * arrays and `anyOf`). Exported so a regression test can assert Groq strict
 * compatibility structurally: single-string `type`, `additionalProperties:
 * false`, and `required` covering every declared property, with no
 * `additionalProperties: true` anywhere.
 */
export function schemaObjectNodes(
  node: unknown = MODEL_AUTHORED_RESULT_JSON_SCHEMA,
  path = "$",
): { path: string; node: Record<string, unknown> }[] {
  if (!node || typeof node !== "object") return [];
  const n = node as Record<string, unknown>;
  const out: { path: string; node: Record<string, unknown> }[] = [];
  if (n.type === "object") out.push({ path, node: n });
  if (n.properties && typeof n.properties === "object") {
    for (const [k, v] of Object.entries(n.properties as Record<string, unknown>)) {
      out.push(...schemaObjectNodes(v, `${path}.${k}`));
    }
  }
  if (n.items) out.push(...schemaObjectNodes(n.items, `${path}[]`));
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(n[key])) {
      (n[key] as unknown[]).forEach((s, i) => out.push(...schemaObjectNodes(s, `${path}.${key}[${i}]`)));
    }
  }
  return out;
}

export const MODEL_AUTHORED_RESULT_SCHEMA_NAME = "AgentExecutionResult";

const VALID_STATUS = new Set(["PASS", "FAIL", "BLOCKED"]);
const VALID_KIND = new Set(["report", "doc", "code", "test", "plan", "evidence"]);
const VALID_EVIDENCE = new Set(["PASS", "FAIL", "NOT_RUN"]);

/** The balanced `{...}` substring starting at `start`, string- and escape-aware, or null. */
function balancedObjectFrom(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extract the model's JSON result object from a completion. Tolerates leading /
 * trailing prose and ```json fences - free models are inconsistent (build spec
 * section 29) - but does NOT tolerate a missing or unparseable object.
 *
 * It must ALSO tolerate a perfectly valid top-level object whose own string
 * values contain ``` fenced code blocks or stray braces (very common once
 * provider-native strict Structured Outputs make the model emit one clean object
 * with an artifact body inside it). The previous implementation stripped the
 * first ``` ... ``` span before scanning, which sliced such a response in half
 * and rejected it - the confirmed 2026-09-01 `business_analysis` blocker. This
 * version instead treats every `{` as a candidate, keeps only those that
 * `JSON.parse` into a plain object, and returns the richest one (the real
 * result object has far more keys than a fragment lifted out of a code block).
 */
export function extractJsonObject(text: string): { json: string | null; note: string } {
  const trimmed = text.trim();

  // Fast path: the whole response is exactly one JSON object (the strict path).
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const v = JSON.parse(trimmed);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return { json: trimmed, note: "whole response is a JSON object" };
      }
    } catch {
      /* fall through to the scanning path */
    }
  }

  if (!text.includes("{")) return { json: null, note: "no '{' found in model response" };

  let best: string | null = null;
  let bestKeys = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    const slice = balancedObjectFrom(text, i);
    if (!slice) continue;
    try {
      const v = JSON.parse(slice);
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const keys = Object.keys(v as Record<string, unknown>).length;
      if (keys > bestKeys) {
        best = slice;
        bestKeys = keys;
        // The real result carries 10 keys; nothing lifted from a code block will.
        if (keys >= 10) break;
      }
    } catch {
      /* not a valid object at this position */
    }
  }

  if (best) return { json: best, note: "extracted balanced JSON object" };
  return { json: null, note: "unbalanced braces in model response" };
}

export function parseModelResult(text: string): ParseOutcome {
  const problems: string[] = [];
  const { json, note } = extractJsonObject(text);
  if (!json) return { ok: false, value: null, problems: [note] };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, value: null, problems: [`JSON.parse failed: ${String(err)}`] };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, value: null, problems: ["top-level value is not a JSON object"] };
  }
  const o = raw as Record<string, unknown>;

  const status = String(o.status ?? "").toUpperCase();
  if (!VALID_STATUS.has(status)) problems.push(`status must be PASS|FAIL|BLOCKED, got '${o.status}'`);

  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  if (summary.length < 3) problems.push("summary is missing or too short");

  const reasoningSummary =
    typeof o.reasoningSummary === "string" ? o.reasoningSummary.trim() : "";
  if (reasoningSummary.length < 3) problems.push("reasoningSummary is missing or too short");

  const artifacts = coerceArtifacts(o.artifacts, problems);
  const fileChanges = coerceFileChanges(o.fileChanges, problems);
  const recommendations = coerceStringArray(o.recommendations);
  const requestedToolCalls = coerceToolCalls(o.requestedToolCalls, problems);
  const qualityEvidence = coerceEvidence(o.qualityEvidence, problems);
  const risks = coerceStringArray(o.risks);
  const errors = coerceStringArray(o.errors);

  let handoff: ModelAuthoredResult["handoff"] = null;
  if (o.handoff && typeof o.handoff === "object" && !Array.isArray(o.handoff)) {
    const h = o.handoff as Record<string, unknown>;
    if (typeof h.to === "string" && h.to.trim()) {
      handoff = { to: h.to.trim(), why: typeof h.why === "string" ? h.why : "" };
    }
  }

  if (problems.length > 0) return { ok: false, value: null, problems };

  return {
    ok: true,
    problems: [],
    value: {
      status: status as ModelAuthoredResult["status"],
      summary,
      reasoningSummary,
      artifacts,
      fileChanges,
      recommendations,
      requestedToolCalls,
      handoff,
      qualityEvidence,
      risks,
      errors,
    },
  };
}

/** Cap on a single file body in `fileChanges` - generous for a source file, still bounded. */
const MAX_FILE_CHANGE_BYTES = 262_144;

function coerceFileChanges(v: unknown, problems: string[]): FileChange[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push("fileChanges must be an array");
    return [];
  }
  const out: FileChange[] = [];
  for (const [i, item] of v.entries()) {
    if (typeof item !== "object" || item === null) {
      problems.push(`fileChanges[${i}] is not an object`);
      continue;
    }
    const f = item as Record<string, unknown>;
    const path = typeof f.path === "string" ? f.path.trim() : "";
    const operation = String(f.operation ?? "").toLowerCase();
    const content = typeof f.content === "string" ? f.content : "";
    if (!path) {
      problems.push(`fileChanges[${i}].path is missing`);
      continue;
    }
    if (operation !== "create" && operation !== "modify") {
      problems.push(`fileChanges[${i}].operation must be create|modify, got '${f.operation}'`);
      continue;
    }
    if (typeof f.content !== "string" || content.length === 0) {
      problems.push(`fileChanges[${i}].content is missing or empty (must be the complete file text)`);
      continue;
    }
    if (Buffer.byteLength(content) > MAX_FILE_CHANGE_BYTES) {
      problems.push(`fileChanges[${i}].content exceeds the ${MAX_FILE_CHANGE_BYTES}-byte bound`);
      continue;
    }
    out.push({ path, operation: operation as FileChange["operation"], content });
  }
  return out;
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

function coerceArtifacts(v: unknown, problems: string[]): AgentArtifact[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push("artifacts must be an array");
    return [];
  }
  const out: AgentArtifact[] = [];
  for (const [i, item] of v.entries()) {
    if (typeof item !== "object" || item === null) {
      problems.push(`artifacts[${i}] is not an object`);
      continue;
    }
    const a = item as Record<string, unknown>;
    const path = typeof a.path === "string" ? a.path.trim() : "";
    const kind = String(a.kind ?? "").toLowerCase();
    const content = typeof a.content === "string" ? a.content : "";
    if (!path) problems.push(`artifacts[${i}].path is missing`);
    if (!VALID_KIND.has(kind)) problems.push(`artifacts[${i}].kind invalid: '${a.kind}'`);
    if (path && VALID_KIND.has(kind)) {
      out.push({ path, kind: kind as AgentArtifact["kind"], content });
    }
  }
  return out;
}

function coerceToolCalls(v: unknown, problems: string[]): RequestedToolCall[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push("requestedToolCalls must be an array");
    return [];
  }
  const out: RequestedToolCall[] = [];
  for (const [i, item] of v.entries()) {
    if (typeof item !== "object" || item === null) {
      problems.push(`requestedToolCalls[${i}] is not an object`);
      continue;
    }
    const t = item as Record<string, unknown>;
    const tool = typeof t.tool === "string" ? t.tool.trim() : "";
    if (!tool) {
      problems.push(`requestedToolCalls[${i}].tool is missing`);
      continue;
    }
    const args = coerceToolArgs(t, i, problems);
    out.push({ tool, args, reason: typeof t.reason === "string" ? t.reason : "" });
  }
  return out;
}

/** Cap on a serialised `args_json` payload - generous for a file write, still bounded. */
const MAX_ARGS_JSON_BYTES = 262_144;

/**
 * Resolve a requested tool call's arguments. The strict-schema wire form is
 * `args_json` (a serialised JSON object string); an inline `args` object is still
 * accepted for the `response_format: json_object` fallback path and for callers
 * that predate the change. Either way the value must resolve to a plain JSON
 * object - a malformed `args_json` string is a validation failure, never silently
 * dropped, so the model cannot smuggle an unvalidated payload past the contract.
 */
function coerceToolArgs(t: Record<string, unknown>, i: number, problems: string[]): Record<string, unknown> {
  if (typeof t.args_json === "string") {
    const s = t.args_json.trim();
    if (s === "" || s === "{}") return {};
    if (Buffer.byteLength(s) > MAX_ARGS_JSON_BYTES) {
      problems.push(`requestedToolCalls[${i}].args_json exceeds the ${MAX_ARGS_JSON_BYTES}-byte bound`);
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      problems.push(`requestedToolCalls[${i}].args_json is not valid JSON`);
      return {};
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      problems.push(`requestedToolCalls[${i}].args_json must serialise a JSON object`);
      return {};
    }
    return parsed as Record<string, unknown>;
  }
  if (t.args && typeof t.args === "object" && !Array.isArray(t.args)) {
    return t.args as Record<string, unknown>;
  }
  return {};
}

function coerceEvidence(v: unknown, problems: string[]): QualityEvidenceItem[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    problems.push("qualityEvidence must be an array");
    return [];
  }
  const out: QualityEvidenceItem[] = [];
  for (const [i, item] of v.entries()) {
    if (typeof item !== "object" || item === null) continue;
    const e = item as Record<string, unknown>;
    const check = typeof e.check === "string" ? e.check.trim() : "";
    const result = String(e.result ?? "").toUpperCase();
    if (!check) continue;
    if (!VALID_EVIDENCE.has(result)) {
      problems.push(`qualityEvidence[${i}].result invalid: '${e.result}'`);
      continue;
    }
    out.push({
      check,
      result: result as QualityEvidenceItem["result"],
      detail: typeof e.detail === "string" ? e.detail : "",
    });
  }
  return out;
}

export interface RiskAssessed {
  risk: RiskLevel;
}
