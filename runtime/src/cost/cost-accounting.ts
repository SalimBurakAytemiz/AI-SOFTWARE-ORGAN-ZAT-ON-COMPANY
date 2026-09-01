import type { StateStore, CostRecord } from "../state/store.ts";
import type { Clock } from "../core/clock.ts";
import type { ModelRegistry } from "../registry/model-registry.ts";
import { ID } from "../core/ids.ts";

export interface CostEntry {
  task_id?: string | null;
  run_id?: string | null;
  agent_id?: string | null;
  workflow_id?: string | null;
  provider: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  /** USD; null means genuinely unknown (never invent a number, section 14). */
  estimated_cost_usd?: number | null;
  duration_ms?: number | null;
}

export interface CostSummary {
  budgets_configured: boolean;
  budgets: Record<string, string | number>;
  total_known_cost_usd: number;
  unknown_cost_calls: number;
  calls: number;
  by_agent: Record<string, { calls: number; known_cost_usd: number }>;
  by_model: Record<string, { calls: number; known_cost_usd: number }>;
}

/**
 * Minimal but honest cost accounting (build spec section 14). When a provider does
 * not report cost, the record is stored with cost_known=false and the number stays
 * null. Budgets that the Human Founder has not configured are reported as
 * NOT_CONFIGURED, never as a placeholder value.
 */
export class CostAccounting {
  private readonly store: StateStore;
  private readonly clock: Clock;
  private readonly models: ModelRegistry;

  constructor(store: StateStore, clock: Clock, models: ModelRegistry) {
    this.store = store;
    this.clock = clock;
    this.models = models;
  }

  record(entry: CostEntry): CostRecord {
    const rec: CostRecord = {
      id: ID.cost(),
      task_id: entry.task_id ?? null,
      run_id: entry.run_id ?? null,
      agent_id: entry.agent_id ?? null,
      workflow_id: entry.workflow_id ?? null,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.input_tokens ?? null,
      output_tokens: entry.output_tokens ?? null,
      estimated_cost_usd:
        typeof entry.estimated_cost_usd === "number" ? entry.estimated_cost_usd : null,
      duration_ms: entry.duration_ms ?? null,
      cost_known: typeof entry.estimated_cost_usd === "number",
      at: this.clock.isoNow(),
    };
    this.store.appendCost(rec);
    return rec;
  }

  summary(): CostSummary {
    const rows = this.store.listCost();
    const byAgent: CostSummary["by_agent"] = {};
    const byModel: CostSummary["by_model"] = {};
    let totalKnown = 0;
    let unknown = 0;
    for (const r of rows) {
      const known = r.cost_known ? (r.estimated_cost_usd ?? 0) : 0;
      if (!r.cost_known) unknown++;
      totalKnown += known;
      const a = (byAgent[r.agent_id ?? "unknown"] ??= { calls: 0, known_cost_usd: 0 });
      a.calls++;
      a.known_cost_usd += known;
      const m = (byModel[r.model] ??= { calls: 0, known_cost_usd: 0 });
      m.calls++;
      m.known_cost_usd += known;
    }
    return {
      budgets_configured: this.models.budgetsConfigured,
      budgets: this.models.budgetsConfigured
        ? this.models.budgets
        : Object.fromEntries(
            Object.keys(this.models.budgets).map((k) => [k, "NOT_CONFIGURED"]),
          ),
      total_known_cost_usd: Number(totalKnown.toFixed(6)),
      unknown_cost_calls: unknown,
      calls: rows.length,
      by_agent: byAgent,
      by_model: byModel,
    };
  }
}
