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
  /** Arguments for the tool (path, content, command, ...). */
  args: Record<string, unknown>;
  /** Why the agent wants this call - recorded, then adjudicated by the gateway. */
  reason: string;
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

const VALID_STATUS = new Set(["PASS", "FAIL", "BLOCKED"]);
const VALID_KIND = new Set(["report", "doc", "code", "test", "plan", "evidence"]);
const VALID_EVIDENCE = new Set(["PASS", "FAIL", "NOT_RUN"]);

/**
 * Extract the first balanced top-level JSON object from a model response. Tolerates
 * ```json fences, leading prose, and trailing prose - free models are inconsistent
 * (build spec section 29) - but does NOT tolerate a missing or unparseable object.
 */
export function extractJsonObject(text: string): { json: string | null; note: string } {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1]! : text;
  const start = candidate.indexOf("{");
  if (start === -1) return { json: null, note: "no '{' found in model response" };

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]!;
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
      if (depth === 0) {
        return { json: candidate.slice(start, i + 1), note: "extracted balanced object" };
      }
    }
  }
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
      recommendations,
      requestedToolCalls,
      handoff,
      qualityEvidence,
      risks,
      errors,
    },
  };
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
    const args =
      t.args && typeof t.args === "object" && !Array.isArray(t.args)
        ? (t.args as Record<string, unknown>)
        : {};
    out.push({ tool, args, reason: typeof t.reason === "string" ? t.reason : "" });
  }
  return out;
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
