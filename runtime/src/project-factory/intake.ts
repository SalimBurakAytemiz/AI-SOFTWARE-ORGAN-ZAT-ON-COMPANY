import { assessRiskFromText, clampRisk } from "../policy/risk.ts";
import { looksLikeSecret } from "../core/redaction.ts";
import { RuntimeError } from "../core/errors.ts";
import {
  BUSINESS_MODELS,
  PLATFORMS,
  PROJECT_TYPES,
  SECURITY_LEVELS,
  type BusinessModel,
  type Platform,
  type ProjectType,
  type SecurityLevel,
} from "./project-model.ts";

/**
 * Deterministic natural-language project intake (Project Factory V0.1, build
 * spec sections 3, 6, 7).
 *
 * Creating a project is a LOW-risk, deterministic operation: no model call is
 * required and Project Factory never needs a paid API or Codex just to create a
 * project. This module parses a Human Founder's free-text brief - either
 * labelled fields ("Project name: X", "Description: ...") or plain prose - into
 * the structured fields the project schema requires, using conservative
 * heuristics. Anything it cannot infer gets an explicit, safe default and is
 * listed in `assumptions` so the Human Founder can correct it.
 *
 * An optional model-backed enricher (see `ProjectEnricher`) can refine the
 * result later using the existing FREE-FIRST provider chain; it is never
 * required and never invoked by default.
 */

export interface RawIntake {
  /** Free-text brief. May contain "Label: value" lines and/or prose. */
  brief: string;
  /** Explicit overrides (from CLI flags or a partial YAML), applied last. */
  overrides?: Partial<StructuredIntake>;
}

export interface StructuredIntake {
  project_name: string;
  description: string;
  business_goal: string;
  project_type: ProjectType;
  target_users: string[];
  target_market: string;
  business_model: BusinessModel;
  platforms: Platform[];
  core_features: string[];
  constraints: string[];
  integrations: string[];
  security_level: SecurityLevel;
  risk_level: number;
  requested_workflow: string;
}

export interface IntakeResult {
  structured: StructuredIntake;
  /** Human-readable notes about every inferred / defaulted field. */
  assumptions: string[];
  /** True if a labelled "Project name:" / "Description:" form was detected. */
  labelledForm: boolean;
}

const LABELS: Record<string, keyof StructuredIntake | "brief"> = {
  "project name": "project_name",
  name: "project_name",
  project: "project_name",
  description: "description",
  summary: "description",
  "business goal": "business_goal",
  goal: "business_goal",
  "target users": "target_users",
  users: "target_users",
  "target market": "target_market",
  market: "target_market",
  "business model": "business_model",
  platforms: "platforms",
  "core features": "core_features",
  features: "core_features",
  constraints: "constraints",
  integrations: "integrations",
  "security level": "security_level",
  workflow: "requested_workflow",
};

function splitList(v: string): string[] {
  return v
    .split(/[\n;,]|(?:\s-\s)|(?:•)/)
    .map((s) => s.replace(/^[\s*\-•]+/, "").trim())
    .filter((s) => s.length > 0);
}

/** Extract "Label: value" blocks (value may span following indented / bulleted lines). */
function parseLabelled(brief: string): { fields: Partial<Record<string, string>>; found: boolean } {
  const lines = brief.split(/\r?\n/);
  const fields: Partial<Record<string, string>> = {};
  let current: string | null = null;
  let buf: string[] = [];
  let found = false;
  const flush = () => {
    if (current) fields[current] = (fields[current] ? fields[current] + "\n" : "") + buf.join("\n").trim();
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z /]{1,30}?)\s*:\s*(.*)$/);
    const key = m ? m[1]!.trim().toLowerCase() : null;
    if (key && key in LABELS) {
      flush();
      current = LABELS[key] as string;
      buf = m![2] ? [m![2]!] : [];
      found = true;
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return { fields, found };
}

