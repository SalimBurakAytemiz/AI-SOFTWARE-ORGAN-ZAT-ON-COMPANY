/**
 * Project Factory V0.1 - domain model, lifecycle, and the two JSON Schemas.
 *
 * Project Factory turns a Human Founder's natural-language project description
 * into a structured, persistent project workspace on disk (projects/<slug>/) and
 * a validated, immutable Runtime handoff package. It does NOT build the software:
 * it stops at READY_FOR_BUILD and waits for an explicit Human Founder build
 * authorization before Runtime V1.1's Software Factory may execute.
 *
 * The schemas live here (not under the governance-locked repo `schemas/` dir) as
 * plain JSON-Schema objects, validated with the runtime's existing `ajv`
 * dependency - the same pattern as MODEL_AUTHORED_RESULT_JSON_SCHEMA.
 */

/** Project Factory lifecycle. Linear in V0.1; BUILD is never entered here. */
export const PROJECT_LIFECYCLE = [
  "DRAFT",
  "INTAKE",
  "DISCOVERY",
  "SPEC_READY",
  "PLAN_READY",
  "READY_FOR_BUILD",
] as const;
export type ProjectLifecycleState = (typeof PROJECT_LIFECYCLE)[number];

/** The next state after `s`, or null if `s` is the terminal Project Factory state. */
export function nextLifecycleState(s: ProjectLifecycleState): ProjectLifecycleState | null {
  const i = PROJECT_LIFECYCLE.indexOf(s);
  return i >= 0 && i < PROJECT_LIFECYCLE.length - 1 ? PROJECT_LIFECYCLE[i + 1]! : null;
}

