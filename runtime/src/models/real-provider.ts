import {
  OpenAICompatibleProvider,
  type OpenAICompatibleConfig,
  type ProviderSensitivity,
} from "./openai-compatible-provider.ts";
import type { RateLimitSchedulerConfig } from "./rate-limit-scheduler.ts";

/**
 * Real model provider configuration (build spec sections 4, 5, 30). The runtime
 * stays provider-independent: every real proof provider is the ONE generic
 * OpenAI-compatible provider, configured from the environment. There is no
 * per-vendor HTTP client.
 *
 * V1.1 proof provider strategy (FREE-FIRST fallback chain):
 *   - Groq Direct  = PREFERRED / PRIMARY proof provider (default). Stable
 *     first-party OpenAI-compatible endpoint; `openai/gpt-oss-120b` satisfies the
 *     strict AgentExecutionResult JSON contract natively.
 *   - NVIDIA NIM   = FREE FALLBACK proof provider. Used ONLY when Groq reaches a
 *     bounded RATE_LIMIT_EXHAUSTED during the proof (Groq free-tier daily quota).
 *     `nvidia/nemotron-3.5-lightning-30b-a3b`; 1M context; the runtime disables
 *     the model's chain-of-thought (`chat_template_kwargs.thinking=false`) and
 *     uses prompt-only structured output - the AgentExecutionResult still passes
 *     the full runtime schema validation, nothing is accepted unvalidated.
 *   - OpenRouter   = OPTIONAL, still supported (AI_COMPANY_REAL_PROVIDER=openrouter),
 *     but NEVER auto-selected for this proof's fallback chain.
 *
 * Every real provider here is a PROOF_PROVIDER / NON_SENSITIVE_PROOF_ONLY - not
 * an approved permanent production provider, and never a paid provider. No
 * credential is ever read in this module except the *name* of the env var; the
 * provider reads the key itself, at call time, and never logs, persists or
 * audits it.
 *
 * Recognised environment variables:
 *   AI_COMPANY_REAL_PROVIDER   groq | nvidia | openrouter | openai-compatible | disabled  (default: groq)
 *   AI_COMPANY_REAL_BASE_URL   override the base URL for the selected provider
 *   AI_COMPANY_REAL_MODEL      explicit model id override
 *   AI_COMPANY_REAL_API_KEY_ENV   name of the var holding the key (provider default otherwise)
 *   AI_COMPANY_REAL_TIMEOUT_MS    default 60000
 *   AI_COMPANY_REAL_MAX_RETRIES   default 2
 *   AI_COMPANY_REAL_FALLBACK   free-first fallback chain for the proof
 *                              (default "nvidia" when NVIDIA_API_KEY is present; "none" to disable)
 *   GROQ_API_KEY / NVIDIA_API_KEY / OPENROUTER_API_KEY / <the named var>   the actual key (env only, never committed)
 */

export const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/** Groq's `openai/gpt-oss-120b` - the initial V1.1 proof model. Override with AI_COMPANY_REAL_MODEL. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_API_KEY_ENV = "GROQ_API_KEY";

export const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
/** NVIDIA NIM Nemotron - the V1.1 FREE fallback proof model. Override with AI_COMPANY_REAL_MODEL. */
export const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
export const NVIDIA_API_KEY_ENV = "NVIDIA_API_KEY";

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/**
 * OpenRouter's vendor-neutral free router. Only used when OpenRouter is
 * explicitly selected as the fallback proof provider. Override with
 * AI_COMPANY_REAL_MODEL to pin a specific model.
 */
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
export const OPENROUTER_API_KEY_ENV = "OPENROUTER_API_KEY";

/** @deprecated kept for compatibility; use OPENROUTER_API_KEY_ENV. */
export const DEFAULT_API_KEY_ENV = OPENROUTER_API_KEY_ENV;

/** The provider strategy default. Groq Direct is the preferred V1.1 proof provider. */
export const DEFAULT_REAL_PROVIDER_KIND = "groq";

