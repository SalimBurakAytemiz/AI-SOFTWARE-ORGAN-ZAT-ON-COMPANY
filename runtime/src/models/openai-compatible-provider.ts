import type { ModelTier } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";
import { RuntimeError, RateLimitError, ProviderQuotaExhaustedError } from "../core/errors.ts";
import { redactString } from "../core/redaction.ts";
import { parseRateLimitHeaders, type RateLimitSnapshot } from "./rate-limit.ts";
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
  /**
   * Optional-feature support for this concrete endpoint. `jsonSchema` sends
   * `response_format: json_schema` (Groq gpt-oss); `reasoningEffort` sends
   * `reasoning_effort`. Off by default so an unknown gateway is never sent a
   * field it might reject.
   */
  capabilities?: { jsonSchema?: boolean; reasoningEffort?: boolean };
  /**
   * Which field carries the output-token cap. OpenAI's newer models
   * (`gpt-5*`, `o*`) reject the legacy `max_tokens` and require
   * `max_completion_tokens`. Default `max_tokens` (broadest compatibility).
   */
  tokenParam?: "max_tokens" | "max_completion_tokens";
  /**
   * Omit `temperature` from the request. OpenAI's reasoning models only accept
   * the default temperature and 400 on an explicit `temperature: 0`. Default
   * false (send `temperature: 0` for determinism).
   */
  omitTemperature?: boolean;
  /** Omit `seed` even when the caller supplies one (some endpoints reject it). */
  omitSeed?: boolean;
  /**
   * Extra NON-SECRET top-level fields merged into every `chat/completions`
   * request body. This is the generic hook for a vendor quirk that the plain
   * OpenAI schema does not cover - e.g. NVIDIA NIM Nemotron needs
   * `{ chat_template_kwargs: { thinking: false } }` to stop it streaming
   * chain-of-thought into `message.content`. Config-time only; never a place
   * for a credential. Explicit `response_format` / `reasoning_effort` handling
   * still takes precedence over anything here.
   */
  extraBody?: Record<string, unknown>;
  /** Injected fetch for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected env for tests; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

interface CompletionBody {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
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
  private readonly caps: { jsonSchema: boolean; reasoningEffort: boolean };
  private readonly extraBody: Record<string, unknown>;
  private readonly tokenParam: "max_tokens" | "max_completion_tokens";
  private readonly omitTemperature: boolean;
  private readonly omitSeed: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly env: NodeJS.ProcessEnv;

  private inTokens = 0;
  private outTokens = 0;
  private requests = 0;
  private lastRealModel: string | null = null;
  private lastRateLimit: RateLimitSnapshot | null = null;
  /**
   * Set once if the endpoint rejects `response_format: json_schema` with HTTP 400 -
   * then we stop sending the schema. We do NOT drop structured output entirely:
   * `schemaFallbackMode` switches to `json_object` so the API still forces valid
   * JSON, and `parseModelResult` still validates it against the full contract.
   */
  private jsonSchemaDisabled = false;
  private schemaFallbackMode: "none" | "json_object" = "none";
  /**
   * Set once when even `response_format: json_object` returns HTTP 400
   * "failed to generate JSON" - almost always because the model truncated the
   * object at the token cap and the API rejects the partial JSON rather than
   * returning a `finish_reason: "length"` 200. Dropping to prompt-only lets the
   * partial completion come back as a normal 200 so the caller's bounded
   * truncation retry can raise the budget. `parseModelResult` still validates
   * every response - this is never a way to bypass the contract.
   */
  private forcePromptOnly = false;

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
    this.extraBody = { ...(cfg.extraBody ?? {}) };
    this.caps = {
      jsonSchema: cfg.capabilities?.jsonSchema ?? false,
      reasoningEffort: cfg.capabilities?.reasoningEffort ?? false,
    };
    this.tokenParam = cfg.tokenParam ?? "max_tokens";
    this.omitTemperature = cfg.omitTemperature ?? false;
    this.omitSeed = cfg.omitSeed ?? false;
    this.isProofProvider = cfg.isProofProvider ?? false;
    this.sensitivity = cfg.sensitivity ?? "GENERAL";
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.env = cfg.env ?? process.env;
  }

  /** The most recent rate-limit snapshot parsed from a response (credential-free), or null. */
  rateLimit(): RateLimitSnapshot | null {
    return this.lastRateLimit;
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

  /**
   * A bounded LIVE reachability + auth check against the OpenAI-compatible
   * `GET /models` endpoint (build spec section 31). It spends no completion
   * tokens. Used only by `ai-company doctor --probe` and the diagnostic script -
   * never on the hot path. The API key is sent as a bearer token for this one
   * request and is never logged; any error string is secret-redacted.
   */
  async probe(): Promise<ProviderHealth> {
    const key = this.apiKey();
    if (!key) {
      return {
        provider: this.name,
        status: "NOT_CONFIGURED",
        detail: `${this.apiKeyEnv} is not set`,
        tiers: [],
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 10_000));
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { authorization: `Bearer ${key}`, ...this.headers },
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.lastRateLimit = parseRateLimitHeaders(res.headers, res.status, Date.now());
      if (res.status === 429) {
        return { provider: this.name, status: "RATE_LIMITED", detail: `${this.baseUrl}: HTTP 429 (rate limited)`, tiers: [] };
      }
      if (res.ok) {
        return {
          provider: this.name,
          status: "OK",
          detail: `${this.baseUrl} reachable and authenticated; model=${this.model}`,
          tiers: MODEL_TIERS.filter((t) => t !== "NO_AI"),
        };
      }
      if (res.status === 401 || res.status === 403) {
        return { provider: this.name, status: "ERROR", detail: `${this.baseUrl}: credential rejected (HTTP ${res.status})`, tiers: [] };
      }
      return { provider: this.name, status: "ERROR", detail: `${this.baseUrl}: HTTP ${res.status}`, tiers: [] };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = (err as { name?: string }).name === "AbortError";
      return {
        provider: this.name,
        status: "ERROR",
        detail: isAbort
          ? `${this.baseUrl}: timed out after ${Math.min(this.timeoutMs, 10_000)}ms`
          : redactString(`${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`),
        tiers: [],
      };
    }
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
    const maxOutputTokens = req.maxOutputTokens ?? 1500;
    /**
     * The cap actually sent. Raised (bounded) only when a structured request
     * 400s with "failed to generate JSON" - a strong signal the model ran out
     * of room before the object closed. Never exceeds 2x the request or 8000.
     */
    let effectiveMaxTokens = maxOutputTokens;
    const MAX_EFFECTIVE_TOKENS = Math.min(8000, maxOutputTokens * 2);

    const wantsStructured = Boolean(req.responseSchema);
    const useSchema = this.caps.jsonSchema && !this.jsonSchemaDisabled && wantsStructured;

    /** Which `response_format` this instance should send right now. */
    const currentMode = (): "json_schema" | "json_object" | "none" => {
      if (!wantsStructured || this.forcePromptOnly) return "none";
      if (this.caps.jsonSchema && !this.jsonSchemaDisabled) return "json_schema";
      if (this.schemaFallbackMode === "json_object") return "json_object";
      return "none";
    };
    const responseFormatFor = (mode: "json_schema" | "json_object" | "none"): Record<string, unknown> => {
      if (mode === "json_schema" && req.responseSchema) {
        return {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: req.responseSchema.name,
              strict: req.responseSchema.strict !== false,
              schema: req.responseSchema.schema,
            },
          },
        };
      }
      if (mode === "json_object") return { response_format: { type: "json_object" } };
      return {};
    };
    const buildPayload = (): Record<string, unknown> => ({
      // Vendor-quirk fields first so the standard fields below always win.
      ...this.extraBody,
      model,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        {
          role: "user",
          content: req.context ? `${req.context}\n\n---\n\n${req.prompt}` : req.prompt,
        },
      ],
      [this.tokenParam]: effectiveMaxTokens,
      ...(this.omitTemperature ? {} : { temperature: 0 }),
      ...(req.seed !== undefined && !this.omitSeed ? { seed: req.seed } : {}),
      ...(this.caps.reasoningEffort && req.reasoningEffort
        ? { reasoning_effort: req.reasoningEffort }
        : {}),
      ...responseFormatFor(currentMode()),
    });

    const started = Date.now();
    let lastErr = "";
    let schemaFallbackTried = false;
    /** True only on the attempt that first fell back from json_schema to json_object. */
    let schemaRejectedThisCall = false;
    let schemaRejectionReason: "schema_unsupported" | "json_validate_failed" | null = null;
    // A structured-output mode degrade (json_schema -> json_object -> prompt-only)
    // does not consume a normal retry - it earns one extra loop iteration.
    let modeDegrades = 0;
    for (let attempt = 0; attempt <= this.maxRetries + modeDegrades; attempt++) {
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
          body: JSON.stringify(buildPayload()),
          signal: controller.signal,
        });
        clearTimeout(timer);
        this.requests++;
        this.lastRateLimit = parseRateLimitHeaders(res.headers, res.status, Date.now());

        // 429 (or 402) -> could be a real rate limit OR a billing/quota
        // exhaustion. Peek at the body: a billing exhaustion never clears by
        // waiting, so it must NOT go to the rate-limit scheduler - it is a
        // non-retryable BLOCK. The API key is only ever a local const here; it
        // is not in the request or response body, and the message is redacted.
        if (res.status === 429 || res.status === 402) {
          const rawBody = await res.text().catch(() => "");
          const bodyText = rawBody.slice(0, 2000);
          if (
            /insufficient_quota|credit_balance_exhausted|no credits remaining|exceeded your current quota|billing (?:hard limit|not active)|payment required|add (?:funds|credits|a payment method)/i.test(
              bodyText,
            )
          ) {
            throw new ProviderQuotaExhaustedError(
              `${this.name}: provider account quota/billing exhausted (HTTP ${res.status}); ` +
                `this is not a rate limit and will not clear by waiting` +
                (redactString(bodyText).replace(/\s+/g, " ").trim()
                  ? `: ${redactString(bodyText).replace(/\s+/g, " ").trim().slice(0, 300)}`
                  : ""),
            );
          }
          throw new RateLimitError(`${this.name} responded ${res.status} (rate limited)`, this.lastRateLimit);
        }
        if (res.status >= 500) {
          lastErr = `HTTP ${res.status}`;
          if (attempt < this.maxRetries) continue;
          throw new RuntimeError("PROVIDER_5XX", `${this.name} responded ${res.status} after ${attempt + 1} attempt(s)`);
        }
        if (!res.ok) {
          // Read the error body ONCE (bounded + secret-redacted) so a 400 is
          // never opaque and can be classified. The API key is only ever a local
          // `const` in this method - it is not in the request/response body.
          const rawBody = await res.text().catch(() => "");
          const bodyText = rawBody.slice(0, 2000);
          const redactedBody = redactString(bodyText).replace(/\s+/g, " ").trim().slice(0, 600);

          // Some providers (Groq) signal "this single request is bigger than the
          // remaining per-minute token/request budget" with HTTP 400/413 and a
          // `rate_limit_exceeded` / "tokens per minute (TPM)" / "try again in Ns"
          // body, NOT a 429. Treat it as a rate limit so the scheduler waits for
          // the reset window and retries the SAME call, rather than hard-failing.
          if (
            (res.status === 400 || res.status === 413) &&
            /rate[_ ]?limit|tokens?\s*per\s*minute|\bTPM\b|requests?\s*per\s*(minute|day)|\bRPM\b|\bRPD\b|try again in\s|too large for/i.test(
              bodyText,
            )
          ) {
            throw new RateLimitError(
              `${this.name} responded ${res.status} (rate limit: request exceeds the remaining quota window)`,
              this.lastRateLimit,
            );
          }

          // Safe structured-output self-heal. A `response_format: json_schema`
          // request can 400 for two related reasons:
          //   1. the endpoint does not accept the schema at all
          //      ("response_format ... not supported", schema-shape errors), or
          //   2. the model could not complete a schema-valid generation within
          //      the token budget - Groq returns HTTP 400 `json_validate_failed`
          //      ("Failed to generate JSON") rather than a truncated 200.
          // Both are retried ONCE with `response_format: { type: "json_object" }`
          // (still API-forced JSON, never prompt-only). The schema is not sent
          // again for the life of this instance; if the json_object response is
          // itself truncated it comes back as a normal 200 with
          // finish_reason=length so the caller's bounded truncation retry can
          // raise the budget. The response is ALWAYS parsed and validated
          // against the full AgentExecutionResult contract - this is resilience,
          // never a way to bypass validation.
          const generateFailed = /json_validate_failed|failed to generate json/i.test(bodyText);
          if (res.status === 400 && useSchema && !this.jsonSchemaDisabled && !schemaFallbackTried) {
            const schemaRejected = /response_format|json[_-]?schema|\bschema\b/i.test(bodyText);
            if (generateFailed || schemaRejected) {
              this.jsonSchemaDisabled = true;
              this.schemaFallbackMode = "json_object";
              schemaFallbackTried = true;
              schemaRejectedThisCall = true;
              schemaRejectionReason = generateFailed ? "json_validate_failed" : "schema_unsupported";
              // `json_validate_failed` almost always means the strict object was
              // truncated at the cap - give the retry more room, bounded.
              if (generateFailed && effectiveMaxTokens < MAX_EFFECTIVE_TOKENS) {
                effectiveMaxTokens = Math.min(MAX_EFFECTIVE_TOKENS, Math.ceil(effectiveMaxTokens * 1.5));
              }
              modeDegrades++;
              lastErr =
                `provider 400 on response_format json_schema (${schemaRejectionReason}); retrying with json_object` +
                (generateFailed ? ` at max_tokens=${effectiveMaxTokens}` : "");
              continue;
            }
          }
          // json_object ALSO failed to generate valid JSON (still truncating).
          // Drop to prompt-only so the partial completion returns as a normal
          // 200 the caller's truncation retry can grow; still fully validated.
          if (
            res.status === 400 &&
            wantsStructured &&
            this.jsonSchemaDisabled &&
            !this.forcePromptOnly &&
            generateFailed
          ) {
            this.forcePromptOnly = true;
            if (effectiveMaxTokens < MAX_EFFECTIVE_TOKENS) {
              effectiveMaxTokens = Math.min(MAX_EFFECTIVE_TOKENS, Math.ceil(effectiveMaxTokens * 1.5));
            }
            modeDegrades++;
            lastErr = `provider 400 on response_format json_object (failed to generate JSON); retrying prompt-only at max_tokens=${effectiveMaxTokens}`;
            continue;
          }
          throw new RuntimeError(
            "PROVIDER_HTTP",
            `${this.name} responded ${res.status} (${res.statusText})` +
              (redactedBody ? `: ${redactedBody}` : ""),
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

        const rawFinish = body.choices?.[0]?.finish_reason;
        const finish_reason = typeof rawFinish === "string" ? rawFinish.toLowerCase() : null;

        const mode = currentMode();
        return {
          provider: this.name,
          model: body.model ?? model,
          tier: req.tier,
          text,
          usage: { input_tokens, output_tokens },
          estimated_cost_usd: typeof body.cost === "number" ? body.cost : null,
          duration_ms: Date.now() - started,
          finish_reason,
          max_output_tokens: effectiveMaxTokens,
          rate_limit: this.lastRateLimit,
          structured_output: mode === "json_schema",
          structured_output_mode: mode,
          schema_rejection: schemaRejectedThisCall
            ? { fellBackTo: "json_object" as const, reason: schemaRejectionReason ?? "schema_unsupported" }
            : null,
        };
      } catch (err) {
        clearTimeout(timer);
        // A 429 (RateLimitError) is never internally retried - it goes straight
        // to the scheduler, which owns the reset-aware wait.
        if (err instanceof RateLimitError) throw err;
        if (err instanceof RuntimeError && err.code.startsWith("PROVIDER_") &&
            err.code !== "PROVIDER_5XX") {
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
  return err.code === "PROVIDER_5XX";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