function inferProjectType(text: string): { value: ProjectType; why: string } {
  const t = text.toLowerCase();
  const rules: [RegExp, ProjectType][] = [
    [/\b(e-?commerce|online store|storefront|shop(ping)?|marketplace|sell(ing)? .*(product|good|suppl))/, "ecommerce"],
    [/\b(mobile app|ios app|android app|react native|flutter)\b/, "mobile_app"],
    [/\b(cli tool|command[- ]line|terminal tool)\b/, "cli_tool"],
    [/\b(data platform|data pipeline|etl|analytics platform|warehouse)\b/, "data_platform"],
    [/\b(internal tool|back[- ]office|admin panel|ops tool)\b/, "internal_tool"],
    [/\b(library|sdk|package|framework)\b/, "library"],
    [/\b(api service|rest api|graphql api|microservice|backend service|web service|\/health)\b/, "api_service"],
    [/\b(web app|web application|website|portal|dashboard|saas)\b/, "web_app"],
  ];
  for (const [re, value] of rules) if (re.test(t)) return { value, why: `matched /${re.source}/` };
  return { value: "other", why: "no specific signal; defaulted to 'other'" };
}

function inferBusinessModel(text: string): { value: BusinessModel; why: string } {
  const t = text.toLowerCase();
  const b2b = /\bb2b\b|business customer|\bbusinesses\b|enterprise|wholesale|bulk order/.test(t);
  const b2c = /\bb2c\b|\bindividual(s)?\b|consumer|retail|shopper|end[- ]user/.test(t);
  if (b2b && b2c) return { value: "b2b2c", why: "brief mentions both business and individual customers" };
  if (/\bmarketplace\b/.test(t)) return { value: "marketplace", why: "brief mentions a marketplace" };
  if (/\bsubscription|saas\b/.test(t)) return { value: "subscription", why: "brief mentions subscription/SaaS" };
  if (b2b) return { value: "b2b", why: "brief mentions business customers" };
  if (b2c) return { value: "b2c", why: "brief mentions individual/consumer customers" };
  if (/\binternal\b/.test(t)) return { value: "internal", why: "brief describes an internal tool" };
  if (/\bopen[- ]source\b/.test(t)) return { value: "open_source", why: "brief mentions open source" };
  return { value: "other", why: "no explicit business model in the brief" };
}

function inferPlatforms(text: string, type: ProjectType): { value: Platform[]; why: string } {
  const t = text.toLowerCase();
  const set = new Set<Platform>();
  if (/\bweb\b|website|browser|responsive|portal|dashboard|storefront/.test(t)) set.add("web");
  if (/\bmobile\b|ios|android|react native|flutter|pwa\b/.test(t)) set.add("mobile");
  if (/\bapi\b|rest|graphql|endpoint|microservice|\/health/.test(t)) set.add("api");
  if (/\bdesktop\b|electron\b/.test(t)) set.add("desktop");
  if (/\bcli\b|command[- ]line|terminal/.test(t)) set.add("cli");
  if (set.size === 0) {
    const fallback: Platform =
      type === "api_service" ? "api" : type === "mobile_app" ? "mobile" : type === "cli_tool" ? "cli" : "web";
    set.add(fallback);
    return { value: [...set], why: `no platform stated; defaulted to '${fallback}' from project type '${type}'` };
  }
  return { value: [...set], why: `detected: ${[...set].join(", ")}` };
}

function inferTargetMarket(text: string): { value: string; why: string } {
  const countries =
    /\b(t[üu]rkiye|turkey|germany|deutschland|united states|usa|uk|united kingdom|france|spain|italy|netherlands|europe|eu|global|worldwide|mena|gcc)\b/i;
  const m = text.match(countries);
  if (m) return { value: m[1]!.replace(/\bturkey\b/i, "Türkiye"), why: `market region named in the brief: ${m[1]}` };
  return { value: "unspecified", why: "no target market/region named in the brief" };
}

function inferTargetUsers(text: string, model: BusinessModel): { value: string[]; why: string } {
  const t = text.toLowerCase();
  const users = new Set<string>();
  if (/\bindividual|consumer|retail|shopper|end user|customer\b/.test(t)) users.add("individual customers");
  if (/\bbusiness customer|b2b|enterprise|wholesale|company\b/.test(t)) users.add("business customers");
  if (/\badmin|operator|back[- ]office|staff|internal user\b/.test(t)) users.add("internal operators");
  if (/\bdeveloper|engineer\b/.test(t)) users.add("developers");
  if (users.size === 0) {
    const d =
      model === "b2b"
        ? "business customers"
        : model === "internal"
          ? "internal operators"
          : model === "open_source"
            ? "developers"
            : "end users";
    users.add(d);
    return { value: [...users], why: `no users stated; defaulted to '${d}' from business model '${model}'` };
  }
  return { value: [...users], why: `detected: ${[...users].join(", ")}` };
}