export type RealProviderId = "groq" | "nvidia" | "openrouter" | "openai-compatible";

/**
 * Non-secret capability metadata for a proof provider/model. Registered here in
 * code (proof providers are deliberately NOT in the provider-independent
 * governance model config - they are PROOF_PROVIDER only). `contextWindow` is the
 * model's input context, NOT the output-token budget: stage-specific bounded
 * output budgets still apply.
 */
export interface RealProviderCapabilities {
  costTier: "FREE";
  contextWindow: number;
  longContext: boolean;
  agentic: boolean;
  coding: boolean;
  reasoning: boolean;
}

export interface RealProviderDescriptor {
  /** How the runtime should present this run (build spec section 28). */
  label:
    | "REAL / Groq Direct proof"
    | "REAL / NVIDIA NIM proof"
    | "REAL / OpenRouter proof"
    | "REAL / OpenAI-compatible";
  /** Stable id for reporting/health (never a secret). */
  id: RealProviderId;
  provider: OpenAICompatibleProvider;
  apiKeyEnv: string;
  baseUrl: string;
  model: string;
  isProofProvider: boolean;
  sensitivity: ProviderSensitivity;
  /**
   * Whether this endpoint supports provider-native JSON-Schema structured output
   * (`response_format: json_schema`). Learned per vendor; the provider still
   * self-heals a 400 by disabling it.
   */
  nativeStructuredOutput: boolean;
  /**
   * SAFE FALLBACK rate-limit scheduler defaults for this provider (pacing, 429
   * cycles, assumed window). These are only a starting point - the runtime
   * learns real limits from `x-ratelimit-*` response headers and prefers them.
   */
  rateLimit: RateLimitSchedulerConfig;
  /** Non-secret registered capability metadata. */
  capabilities: RealProviderCapabilities;
}

/** Founder-facing summary of a known proof provider (no network, no secrets). */
export interface KnownRealProvider {
  id: RealProviderId;
  /** Short founder-friendly label, e.g. "Groq Direct". */
  label: string;
  apiKeyEnv: string;
  /** True when that provider's key env var is present (value never read here beyond a presence check). */
  configured: boolean;
  /** True for the preferred provider (Groq Direct). */
  preferred: boolean;
  /** True when this is the currently selected provider. */
  active: boolean;
}

export interface RealProviderStatus {
  configuredKind: string;
  descriptor: RealProviderDescriptor | null;
  /** true when the descriptor exists AND its key is present in the environment. */
  ready: boolean;
  reason: string;
  /** Which provider is selected (or "disabled" / "unknown"). */
  active: RealProviderId | "disabled" | "unknown";
  /** Founder-friendly status of every known proof provider, for `ai-company doctor`. */
  known: KnownRealProvider[];
}

interface ProviderDefaults {
  id: RealProviderId;
  label: RealProviderDescriptor["label"];
  friendly: string;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  /** Non-secret vendor headers, if any. */
  headers: Record<string, string>;
  /** Extra non-secret request-body fields for vendor quirks (e.g. NVIDIA thinking off). */
  extraBody: Record<string, unknown>;
  /** OpenAI-compatible optional wire features this endpoint accepts. */
  features: { jsonSchema?: boolean; reasoningEffort?: boolean };
  nativeStructuredOutput: boolean;
  /** Safe fallback scheduler defaults (headers still win at runtime). */
  rateLimit: RateLimitSchedulerConfig;
  /** Registered non-secret capability metadata. */
  capabilities: RealProviderCapabilities;
}

/** Conservative shared scheduler defaults for a free-tier OpenAI-compatible provider. */
function freeTierRateLimitDefaults(minIntervalMs: number): RateLimitSchedulerConfig {
  return {
    maxRetryCycles: 3,
    maxWaitMsPerCycle: 90_000,
    jitterMs: 300,
    minIntervalMs,
    safetyMarginRequests: 1,
    fallback: {
      // Only used until the first `x-ratelimit-*` header is seen.
      windowMs: 60_000,
      requestsPerWindow: 30,
      tokensPerWindow: 6000,
    },
  };
}

