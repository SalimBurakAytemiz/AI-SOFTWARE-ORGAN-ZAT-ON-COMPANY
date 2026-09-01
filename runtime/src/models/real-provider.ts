import {
  OpenAICompatibleProvider,
  type OpenAICompatibleConfig,
  type ProviderSensitivity,
} from "./openai-compatible-provider.ts";

/**
 * Real model provider configuration (build spec sections 4, 5, 30). The runtime
 * stays provider-independent: this builds a generic OpenAI-compatible provider
 * from environment configuration. OpenRouter free inference is the FIRST proof
 * configuration and the default when nothing is set - but it is a PROOF_PROVIDER,
 * not an approved permanent production provider.
 *
 * No credential is ever read here except the *name* of the env var. The provider
 * reads the key itself, at call time.
 *
 * Recognised environment variables:
 *   AI_COMPANY_REAL_PROVIDER   openai-compatible | openrouter | disabled  (default: openrouter)
 *   AI_COMPANY_REAL_BASE_URL   default https://openrouter.ai/api/v1
 *   AI_COMPANY_REAL_MODEL      default a free OpenRouter model
 *   AI_COMPANY_REAL_API_KEY_ENV   name of the var holding the key (default OPENROUTER_API_KEY)
 *   AI_COMPANY_REAL_TIMEOUT_MS    default 60000
 *   AI_COMPANY_REAL_MAX_RETRIES   default 2
 *   OPENROUTER_API_KEY / <the named var>   the actual key (never committed)
 */

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
export const DEFAULT_API_KEY_ENV = "OPENROUTER_API_KEY";

export interface RealProviderDescriptor {
  /** How the runtime should present this run (build spec section 28). */
  label: "REAL / OpenAI-compatible" | "REAL / OpenRouter proof";
  provider: OpenAICompatibleProvider;
  apiKeyEnv: string;
  baseUrl: string;
  model: string;
  isProofProvider: boolean;
  sensitivity: ProviderSensitivity;
}

export interface RealProviderStatus {
  configuredKind: string;
  descriptor: RealProviderDescriptor | null;
  /** true when the descriptor exists AND its key is present in the environment. */
  ready: boolean;
  reason: string;
}

export function buildRealProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): RealProviderStatus {
  const kind = (env.AI_COMPANY_REAL_PROVIDER ?? "openrouter").trim().toLowerCase();

  if (kind === "disabled" || kind === "off" || kind === "none") {
    return {
      configuredKind: kind,
      descriptor: null,
      ready: false,
      reason: "AI_COMPANY_REAL_PROVIDER is disabled; the runtime uses MockModelProvider only",
    };
  }

  const isOpenRouterDefault = kind === "openrouter" || kind === "openai-compatible";
  if (!isOpenRouterDefault) {
    return {
      configuredKind: kind,
      descriptor: null,
      ready: false,
      reason: `unknown AI_COMPANY_REAL_PROVIDER '${kind}' (expected openrouter | openai-compatible | disabled)`,
    };
  }

  const baseUrl = (env.AI_COMPANY_REAL_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL).trim();
  const model = (env.AI_COMPANY_REAL_MODEL ?? DEFAULT_OPENROUTER_MODEL).trim();
  const apiKeyEnv = (env.AI_COMPANY_REAL_API_KEY_ENV ?? DEFAULT_API_KEY_ENV).trim();
  const timeoutMs = intOr(env.AI_COMPANY_REAL_TIMEOUT_MS, 60_000);
  const maxRetries = intOr(env.AI_COMPANY_REAL_MAX_RETRIES, 2);

  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const cfg: OpenAICompatibleConfig = {
    name: isOpenRouter ? "openrouter-proof" : "openai-compatible",
    baseUrl,
    apiKeyEnv,
    model,
    timeoutMs,
    maxRetries,
    // Proof provider: minimal-cost real execution proof, NOT an approved production provider.
    isProofProvider: true,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
    headers: isOpenRouter
      ? {
          "HTTP-Referer": "https://github.com/ai-software-company/runtime",
          "X-Title": "AI Software Company Runtime V1.1 proof",
        }
      : {},
    env,
    fetchImpl,
  };

  const provider = new OpenAICompatibleProvider(cfg);
  const descriptor: RealProviderDescriptor = {
    label: isOpenRouter ? "REAL / OpenRouter proof" : "REAL / OpenAI-compatible",
    provider,
    apiKeyEnv,
    baseUrl,
    model,
    isProofProvider: true,
    sensitivity: "NON_SENSITIVE_PROOF_ONLY",
  };

  return {
    configuredKind: kind,
    descriptor,
    ready: provider.isReady(),
    reason: provider.isReady()
      ? `${descriptor.label} ready (${baseUrl}, model ${model})`
      : `${apiKeyEnv} is not set; real-agent proof is BLOCKED_PROVIDER_UNAVAILABLE`,
  };
}

function intOr(v: string | undefined, dflt: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}