function inferSecurityLevel(text: string, risk: number): { value: SecurityLevel; why: string } {
  const t = text.toLowerCase();
  if (/\bpayment|checkout|card|billing|invoic|refund|financial\b/.test(t) || risk >= 5) {
    return { value: "high", why: "brief involves payments / financial data or risk >= 5" };
  }
  if (/\b(customer data|pii|personal data|account|login|auth|password)\b/.test(t) || risk >= 4) {
    return { value: "elevated", why: "brief involves accounts / personal data or risk >= 4" };
  }
  return { value: "standard", why: "no elevated-security signal in the brief" };
}

/** Very small feature extraction: explicit "features" list, or verb-phrase sentences. */
function inferFeatures(text: string, labelled: string[] | undefined): { value: string[]; why: string } {
  if (labelled && labelled.length) return { value: labelled.slice(0, 50), why: "taken from the brief's features list" };
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const feat = sentences
    .filter((s) => /\b(support|allow|enable|provide|manage|track|sell|book|order|checkout|browse|search|register|invoice|report|return|get \/)\b/i.test(s))
    .map((s) => s.replace(/^(the system |it |we )?(should |must |will )?/i, "").replace(/[.]+$/, "").trim())
    .filter((s) => s.length > 3 && s.length < 200);
  if (feat.length) return { value: [...new Set(feat)].slice(0, 20), why: "extracted from action sentences in the brief" };
  return {
    value: ["Deliver the described capability as a minimal, testable first version"],
    why: "no discrete features found in the brief; recorded one starter feature for Discovery to expand",
  };
}

const COERCE_ENUM = <T extends string>(raw: string, allowed: readonly T[]): T | null => {
  const n = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(n) ? (n as T) : null;
};

/**
 * Parse a natural-language brief (+ optional overrides) into a fully-populated
 * StructuredIntake. Pure and deterministic - same input always yields the same
 * output. Never performs I/O or a model call.
 */