function defaultsForKind(kind: string): ProviderDefaults | null {
  if (kind === "groq" || kind === "groq-direct") {
    return {
      id: "groq",
      label: "REAL / Groq Direct proof",
      friendly: "Groq Direct",
      baseUrl: DEFAULT_GROQ_BASE_URL,
      model: DEFAULT_GROQ_MODEL,
      apiKeyEnv: GROQ_API_KEY_ENV,
      headers: {},
      extraBody: {},
      // Groq gpt-oss supports native JSON-Schema structured output + reasoning_effort.
      features: { jsonSchema: true, reasoningEffort: true },
      nativeStructuredOutput: true,
      rateLimit: freeTierRateLimitDefaults(1_500),
      capabilities: {
        costTier: "FREE",
        contextWindow: 131_072,
        longContext: true,
        agentic: true,
        coding: true,
        reasoning: true,
      },
    };
  }
  if (kind === "nvidia" || kind === "nvidia-nim" || kind === "nim") {
    return {
      id: "nvidia",
      label: "REAL / NVIDIA NIM proof",
      friendly: "NVIDIA NIM",
      baseUrl: DEFAULT_NVIDIA_BASE_URL,
      model: DEFAULT_NVIDIA_MODEL,
      apiKeyEnv: NVIDIA_API_KEY_ENV,
      headers: {},
      // Nemotron on NIM streams chain-of-thought into message.content unless
      // thinking is turned off; with it off the model emits a clean JSON object.
      extraBody: { chat_template_kwargs: { thinking: false } },
      // NIM `response_format` enforcement for this model is unreliable (leaks
      // reasoning into content); use prompt-only + full runtime schema validation.
      features: {},
      nativeStructuredOutput: false,
      // NIM sends no x-ratelimit-* headers; keep sequential pacing generous and
      // the assumed free window wide. Bounded 429 cycles still apply.
      rateLimit: {
        maxRetryCycles: 3,
        maxWaitMsPerCycle: 90_000,
        jitterMs: 300,
        minIntervalMs: 1_200,
        safetyMarginRequests: 1,
        fallback: { windowMs: 60_000, requestsPerWindow: 40, tokensPerWindow: 60_000 },
      },
      capabilities: {
        costTier: "FREE",
        contextWindow: 1_000_000,
        longContext: true,
        agentic: true,
        coding: true,
        reasoning: true,
      },
    };
  }
  if (kind === "openrouter") {
    return {
      id: "openrouter",
      label: "REAL / OpenRouter proof",
      friendly: "OpenRouter",
      baseUrl: DEFAULT_OPENROUTER_BASE_URL,
      model: DEFAULT_OPENROUTER_MODEL,
      apiKeyEnv: OPENROUTER_API_KEY_ENV,
      headers: {
        "HTTP-Referer": "https://github.com/ai-software-company/runtime",
        "X-Title": "AI Software Company Runtime V1.1 proof",
      },
      extraBody: {},
      // The OpenRouter free router can land on any model; do not assume schema support.
      features: {},
      nativeStructuredOutput: false,
      rateLimit: freeTierRateLimitDefaults(2_000),
      capabilities: {
        costTier: "FREE",
        contextWindow: 32_768,
        longContext: false,
        agentic: true,
        coding: true,
        reasoning: true,
      },
    };
  }
  if (kind === "openai-compatible") {
    return {
      id: "openai-compatible",
      label: "REAL / OpenAI-compatible",
      friendly: "OpenAI-compatible",
      baseUrl: DEFAULT_GROQ_BASE_URL, // require an explicit AI_COMPANY_REAL_BASE_URL in practice
      model: DEFAULT_GROQ_MODEL,
      apiKeyEnv: "AI_COMPANY_REAL_API_KEY",
      headers: {},
      extraBody: {},
      features: {},
      nativeStructuredOutput: false,
      rateLimit: freeTierRateLimitDefaults(1_000),
      capabilities: {
        costTier: "FREE",
        contextWindow: 32_768,
        longContext: false,
        agentic: true,
        coding: true,
        reasoning: true,
      },
    };
  }
  return null;
}

