import type { ModelTier } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";
import { RuntimeError } from "../core/errors.ts";
import type {
  GenerateRequest,
  GenerateResult,
  ModelProvider,
  ProviderHealth,
  Usage,
} from "./provider.ts";

/**
 * Generic, production-minded OpenAI-compatible chat-completions provider
 * (build spec sections 4, 5, 27, 29). It is NOT hard-coded to any single vendor:
 * base URL, the name of the environment variable that holds the API key, the
 * model id, timeout, retry policy and extra headers are all configuration.
 * OpenRouter is merely the first proof configuration.
 *
 * Secret handling (build spec section 4): the API key is read from the named
 * environment variable at call time and held only in a local variable for the
 * duration of the fetch. It is never stored on the instance, never logged, never
 * placed in an audit event, a prompt, a telemetry attribute or an error message.
 */

export type ProviderSensitivity = "NON_SENSITIVE_PROOF_ONLY" | "GENERAL";

export interface OpenAICompatibleConfig {
  /** Stable provider name used in audit/cost records (never a secret). */
  name: string;
  /** e.g. https://openrouter.ai/api/v1 */
  baseUrl: string;
  /** Name of the env var holding the API key, e.g. OPENROUTER_API_KEY. */
  apiKeyEnv: string;
  /** Concrete model id used for every tier unless tierModelMap overrides it. */
  model: string;
  /** Optional per-tier model override. */
  tierModelMap?: Partial<Record<ModelTier, string>>;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Max additional attempts on 429 / 5xx / network error (total tries = 1 + this). */
  maxRetries?: number;
  /** Base backoff between retries, milliseconds (exponential, jittered off). */
  retryBackoffMs?: number;
  /** Extra non-secret headers (e.g. OpenRouter's HTTP-Referer / X-Title). */
  headers?: Record<string, string>;
  /** Marks this as a disposable proof provider, not an approved production provider. */
  isProofProvider?: boolean;
  /** Data-handling classification enforced by the proof runner. */
  sensitivity?: ProviderSensitivity;
  /** Injected fetch for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected env for tests; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

interface CompletionBody {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  /** Some gateways (OpenRouter) report cost in the usage object or top level. */
  cost?: number;
  error?: { message?: string; code?: string | number };
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: string;
  readonly isProofProvider: boolean;
  readonly sensitivity: ProviderSensitivity;
  readonly baseUrl: string;
  readonly apiKeyEnv: string;

  private readonly model: string;
  private readonly tierModelMap: Partial<Record<ModelTier, string>>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly env: NodeJS.ProcessEnv;

  private inTokens = 0;
  private outTokens = 0;
  private requests = 0;
  private lastRealModel: string | null = null;

  constructor(cfg: OpenAICompatibleConfig) {
    this.name = cfg.name;
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiKeyEnv = cfg.apiKeyEnv;
    this.model = cfg.model;
    this.tierModelMap = cfg.tierModelMap ?? {};
    this.timeoutMs = cfg.timeoutMs ?? 60_000;
    this.maxRetries = Math.max(0, cfg.maxRetries ?? 2);
    this.retryBackoffMs = cfg.retryBackoffMs ?? 500;
    this.headers = { ...(cfg.headers ?? {}) };
    this.isProofProvider = cfg.isProofProvider ?? false;
    this.sensitivity = cfg.sensitivity ?? "GENERAL";
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.env = cfg.env ?? process.env;
  }

  /** The key, read fresh every time. Never cached on the instance. */
  private apiKey(): string | undefined {
    const v = this.env[this.apiKeyEnv];
    return v && v.trim() ? v.trim() : undefined;
  }

  isReady(): boolean {
    return Boolean(this.apiKey());
  }

  health(): ProviderHealth {
    if (!this.isReady()) {
      return {
        provider: this.name,
        status: "NOT_CONFIGURED",
        detail: `set ${this.apiKeyEnv} in the environment to enable ${this.name} (${this.baseUrl})`,
        tiers: [],
      };
    }
    return {
      provider: this.name,
      status: "OK",
      detail:
        `${this.baseUrl} model=${this.model}` +
        (this.isProofProvider ? " [PROOF_PROVIDER]" : "") +
        (this.sensitivity === "NON_SENSITIVE_PROOF_ONLY" ? " [NON_SENSITIVE_PROOF_ONLY]" : ""),
      // A single concrete model serves every non-deterministic tier.
      tiers: MODEL_TIERS.filter((t) => t !== "NO_AI"),
    };
  }

