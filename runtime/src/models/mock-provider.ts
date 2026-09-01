import { createHash } from "node:crypto";
import type { ModelTier } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";
import type {
  GenerateRequest,
  GenerateResult,
  ModelProvider,
  ProviderHealth,
  Usage,
} from "./provider.ts";

/**
 * Deterministic local model provider (build spec section 11 - mandatory). Produces
 * a stable, hash-derived response for any request so the entire acceptance suite
 * runs with no paid API key. It does not pretend to be a real developer; it exists
 * to prove routing, hand-off, gating, persistence, audit and approval flow.
 */
export class MockModelProvider implements ModelProvider {
  readonly name = "mock";
  private inTokens = 0;
  private outTokens = 0;

  isReady(): boolean {
    return true;
  }

  health(): ProviderHealth {
    return {
      provider: this.name,
      status: "OK",
      detail: "deterministic offline provider; no API key required",
      tiers: [...MODEL_TIERS],
    };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const seedMaterial = `${req.seed ?? 0}|${req.tier}|${req.system ?? ""}|${req.prompt}|${req.context ?? ""}`;
    const digest = createHash("sha256").update(seedMaterial).digest("hex");
    const text = this.render(req, digest);

    const input_tokens = estimateTokens(`${req.system ?? ""} ${req.prompt} ${req.context ?? ""}`);
    const output_tokens = estimateTokens(text);
    this.inTokens += input_tokens;
    this.outTokens += output_tokens;

    return {
      provider: this.name,
      model: `mock-${req.tier.toLowerCase()}`,
      tier: req.tier,
      text,
      usage: { input_tokens, output_tokens },
      estimated_cost_usd: 0, // the mock provider genuinely costs zero
      duration_ms: Math.max(1, Date.now() - started),
    };
  }

  usage(): Usage {
    return { input_tokens: this.inTokens, output_tokens: this.outTokens };
  }

  private render(req: GenerateRequest, digest: string): string {
    const tag = digest.slice(0, 12);
    return [
      `[mock:${req.tier}] deterministic response ${tag}`,
      `request: ${firstLine(req.prompt)}`,
      req.context ? `context-bytes: ${req.context.length}` : "context: none",
    ].join("\n");
  }
}

function firstLine(s: string): string {
  return (s.split("\n")[0] ?? "").slice(0, 200);
}

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.trim().length / 4));
}

export function isTier(x: string): x is ModelTier {
  return (MODEL_TIERS as readonly string[]).includes(x);
}