function keyPresent(env: NodeJS.ProcessEnv, name: string): boolean {
  const v = env[name];
  return Boolean(v && v.trim());
}

/** Known proof providers and whether each one's key is present. Pure; no secrets leave. */
function knownRealProviders(env: NodeJS.ProcessEnv, activeId: RealProviderStatus["active"]): KnownRealProvider[] {
  return [
    {
      id: "groq",
      label: "Groq Direct",
      apiKeyEnv: GROQ_API_KEY_ENV,
      configured: keyPresent(env, GROQ_API_KEY_ENV),
      preferred: true,
      active: activeId === "groq",
    },
    {
      id: "nvidia",
      label: "NVIDIA NIM",
      apiKeyEnv: NVIDIA_API_KEY_ENV,
      configured: keyPresent(env, NVIDIA_API_KEY_ENV),
      preferred: false,
      active: activeId === "nvidia",
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      apiKeyEnv: OPENROUTER_API_KEY_ENV,
      configured: keyPresent(env, OPENROUTER_API_KEY_ENV),
      preferred: false,
      active: activeId === "openrouter",
    },
  ];
}

const PROVIDER_NAMES: Record<RealProviderId, string> = {
  groq: "groq-direct",
  nvidia: "nvidia-nim",
  openrouter: "openrouter-proof",
  "openai-compatible": "openai-compatible",
};

/** Vendor id implied by a base URL (for a correct label when the URL is overridden). */
function idFromBaseUrl(baseUrl: string, fallback: RealProviderId): RealProviderId {
  if (baseUrl.includes("groq.com")) return "groq";
  if (baseUrl.includes("nvidia.com")) return "nvidia";
  if (baseUrl.includes("openrouter.ai")) return "openrouter";
  return fallback;
}

