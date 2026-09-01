import type { AgentDefinition, ModelTier, RiskLevel } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";
import type { ModelRegistry } from "../registry/model-registry.ts";
import { floorForRisk, maxTier, raiseOneTier } from "../registry/model-registry.ts";
import type { ModelProvider, GenerateResult } from "./provider.ts";
import { RuntimeError } from "../core/errors.ts";

export interface RouteInput {
  agent: AgentDefinition;
  taskType: string;
  risk: RiskLevel;
  complexity?: "low" | "normal" | "high";
  qualityBar?: "normal" | "critical";
  largeContext?: boolean;
  touchesSensitiveDomain?: boolean;
}

export interface RouteDecision {
  tier: ModelTier;
  fallback_tier: ModelTier;
  reason: string;
  floor: ModelTier;
  agent_ceiling_tier: ModelTier;
}

function rank(t: ModelTier): number {
  return MODEL_TIERS.indexOf(t);
}

/**
 * Model router (build spec section 13). Inputs, in priority order: risk (a hard
 * floor), task type, complexity, context size, quality bar, then cost as a
 * tie-breaker. Never routes above the agent's own risk ceiling; never below the
 * risk floor; deterministic work uses NO_AI.
 */
export class ModelRouter {
  private readonly models: ModelRegistry;
  private readonly providers: ModelProvider[];

  constructor(models: ModelRegistry, providers: ModelProvider[]) {
    this.models = models;
    this.providers = providers;
  }

  route(input: RouteInput): RouteDecision {
    const floor = floorForRisk(this.models, input.risk);
    const taskDefault = this.models.taskTypeDefaults[input.taskType] ?? "STANDARD_CODING";
    let tier = maxTier(floor, taskDefault);

    const raisers: string[] = [];
    if (input.complexity === "high") raisers.push("complexity=high");
    if (input.largeContext) raisers.push("large-context");
    if (input.qualityBar === "critical") raisers.push("quality=critical");
    if (input.touchesSensitiveDomain) raisers.push("sensitive-domain");
    if (raisers.length) tier = maxTier(tier, raiseOneTier(tier));

    // Never above the agent's own ceiling, expressed as a tier.
    const ceilingTier = floorForRisk(this.models, input.agent.risk_level);
    const agentCeilingTier = maxTier(input.agent.preferred_model_tier, ceilingTier);
    if (rank(tier) > rank(agentCeilingTier)) {
      // The floor may still legitimately require more than the agent can drive:
      // that is an Engineering Director sign-off / escalation, not a silent lower.
      if (rank(floor) > rank(agentCeilingTier)) {
        tier = floor;
      } else {
        tier = agentCeilingTier;
      }
    }
    // Floor always wins downward.
    if (rank(tier) < rank(floor)) tier = floor;

    const fallback =
      rank(input.agent.fallback_model_tier) <= rank(tier) && rank(tier) > 0
        ? input.agent.fallback_model_tier
        : tier;

    return {
      tier,
      fallback_tier: fallback,
      floor,
      agent_ceiling_tier: agentCeilingTier,
      reason:
        `risk ${input.risk} floor=${floor}; task '${input.taskType}' default=${taskDefault}` +
        (raisers.length ? `; raised by ${raisers.join(", ")}` : "") +
        `; agent ${input.agent.id} ceiling=${agentCeilingTier}`,
    };
  }

  /** Pick the first ready provider that serves `tier`. */
  providerFor(tier: ModelTier): ModelProvider {
    if (tier === "NO_AI") {
      throw new RuntimeError("NO_AI_TIER", "NO_AI tier must be handled by ordinary code, not a provider");
    }
    for (const p of this.providers) {
      if (p.isReady() && p.health().tiers.includes(tier)) return p;
    }
    throw new RuntimeError(
      "NO_PROVIDER",
      `no ready model provider serves tier ${tier}`,
    );
  }

  /** Route + generate, with in-tier fallback to the next ready provider. */
  async run(
    input: RouteInput,
    prompt: string,
    opts: { system?: string; context?: string; seed?: number } = {},
  ): Promise<{ decision: RouteDecision; result: GenerateResult }> {
    const decision = this.route(input);
    if (decision.tier === "NO_AI") {
      throw new RuntimeError(
        "NO_AI_TIER",
        `task '${input.taskType}' routed to NO_AI; caller must not invoke a model`,
      );
    }
    const tried: string[] = [];
    for (const tier of dedupe([decision.tier, decision.fallback_tier])) {
      for (const p of this.providers) {
        if (!p.isReady() || !p.health().tiers.includes(tier)) continue;
        try {
          const result = await p.generate({ tier, prompt, ...opts });
          return { decision, result };
        } catch (err) {
          tried.push(`${p.name}@${tier}: ${String(err)}`);
        }
      }
    }
    throw new RuntimeError(
      "ALL_PROVIDERS_FAILED",
      `no provider produced a result: ${tried.join("; ") || "none ready"}`,
    );
  }
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
