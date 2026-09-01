import type { ModelTier } from "../core/types.ts";

// Provider-independent model interface (build spec section 11). The company is
// never bound to one vendor. All concrete providers implement this; the router
// selects a tier, the provider maps the tier to a concrete model.

export interface GenerateRequest {
  tier: ModelTier;
  system?: string;
  prompt: string;
  /** Free-form context the caller has already bounded (never a whole repo). */
  context?: string;
  maxOutputTokens?: number;
  /** Deterministic seed for reproducible tests. */
  seed?: number;
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
}

export interface ProviderHealth {
  provider: string;
  status: "OK" | "NOT_CONFIGURED" | "ERROR";
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