interface DescriptorOverrides {
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/** Build one concrete proof-provider descriptor from a `ProviderDefaults` + overrides. */
export function makeRealProviderDescriptor(
  defaults: ProviderDefaults,
  overrides: DescriptorOverrides,
  env: NodeJS.ProcessEnv,
  fetchImpl?: typeof fetch,
): RealProviderDescriptor {
  const baseUrl = (overrides.baseUrl ?? defaults.baseUrl).trim();
  const model = (overrides.model ?? defaults.model).trim();
  const apiKeyEnv = (overrides.apiKeyEnv ?? defaults.apiKeyEnv).trim();
  const effectiveId = idFromBaseUrl(baseUrl, defaults.id);
  const effective = effectiveId === defaults.id ? defaults : defaultsForKind(effectiveId)!;

  const cfg: OpenAICompatibleConfig = {
    name: PROVIDER_NAMES[effectiveId],
    baseUrl,
    apiKeyEnv,
    model,
    timeoutMs: overrides.timeoutMs ?? 60_000,
    maxRetries: overrides.maxRetries ?? 2,
    // Proof provider: minimal-cost real execution proof, NOT an approved (or paid) production provider.
    isProofProvider: true,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    headers: effective.headers,
    extraBody: effective.extraBody,
    capabilities: effective.features,
    env,
    fetchImpl,
  };
  const provider = new OpenAICompatibleProvider(cfg);
  return {
    label: effective.label,
    id: effectiveId,
    provider,
    apiKeyEnv,
    baseUrl,
    model,
    isProofProvider: true,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    nativeStructuredOutput: effective.nativeStructuredOutput,
    rateLimit: effective.rateLimit,
    capabilities: effective.capabilities,
  };
}

export function buildRealProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): RealProviderStatus {
  const kind = (env.AI_COMPANY_REAL_PROVIDER ?? DEFAULT_REAL_PROVIDER_KIND).trim().toLowerCase();

  if (kind === "disabled" || kind === "off" || kind === "none") {
    return {
      configuredKind: kind,
      descriptor: null,
      ready: false,
      reason: "AI_COMPANY_REAL_PROVIDER is disabled; the runtime uses MockModelProvider only",
      active: "disabled",
      known: knownRealProviders(env, "disabled"),
    };
  }

  const defaults = defaultsForKind(kind);
  if (!defaults) {
    return {
      configuredKind: kind,
      descriptor: null,
      ready: false,
      reason: `unknown AI_COMPANY_REAL_PROVIDER '${kind}' (expected groq | nvidia | openrouter | openai-compatible | disabled)`,
      active: "unknown",
      known: knownRealProviders(env, "unknown"),
    };
  }

  const descriptor = makeRealProviderDescriptor(
    defaults,
    {
      baseUrl: env.AI_COMPANY_REAL_BASE_URL,
      model: env.AI_COMPANY_REAL_MODEL,
      apiKeyEnv: env.AI_COMPANY_REAL_API_KEY_ENV,
      timeoutMs: intOr(env.AI_COMPANY_REAL_TIMEOUT_MS, 60_000),
      maxRetries: intOr(env.AI_COMPANY_REAL_MAX_RETRIES, 2),
    },
    env,
    fetchImpl,
  );

  return {
    configuredKind: kind,
    descriptor,
    ready: descriptor.provider.isReady(),
    reason: descriptor.provider.isReady()
      ? `${descriptor.label} ready (${descriptor.baseUrl}, model ${descriptor.model})`
      : `${descriptor.apiKeyEnv} is not set; real-agent proof is BLOCKED_PROVIDER_UNAVAILABLE`,
    active: descriptor.id,
    known: knownRealProviders(env, descriptor.id),
  };
}

/**
 * V1.1 real-proof FREE-FIRST provider chain (build spec: free-provider fallback).
 *
 *   primary   = the configured provider (default Groq Direct)
 *   fallbacks = [NVIDIA NIM] when NVIDIA_API_KEY is present and NVIDIA is not the
 *               primary, unless AI_COMPANY_REAL_FALLBACK=none.
 *
 * OpenRouter is NEVER auto-added here. Fallback engages ONLY when the primary
 * reaches a bounded RATE_LIMIT_EXHAUSTED - never for a normal 429, a provider
 * error, or a model-response failure. No paid provider is ever in the chain.
 */
export interface ProofProviderChain {
  primary: RealProviderStatus;
  fallbacks: RealProviderDescriptor[];
  /** Founder-readable one-liner (no secrets). */
  reason: string;
}

export function resolveProofProviderChain(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): ProofProviderChain {
  const primary = buildRealProvider(env, fetchImpl);
  const fallbackSetting = (env.AI_COMPANY_REAL_FALLBACK ?? "nvidia").trim().toLowerCase();
  const fallbacks: RealProviderDescriptor[] = [];

  const wantNvidia =
    (fallbackSetting === "nvidia" || fallbackSetting === "nvidia-nim" || fallbackSetting === "auto") &&
    primary.active !== "nvidia" &&
    keyPresent(env, NVIDIA_API_KEY_ENV);

  if (wantNvidia) {
    fallbacks.push(
      makeRealProviderDescriptor(
        defaultsForKind("nvidia")!,
        {
          timeoutMs: intOr(env.AI_COMPANY_REAL_TIMEOUT_MS, 90_000),
          maxRetries: intOr(env.AI_COMPANY_REAL_MAX_RETRIES, 2),
        },
        env,
        fetchImpl,
      ),
    );
  }

  const reason =
    fallbackSetting === "none"
      ? "free-first fallback disabled (AI_COMPANY_REAL_FALLBACK=none)"
      : fallbacks.length > 0
        ? `free-first: ${primary.active} -> ${fallbacks.map((f) => f.id).join(" -> ")} on RATE_LIMIT_EXHAUSTED`
        : primary.active === "nvidia"
          ? "NVIDIA is primary; no further free fallback configured"
          : `no free fallback available (${NVIDIA_API_KEY_ENV} not set)`;

  return { primary, fallbacks, reason };
}