  modelForTier(tier: ModelTier): string {
    return this.tierModelMap[tier] ?? this.model;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = this.apiKey();
    if (!key) {
      throw new RuntimeError(
        "PROVIDER_NOT_CONFIGURED",
        `${this.name} is not configured (${this.apiKeyEnv} is unset)`,
      );
    }
    if (req.tier === "NO_AI") {
      throw new RuntimeError(
        "NO_AI_TIER",
        "NO_AI must be handled by ordinary code, not a model provider",
      );
    }

    const model = this.modelForTier(req.tier);
    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      model,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        {
          role: "user",
          content: req.context ? `${req.context}\n\n---\n\n${req.prompt}` : req.prompt,
        },
      ],
      max_tokens: req.maxOutputTokens ?? 1500,
      temperature: 0,
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    };

    const started = Date.now();
    let lastErr = "";
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(this.retryBackoffMs * 2 ** (attempt - 1));
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
            ...this.headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        this.requests++;

        if (res.status === 429 || res.status >= 500) {
          lastErr = `HTTP ${res.status}`;
          if (attempt < this.maxRetries) continue;
          throw new RuntimeError(
            res.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_5XX",
            `${this.name} responded ${res.status} after ${attempt + 1} attempt(s)`,
          );
        }
        if (!res.ok) {
          throw new RuntimeError(
            "PROVIDER_HTTP",
            `${this.name} responded ${res.status} (${res.statusText})`,
          );
        }

        const body = (await res.json()) as CompletionBody;
        if (body.error) {
          throw new RuntimeError(
            "PROVIDER_API_ERROR",
            `${this.name} API error: ${body.error.message ?? "unknown"}`,
          );
        }
        const text = body.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) {
          lastErr = "empty completion";
          if (attempt < this.maxRetries) continue;
          throw new RuntimeError("PROVIDER_EMPTY", `${this.name} returned an empty completion`);
        }

        const input_tokens = body.usage?.prompt_tokens ?? null;
        const output_tokens = body.usage?.completion_tokens ?? null;
        if (typeof input_tokens === "number") this.inTokens += input_tokens;
        if (typeof output_tokens === "number") this.outTokens += output_tokens;
        this.lastRealModel = body.model ?? model;

        return {
          provider: this.name,
          model: body.model ?? model,
          tier: req.tier,
          text,
          usage: { input_tokens, output_tokens },
          estimated_cost_usd: typeof body.cost === "number" ? body.cost : null,
          duration_ms: Date.now() - started,
        };
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof RuntimeError && err.code.startsWith("PROVIDER_") &&
            err.code !== "PROVIDER_RATE_LIMITED" && err.code !== "PROVIDER_5XX") {
          throw err;
        }
        const isAbort = (err as { name?: string }).name === "AbortError";
        lastErr = isAbort ? `timeout after ${this.timeoutMs}ms` : String(err);
        if (attempt < this.maxRetries && !(err instanceof RuntimeError && !isRetryable(err))) {
          continue;
        }
        if (isAbort) {
          throw new RuntimeError("PROVIDER_TIMEOUT", `${this.name}: ${lastErr}`);
        }
        if (err instanceof RuntimeError) throw err;
        throw new RuntimeError("PROVIDER_NETWORK", `${this.name}: ${lastErr}`);
      }
    }
    throw new RuntimeError("PROVIDER_EXHAUSTED", `${this.name}: ${lastErr || "all attempts failed"}`);
  }

  usage(): Usage {
    return { input_tokens: this.inTokens, output_tokens: this.outTokens };
  }

  requestCount(): number {
    return this.requests;
  }

  actualModel(): string | null {
    return this.lastRealModel;
  }
}

function isRetryable(err: RuntimeError): boolean {
  return err.code === "PROVIDER_RATE_LIMITED" || err.code === "PROVIDER_5XX";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
