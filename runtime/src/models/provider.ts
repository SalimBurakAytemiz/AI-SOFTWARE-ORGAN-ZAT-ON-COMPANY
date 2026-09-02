import type { ModelTier } from "../core/types.ts";
import type { RateLimitSnapshot } from "./rate-limit.ts";

// Provider-independent model interface (build spec section 11). The company is
// never bound to one vendor. All concrete providers implement this; the router
// selects a tier, the provider maps the tier to a concrete model.

/** Native structured-output request: a JSON Schema the provider must enforce. */
export interface ResponseSchema {
  name: string;
  schema: Record<string, unknown>;
  /** Enforce the schema exactly (OpenAI/Groq `strict: true`). Default true. */
  strict?: boolean;
}

export interface GenerateRequest {
  tier: ModelTier;
  system?: string;
  prompt: string;
  /** Free-form context the caller has already bounded (never a whole repo). */
  context?: string;
  maxOutputTokens?: number;
  /** Deterministic seed for reproducible tests. */
  seed?: number;
  /**
   * When set AND the provider advertises the capability, the request is sent
   * with `response_format: { type: "json_schema", json_schema: { strict: true }}`
   * so the API - not just the prompt - enforces the structure.
   */
  responseSchema?: ResponseSchema;
  /**
   * Reasoning effort for models that support it (e.g. Groq gpt-oss). Kept low by
   * default for the simple proof so free-tier token budget is not burned on
   * unnecessary reasoning. Private chain-of-thought is never requested or stored.
   */
  reasoningEffort?: "low" | "medium" | "high";
}

export interface Usage {
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface GenerateResult {
  provider: string;
  model: string;
  tier: ModelTier;
  text: string;
  usage: Usage;
  /** USD or null when the provider does not report cost (never invented). */
  estimated_cost_usd: number | null;
  duration_ms: number;
  /**
   * Raw provider stop reason for the completion (`"stop"`, `"length"`,
   * `"content_filter"`, ...), lower-cased where the provider varies casing, or
   * `null` when the provider did not report one. `"length"` (and aliases) means
   * the model hit the output-token cap - the response is truncated.
   */
  finish_reason?: string | null;
  /** The output-token cap actually applied to this request (for truncation detection). */
  max_output_tokens?: number;
  /** Rate-limit metadata parsed from the response headers (credential-free), or null. */
  rate_limit?: RateLimitSnapshot | null;
  /** True when this response was produced with native JSON-Schema structured output. */
  structured_output?: boolean;
  /**
   * Which `response_format` actually shaped this response:
   *   - `json_schema`  provider-native strict Structured Outputs (the schema was enforced),
   *   - `json_object`  API-forced valid JSON, but not the schema (the safe fallback after a
   *                    provider rejected the schema with HTTP 400),
   *   - `none`         prompt-only JSON (the provider advertises no structured-output support).
   * The response is parsed and validated against the full contract in every mode.
   */
  structured_output_mode?: "json_schema" | "json_object" | "none";
  /**
   * Set only on the single response where a `response_format: json_schema`
   * request 400'd and this client fell back to json_object. `reason` is
   * `schema_unsupported` (the endpoint does not accept the schema) or
   * `json_validate_failed` (the model could not finish a schema-valid
   * generation). Credential-free; recorded to telemetry/audit by the caller.
   */
  schema_rejection?: { fellBackTo: "json_object"; reason: "schema_unsupported" | "json_validate_failed" } | null;
}

export interface ProviderHealth {
  provider: string;
  status: "OK" | "NOT_CONFIGURED" | "RATE_LIMITED" | "ERROR";
  detail: string;
  /** Tiers this provider can currently serve. */
  tiers: ModelTier[];
}

export interface ModelProvider {
  readonly name: string;
  /** True when the provider can actually serve requests right now. */
  isReady(): boolean;
  health(): ProviderHealth;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  /** Aggregate usage the provider has observed this process (best effort). */
  usage(): Usage;
}