function intOr(v: string | undefined, dflt: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

// ---------------------------------------------------------------------------
// PREMIUM implementation provider (build spec: model-tier escalation policy).
//
// A PAID provider, used for the `implementation` stage ONLY, and ONLY when the
// Human Founder has explicitly authorized it for this run via
// AI_COMPANY_PREMIUM_IMPL_PROVIDER=openai (plus OPENAI_API_KEY). It is NEVER in
// the free proof chain, NEVER auto-selected, and NEVER used for a stage that has
// already completed on a free model. The credential is read only by name here;
// the provider reads the key itself at call time and never logs/persists it.
//
// Recognised environment variables:
//   AI_COMPANY_PREMIUM_IMPL_PROVIDER   openai            (the explicit authorization; unset = disabled)
//   AI_COMPANY_PREMIUM_IMPL_MODEL      openai model id   (default: the priority list below)
//   AI_COMPANY_PREMIUM_IMPL_BASE_URL   default https://api.openai.com/v1
//   AI_COMPANY_PREMIUM_IMPL_API_KEY_ENV  name of the key var (default OPENAI_API_KEY)
//   OPENAI_API_KEY                     the key (env only)
// ---------------------------------------------------------------------------

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const OPENAI_API_KEY_ENV = "OPENAI_API_KEY";

/**
 * Preferred OpenAI models for repository implementation work, strongest first.
 * Restricted to models that speak the classic `chat/completions` API the shared
 * OpenAICompatibleProvider uses - the `*-codex` / `*-pro` variants are
 * `/v1/responses`-only and would need a separate transport, which the build
 * spec says to avoid. `resolvePremiumImplProvider` uses the first of these (or
 * the explicit AI_COMPANY_PREMIUM_IMPL_MODEL) and records which was selected.
 */
export const PREMIUM_IMPL_MODEL_PRIORITY = [
  "gpt-5.1",
  "gpt-5",
  "gpt-4.1",
] as const;
export const DEFAULT_PREMIUM_IMPL_MODEL = PREMIUM_IMPL_MODEL_PRIORITY[0];

export interface PremiumImplProviderStatus {
  /** True only when AI_COMPANY_PREMIUM_IMPL_PROVIDER names a supported premium provider. */
  authorized: boolean;
  /**
   * For `openai`: true when the key is present. For `codex-cli`: the STATIC
   * preconditions only - the live `codex login status` check is done by the
   * caller (`CodexCliHarness.detect()`), so a `codex-cli` status is `ready:true`
   * once authorized and the harness runs its own readiness gate.
   */
  ready: boolean;
  /** Which premium path this run authorized. */
  kind: "openai" | "codex-cli" | null;
  reason: string;
  /** Present only for `kind === "openai"` (the paid HTTP API path). */
  descriptor: {
    label: "PREMIUM / OpenAI implementation";
    id: "openai";
    provider: OpenAICompatibleProvider;
    apiKeyEnv: string;
    baseUrl: string;
    model: string;
    costTier: "PREMIUM";
    /** How the model id was chosen (for the audit / founder report). */
    modelSource: "AI_COMPANY_PREMIUM_IMPL_MODEL" | "default-priority-list";
    sensitivity: ProviderSensitivity;
  } | null;
  /** Present only for `kind === "codex-cli"` (the local ChatGPT-login harness path). */
  codex: {
    id: "codex-cli";
    label: "PREMIUM / Codex CLI (ChatGPT)";
    /** Optional model override for `codex exec -m`; empty = account default. */
    model: string;
    timeoutMs: number;
  } | null;
}

export function resolvePremiumImplProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): PremiumImplProviderStatus {
  const kind = (env.AI_COMPANY_PREMIUM_IMPL_PROVIDER ?? "").trim().toLowerCase();
  if (!kind || kind === "disabled" || kind === "none" || kind === "off") {
    return {
      authorized: false,
      ready: false,
      kind: null,
      reason:
        "premium implementation escalation is not authorized for this run " +
        "(set AI_COMPANY_PREMIUM_IMPL_PROVIDER=codex-cli, or =openai + OPENAI_API_KEY)",
      descriptor: null,
      codex: null,
    };
  }
  if (kind === "codex-cli" || kind === "codex" || kind === "chatgpt") {
    const timeoutMs = intOr(env.AI_COMPANY_PREMIUM_IMPL_TIMEOUT_MS, 15 * 60_000);
    return {
      authorized: true,
      ready: true,
      kind: "codex-cli",
      reason:
        "PREMIUM / Codex CLI (ChatGPT) authorized for the implementation stage; " +
        "live readiness is checked with 'codex login status' at run time",
      descriptor: null,
      codex: {
        id: "codex-cli",
        label: "PREMIUM / Codex CLI (ChatGPT)",
        model: (env.AI_COMPANY_PREMIUM_IMPL_MODEL ?? "").trim(),
        timeoutMs,
      },
    };
  }
  if (kind !== "openai") {
    return {
      authorized: false,
      ready: false,
      kind: null,
      reason: `unknown AI_COMPANY_PREMIUM_IMPL_PROVIDER '${kind}' (supported: codex-cli | openai)`,
      descriptor: null,
      codex: null,
    };
  }

  const apiKeyEnv = (env.AI_COMPANY_PREMIUM_IMPL_API_KEY_ENV ?? OPENAI_API_KEY_ENV).trim();
  const baseUrl = (env.AI_COMPANY_PREMIUM_IMPL_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).trim();
  const explicitModel = (env.AI_COMPANY_PREMIUM_IMPL_MODEL ?? "").trim();
  const model = explicitModel || DEFAULT_PREMIUM_IMPL_MODEL;
  const modelSource: "AI_COMPANY_PREMIUM_IMPL_MODEL" | "default-priority-list" = explicitModel
    ? "AI_COMPANY_PREMIUM_IMPL_MODEL"
    : "default-priority-list";

  const cfg: OpenAICompatibleConfig = {
    name: "openai-premium-impl",
    baseUrl,
    apiKeyEnv,
    model,
    // Bounded per the Founder's authorization: no burst retry inside the provider;
    // the runner owns the "one primary + one repair" budget.
    timeoutMs: intOr(env.AI_COMPANY_PREMIUM_IMPL_TIMEOUT_MS, 120_000),
    maxRetries: 0,
    isProofProvider: false,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    // OpenAI's newer models require max_completion_tokens and reject temperature:0.
    tokenParam: "max_completion_tokens",
    omitTemperature: true,
    omitSeed: true,
    // Structured Outputs (strict JSON Schema) is fully supported on gpt-4.1 / gpt-5.
    capabilities: { jsonSchema: true, reasoningEffort: false },
    env,
    fetchImpl,
  };
  const provider = new OpenAICompatibleProvider(cfg);
  const ready = provider.isReady();
  return {
    authorized: true,
    ready,
    kind: "openai",
    reason: ready
      ? `PREMIUM / OpenAI implementation authorized and ready (model ${model}, ${baseUrl})`
      : `${apiKeyEnv} is not set; premium implementation escalation is BLOCKED_PREMIUM_PROVIDER_UNAVAILABLE`,
    descriptor: {
      label: "PREMIUM / OpenAI implementation",
      id: "openai",
      provider,
      apiKeyEnv,
      baseUrl,
      model,
      costTier: "PREMIUM",
      modelSource,
      sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    },
    codex: null,
  };
}
