import { join } from "node:path";
import { readYaml } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { ModelTier, RiskLevel } from "../core/types.ts";
import { MODEL_TIERS } from "../core/types.ts";

export interface ModelRegistry {
  tiers: ModelTier[];
  /** risk level -> minimum permitted tier (models/routing.yml risk_floor). */
  riskFloor: Record<number, ModelTier>;
  /** task_type -> default tier (models/routing.yml task_type_defaults). */
  taskTypeDefaults: Record<string, ModelTier>;
  budgetsConfigured: boolean;
  budgets: Record<string, string | number>;
}

function tierRank(t: ModelTier): number {
  return MODEL_TIERS.indexOf(t);
}

export function loadModelRegistry(): ModelRegistry {
  const tiersDoc = readYaml<Record<string, unknown>>(join(paths.models, "tiers.yml"));
  assertValid("model-tier.schema.json", tiersDoc, "models/tiers.yml");

  const routing = readYaml<{
    risk_floor?: Record<string, string>;
    task_type_defaults?: Record<string, string>;
    budgets?: Record<string, string | number>;
  }>(join(paths.models, "routing.yml"));

  const riskFloor: Record<number, ModelTier> = {};
  for (const [k, v] of Object.entries(routing.risk_floor ?? {})) {
    if (!MODEL_TIERS.includes(v as ModelTier)) {
      throw new RegistryIntegrityError(`routing.yml risk_floor has unknown tier: ${v}`);
    }
    riskFloor[Number(k)] = v as ModelTier;
  }
  for (let r = 0; r <= 5; r++) {
    if (!(r in riskFloor)) {
      throw new RegistryIntegrityError(`routing.yml risk_floor missing risk level ${r}`);
    }
  }

  const taskTypeDefaults: Record<string, ModelTier> = {};
  for (const [k, v] of Object.entries(routing.task_type_defaults ?? {})) {
    if (!MODEL_TIERS.includes(v as ModelTier)) {
      throw new RegistryIntegrityError(`routing.yml task default has unknown tier: ${v}`);
    }
    taskTypeDefaults[k] = v as ModelTier;
  }

  const budgets = routing.budgets ?? {};
  const budgetsConfigured = Object.values(budgets).every(
    (v) => typeof v === "number" && Number.isFinite(v),
  );

  return {
    tiers: [...MODEL_TIERS],
    riskFloor,
    taskTypeDefaults,
    budgetsConfigured: budgetsConfigured && Object.keys(budgets).length > 0,
    budgets,
  };
}

export function maxTier(a: ModelTier, b: ModelTier): ModelTier {
  return tierRank(a) >= tierRank(b) ? a : b;
}

export function raiseOneTier(t: ModelTier): ModelTier {
  const next = MODEL_TIERS[Math.min(tierRank(t) + 1, MODEL_TIERS.length - 1)];
  return next ?? t;
}

export function floorForRisk(reg: ModelRegistry, risk: RiskLevel): ModelTier {
  return reg.riskFloor[risk] ?? "ADVANCED_REASONING";
}