export const PROJECT_TYPES = [
  "web_app",
  "api_service",
  "ecommerce",
  "mobile_app",
  "cli_tool",
  "data_platform",
  "internal_tool",
  "library",
  "other",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PLATFORMS = ["web", "mobile", "api", "desktop", "cli"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const SECURITY_LEVELS = ["standard", "elevated", "high", "critical"] as const;
export type SecurityLevel = (typeof SECURITY_LEVELS)[number];

export const BUSINESS_MODELS = [
  "b2c",
  "b2b",
  "b2b2c",
  "marketplace",
  "subscription",
  "internal",
  "open_source",
  "other",
] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

/** Per-project AI budget policy (build-time limits enforced later by the Runtime). */
export interface ProjectBudgetPolicy {
  /** Always try the free proof-provider chain first. */
  free_first: boolean;
  /** Hard ceiling on real model-provider requests for a single Runtime execution. */
  max_real_provider_requests: number;
  /** Hard ceiling on premium (paid / Codex) invocations. 0 = premium disabled. */
  max_premium_invocations: number;
  /** Premium use always needs an explicit per-run Human Founder authorization. */
  premium_authorization_required: boolean;
  /** Whether the free-first fallback (Groq -> NVIDIA) may engage. */
  provider_fallback_allowed: boolean;
}

/** Governance controls every project inherits from Runtime V1.1. All are fixed true. */
export interface ProjectGovernance {
  human_founder_approval_required: true;
  kill_switch: true;
  audit: true;
  capability_gates: true;
  secret_protection: true;
  no_automatic_production_deployment: true;
  no_financial_actions: true;
  no_destructive_production_operations: true;
}

export const INHERITED_GOVERNANCE: ProjectGovernance = Object.freeze({
  human_founder_approval_required: true,
  kill_switch: true,
  audit: true,
  capability_gates: true,
  secret_protection: true,
  no_automatic_production_deployment: true,
  no_financial_actions: true,
  no_destructive_production_operations: true,
});

export interface BuildAuthorization {
  granted: boolean;
  granted_by: string | null;
  granted_at: string | null;
  note: string | null;
}

export interface LifecycleHistoryEntry {
  state: ProjectLifecycleState;
  at: string;
  note: string;
}

/** The structured project definition persisted as projects/<slug>/project.yml. */
export interface ProjectDefinition {
  /** Schema version of this document. */
  schema_version: string;
  project_id: string;
  project_name: string;
  slug: string;
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
  /** 0-5, aligned with models/risk-policy.yml. */
  risk_level: number;
  budget_policy: ProjectBudgetPolicy;
  /** Which Runtime workflow this project will request at build time. */
  requested_workflow: string;
  governance: ProjectGovernance;
  status: ProjectLifecycleState;
  build_authorization: BuildAuthorization;
  created_by: string;
  created_at: string;
  updated_at: string;
  history: LifecycleHistoryEntry[];
}

// ---------------------------------------------------------------------------
// JSON Schemas (validated with ajv - see schema-check.ts)
// ---------------------------------------------------------------------------

const NON_EMPTY_STRING_ARRAY = {
  type: "array",
  items: { type: "string", minLength: 1 },
} as const;

export const PROJECT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://ai-software-company/project-factory/project.schema.json",
  title: "Project Factory - Project Definition",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "project_id",
    "project_name",
    "slug",
    "description",
    "business_goal",
    "project_type",
    "target_users",
    "target_market",
    "business_model",
    "platforms",
    "core_features",
    "constraints",
    "integrations",
    "security_level",
    "risk_level",
    "budget_policy",
    "requested_workflow",
    "governance",
    "status",
    "build_authorization",
    "created_by",
    "created_at",
    "updated_at",
    "history",
  ],
  properties: {
    schema_version: { type: "string", minLength: 1 },
    project_id: { type: "string", pattern: "^proj_[0-9a-f-]{8,}$" },
    project_name: { type: "string", minLength: 2, maxLength: 120 },
    slug: { type: "string", pattern: "^[a-z][a-z0-9-]{1,48}[a-z0-9]$" },
    description: { type: "string", minLength: 10, maxLength: 4000 },
    business_goal: { type: "string", minLength: 3, maxLength: 2000 },
    project_type: { type: "string", enum: [...PROJECT_TYPES] },
    target_users: { ...NON_EMPTY_STRING_ARRAY, minItems: 1 },
    target_market: { type: "string", minLength: 1, maxLength: 400 },
    business_model: { type: "string", enum: [...BUSINESS_MODELS] },
    platforms: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", enum: [...PLATFORMS] },
    },
    core_features: { ...NON_EMPTY_STRING_ARRAY, minItems: 1, maxItems: 100 },
    constraints: NON_EMPTY_STRING_ARRAY,
    integrations: NON_EMPTY_STRING_ARRAY,
    security_level: { type: "string", enum: [...SECURITY_LEVELS] },
    risk_level: { type: "integer", minimum: 0, maximum: 5 },
    budget_policy: {
      type: "object",
      additionalProperties: false,
      required: [
        "free_first",
        "max_real_provider_requests",
        "max_premium_invocations",
        "premium_authorization_required",
        "provider_fallback_allowed",
      ],
      properties: {
        free_first: { type: "boolean" },
        max_real_provider_requests: { type: "integer", minimum: 0, maximum: 1000 },
        max_premium_invocations: { type: "integer", minimum: 0, maximum: 100 },
        premium_authorization_required: { type: "boolean" },
        provider_fallback_allowed: { type: "boolean" },
      },
    },
    requested_workflow: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
    governance: {
      type: "object",
      additionalProperties: false,
      required: [
        "human_founder_approval_required",
        "kill_switch",
        "audit",
        "capability_gates",
        "secret_protection",
        "no_automatic_production_deployment",
        "no_financial_actions",
        "no_destructive_production_operations",
      ],
      properties: {
        human_founder_approval_required: { const: true },
        kill_switch: { const: true },
        audit: { const: true },
        capability_gates: { const: true },
        secret_protection: { const: true },
        no_automatic_production_deployment: { const: true },
        no_financial_actions: { const: true },
        no_destructive_production_operations: { const: true },
      },
    },
    status: { type: "string", enum: [...PROJECT_LIFECYCLE] },
    build_authorization: {
      type: "object",
      additionalProperties: false,
      required: ["granted", "granted_by", "granted_at", "note"],
      properties: {
        granted: { type: "boolean" },
        granted_by: { type: ["string", "null"] },
        granted_at: { type: ["string", "null"] },
        note: { type: ["string", "null"] },
      },
    },
    created_by: { type: "string", minLength: 1 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    history: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["state", "at", "note"],
        properties: {
          state: { type: "string", enum: [...PROJECT_LIFECYCLE] },
          at: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * The immutable execution package Project Factory hands to Runtime V1.1. It is a
 * closed, self-describing snapshot: identity, the product spec as markdown,
 * constraints, risk, budget policy, inherited governance, and the build
 * authorization. `checksum` is a SHA-256 of the canonical body - Runtime verifies
 * it before executing so a tampered package is rejected.
 */
export const HANDOFF_PACKAGE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://ai-software-company/project-factory/runtime-handoff.schema.json",
  title: "Project Factory - Runtime Handoff Package",
  type: "object",
  additionalProperties: false,
  required: [
    "package_version",
    "generated_at",
    "project_id",
    "slug",
    "project_name",
    "requested_workflow",
    "risk_level",
    "security_level",
    "product",
    "constraints",
    "integrations",
    "budget_policy",
    "governance",
    "build_authorization",
    "checksum",
  ],
  properties: {
    package_version: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    project_id: { type: "string", pattern: "^proj_[0-9a-f-]{8,}$" },
    slug: { type: "string", pattern: "^[a-z][a-z0-9-]{1,48}[a-z0-9]$" },
    project_name: { type: "string", minLength: 2 },
    requested_workflow: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
    risk_level: { type: "integer", minimum: 0, maximum: 5 },
    security_level: { type: "string", enum: [...SECURITY_LEVELS] },
    product: {
      type: "object",
      additionalProperties: false,
      required: [
        "brief",
        "requirements",
        "business_rules",
        "user_stories",
        "acceptance_criteria",
      ],
      properties: {
        brief: { type: "string", minLength: 1 },
        requirements: { type: "string", minLength: 1 },
        business_rules: { type: "string", minLength: 1 },
        user_stories: { type: "string", minLength: 1 },
        acceptance_criteria: { type: "string", minLength: 1 },
      },
    },
    constraints: { type: "array", items: { type: "string" } },
    integrations: { type: "array", items: { type: "string" } },
    budget_policy: (PROJECT_SCHEMA.properties as Record<string, unknown>).budget_policy,
    governance: (PROJECT_SCHEMA.properties as Record<string, unknown>).governance,
    build_authorization: (PROJECT_SCHEMA.properties as Record<string, unknown>).build_authorization,
    checksum: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
  },
} as const;

export const PROJECT_SCHEMA_VERSION = "0.1";
export const HANDOFF_PACKAGE_VERSION = "0.1";