export function parseIntake(raw: RawIntake): IntakeResult {
  const brief = (raw.brief ?? "").trim();
  if (!brief && !raw.overrides?.description && !raw.overrides?.project_name) {
    throw new RuntimeError("PROJECT_INTAKE_EMPTY", "a project brief (or --name + --description) is required");
  }
  if (looksLikeSecret(brief)) {
    throw new RuntimeError(
      "PROJECT_INTAKE_SECRET",
      "the project brief looks like it contains a secret/credential; remove it and describe the project only",
    );
  }

  const { fields, found } = parseLabelled(brief);
  const assumptions: string[] = [];
  const prose = brief;

  const name = (raw.overrides?.project_name ?? fields.project_name ?? "").trim();
  const description = (raw.overrides?.description ?? fields.description ?? (found ? "" : prose)).trim();
  const projectName = name || description.split(/[.\n]/)[0]!.slice(0, 60).trim() || "Untitled Project";
  if (!name) assumptions.push(`project_name inferred from the description: "${projectName}"`);
  const desc = description || projectName;
  if (!description) assumptions.push("description defaulted to the project name (brief had no description)");

  // When the brief used labelled fields, infer from the extracted values only -
  // re-scanning the raw brief would treat "Description: ..." label lines as prose
  // and, for example, duplicate a feature. Plain-prose briefs are scanned whole.
  const searchText = found ? `${projectName}\n${desc}` : `${projectName}\n${desc}\n${prose}`;

  const typeInf =
    (raw.overrides?.project_type && { value: raw.overrides.project_type, why: "set explicitly" }) ||
    (fields.project_type && COERCE_ENUM(fields.project_type, PROJECT_TYPES) && {
      value: COERCE_ENUM(fields.project_type, PROJECT_TYPES)!,
      why: "from the brief",
    }) ||
    inferProjectType(searchText);
  assumptions.push(`project_type = ${typeInf.value} (${typeInf.why})`);

  const bmInf =
    (raw.overrides?.business_model && { value: raw.overrides.business_model, why: "set explicitly" }) ||
    (fields.business_model && COERCE_ENUM(fields.business_model, BUSINESS_MODELS) && {
      value: COERCE_ENUM(fields.business_model, BUSINESS_MODELS)!,
      why: "from the brief",
    }) ||
    inferBusinessModel(searchText);
  assumptions.push(`business_model = ${bmInf.value} (${bmInf.why})`);

  const platInf =
    (raw.overrides?.platforms?.length && { value: raw.overrides.platforms, why: "set explicitly" }) ||
    (fields.platforms &&
      splitList(fields.platforms).map((p) => COERCE_ENUM(p, PLATFORMS)).filter(Boolean).length && {
        value: splitList(fields.platforms).map((p) => COERCE_ENUM(p, PLATFORMS)!).filter(Boolean) as Platform[],
        why: "from the brief",
      }) ||
    inferPlatforms(searchText, typeInf.value);
  assumptions.push(`platforms = [${platInf.value.join(", ")}] (${platInf.why})`);

  const marketInf =
    (raw.overrides?.target_market && { value: raw.overrides.target_market, why: "set explicitly" }) ||
    (fields.target_market && { value: fields.target_market.trim(), why: "from the brief" }) ||
    inferTargetMarket(searchText);
  assumptions.push(`target_market = ${marketInf.value} (${marketInf.why})`);

  const usersInf =
    (raw.overrides?.target_users?.length && { value: raw.overrides.target_users, why: "set explicitly" }) ||
    (fields.target_users && splitList(fields.target_users).length && {
      value: splitList(fields.target_users),
      why: "from the brief",
    }) ||
    inferTargetUsers(searchText, bmInf.value);
  assumptions.push(`target_users = [${usersInf.value.join(", ")}] (${usersInf.why})`);

  const risk =
    raw.overrides?.risk_level != null
      ? clampRisk(raw.overrides.risk_level)
      : clampRisk(assessRiskFromText(searchText, 2));
  assumptions.push(
    raw.overrides?.risk_level != null
      ? `risk_level = ${risk} (set explicitly)`
      : `risk_level = ${risk} (heuristic from the brief; floor 2 for any real feature work)`,
  );

  const secInf =
    (raw.overrides?.security_level && { value: raw.overrides.security_level, why: "set explicitly" }) ||
    (fields.security_level && COERCE_ENUM(fields.security_level, SECURITY_LEVELS) && {
      value: COERCE_ENUM(fields.security_level, SECURITY_LEVELS)!,
      why: "from the brief",
    }) ||
    inferSecurityLevel(searchText, risk);
  assumptions.push(`security_level = ${secInf.value} (${secInf.why})`);

  const featInf =
    (raw.overrides?.core_features?.length && { value: raw.overrides.core_features, why: "set explicitly" }) ||
    inferFeatures(searchText, fields.core_features ? splitList(fields.core_features) : undefined);
  assumptions.push(`core_features: ${featInf.value.length} item(s) (${featInf.why})`);

  const constraints =
    raw.overrides?.constraints ??
    (fields.constraints ? splitList(fields.constraints) : []);
  const integrations =
    raw.overrides?.integrations ??
    (fields.integrations ? splitList(fields.integrations) : []);

  const goal =
    (raw.overrides?.business_goal ?? fields.business_goal ?? "").trim() ||
    `Deliver a working first version of ${projectName} for ${usersInf.value.join(" and ")}.`;
  if (!raw.overrides?.business_goal && !fields.business_goal) {
    assumptions.push("business_goal synthesised from the project name and target users");
  }

  const workflow =
    (raw.overrides?.requested_workflow ?? fields.requested_workflow ?? "feature-development").trim();

  return {
    labelledForm: found,
    assumptions,
    structured: {
      project_name: projectName,
      description: desc,
      business_goal: goal,
      project_type: typeInf.value,
      target_users: usersInf.value,
      target_market: marketInf.value,
      business_model: bmInf.value,
      platforms: [...new Set(platInf.value)],
      core_features: featInf.value,
      constraints,
      integrations,
      security_level: secInf.value,
      risk_level: risk,
      requested_workflow: workflow,
    },
  };
}

// ---------------------------------------------------------------------------
// Optional model-backed enrichment (never required; FREE-FIRST when used).
// ---------------------------------------------------------------------------

/**
 * A pluggable refinement step. The deterministic result is always produced
 * first; an enricher may only *fill or sharpen* fields, never remove governance
 * or lower risk. Project Factory V0.1 ships only the deterministic path; a
 * model-backed enricher can be supplied by the caller using the existing
 * FREE-FIRST proof-provider chain and is out of scope for the default flow.
 */
export interface ProjectEnricher {
  readonly name: string;
  enrich(base: IntakeResult, brief: string): Promise<IntakeResult>;
}

/** The default: a no-op that returns the deterministic result unchanged. */
export const DETERMINISTIC_ENRICHER: ProjectEnricher = {
  name: "deterministic",
  enrich: async (base) => base,
};
