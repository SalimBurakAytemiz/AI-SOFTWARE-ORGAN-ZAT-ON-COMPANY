import type { ModelTier } from "../core/types.ts";
import { RuntimeError } from "../core/errors.ts";
import type {
  GenerateRequest,
  GenerateResult,
  ModelProvider,
  ProviderHealth,
  Usage,
} from "./provider.ts";

/**
 * Adapter for an OpenAI-compatible / LiteLLM gateway (ADR-005). This is the
 * legitimate path for real model access: an API base URL + key supplied by the
 * Human Founder through configuration, per-agent virtual keys and budgets enforced
 * at the gateway. It is deliberately INERT unless AI_COMPANY_LITELLM_BASE_URL and
 * AI_COMPANY_LITELLM_API_KEY are set; V1 acceptance never sets them. Claude Code /
 * subscription credentials are never used here (build spec section 12).
 */
export class LiteLlmProvider implements ModelProvider {
  readonly name = "litellm";
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly tierModelMap: Record<ModelTier, string | undefined>;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.baseUrl = env.AI_COMPANY_LITELLM_BASE_URL;
    this.apiKey = env.AI_COMPANY_LITELLM_API_KEY;
    this.tierModelMap = {
      NO_AI: undefined,
      LOW_COST: env.AI_COMPANY_MODEL_LOW_COST,
      STANDARD_CODING: env.AI_COMPANY_MODEL_STANDARD_CODING,
      ADVANCED_REASONING: env.AI_COMPANY_MODEL_ADVANCED_REASONING,
      CRITICAL_REVIEW: env.AI_COMPANY_MODEL_CRITICAL_REVIEW,
    };
  }

  isReady(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  health(): ProviderHealth {
    if (!this.isReady()) {
      return {
        provider: this.name,
        status: "NOT_CONFIGURED",
        detail:
          "set AI_COMPANY_LITELLM_BASE_URL + AI_COMPANY_LITELLM_API_KEY and the per-tier model env vars to enable real model calls",
        tiers: [],
      };
    }
    const tiers = (Object.entries(this.tierModelMap) as [ModelTier, string | undefined][])
      .filter(([, m]) => Boolean(m))
      .map(([t]) => t);
    return {
      provider: this.name,
      status: "OK",
      detail: `gateway ${this.baseUrl}`,
      tiers,
    };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (!this.isReady()) {
      throw new RuntimeError(
        "PROVIDER_NOT_CONFIGURED",
        "LiteLlmProvider is not configured; V1 runs on MockModelProvider",
      );
    }
    const model = this.tierModelMap[req.tier];
    if (!model) {
      throw new RuntimeError(
        "TIER_UNMAPPED",
        `no concrete model configured for tier ${req.tier}`,
      );
    }
    const started = Date.now();
    const res = await fetch(`${this.baseUrl!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(req.system ? [{ role: "system", content: req.system }] : []),
          {
            role: "user",
            content: req.context ? `${req.context}\n\n${req.prompt}` : req.prompt,
          },
        ],
        max_tokens: req.maxOutputTokens ?? 1024,
      }),
    });
    if (!res.ok) {
      throw new RuntimeError("PROVIDER_HTTP", `gateway responded ${res.status}`);
    }
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      cost?: number;
    };
    return {
      provider: this.name,
      model,
      tier: req.tier,
      text: body.choices[0]?.message.content ?? "",
      usage: {
        input_tokens: body.usage?.prompt_tokens ?? null,
        output_tokens: body.usage?.completion_tokens ?? null,
      },
      estimated_cost_usd: typeof body.cost === "number" ? body.cost : null,
      duration_ms: Date.now() - started,
    };
  }

  usage(): Usage {
    return { input_tokens: null, output_tokens: null };
  }
}
