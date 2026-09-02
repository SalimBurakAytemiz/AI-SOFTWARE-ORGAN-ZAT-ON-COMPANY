import type { ProjectBudgetPolicy } from "./project-model.ts";
import type { SecurityLevel } from "./project-model.ts";
import { RuntimeError } from "../core/errors.ts";

/**
 * Per-project AI budget policy (Project Factory V0.1, build spec section 8).
 *
 * This is a *policy declaration*, not billing infrastructure. It records the
 * limits the Runtime must enforce when this project's Software Factory runs:
 * how many real free-provider requests are allowed, whether premium (paid /
 * Codex) invocations are permitted at all, and whether the free-first fallback
 * may engage. The defaults are the safest: FREE-FIRST, premium disabled,
 * premium always requiring a separate Human Founder authorization.
 */

/** The default budget policy: free-only, premium off, fallback allowed. */
export function defaultBudgetPolicy(): ProjectBudgetPolicy {
  return {
    free_first: true,
    max_real_provider_requests: 30,
    max_premium_invocations: 0,
    premium_authorization_required: true,
    provider_fallback_allowed: true,
  };
}

/** A slightly larger free budget for higher-risk projects (still premium-off). */
export function budgetPolicyForRisk(risk: number, security: SecurityLevel): ProjectBudgetPolicy {
  const base = defaultBudgetPolicy();
  if (risk >= 4 || security === "high" || security === "critical") {
    base.max_real_provider_requests = 60;
  }
  return base;
}

/**
 * Merge caller overrides into a base policy and validate the invariants that
 * keep a project inside Runtime V1.1 governance:
 *   - free_first must stay true (no project may opt out of trying free first)
 *   - premium_authorization_required must stay true
 *   - if premium invocations are allowed, authorization is still required
 */
export function resolveBudgetPolicy(
  base: ProjectBudgetPolicy,
  overrides: Partial<ProjectBudgetPolicy> = {},
): ProjectBudgetPolicy {
  const merged: ProjectBudgetPolicy = { ...base, ...overrides };

  if (merged.free_first !== true) {
    throw new RuntimeError("PROJECT_BUDGET_INVALID", "budget_policy.free_first must be true");
  }
  if (merged.premium_authorization_required !== true) {
    throw new RuntimeError(
      "PROJECT_BUDGET_INVALID",
      "budget_policy.premium_authorization_required must be true (premium always needs a per-run Human Founder authorization)",
    );
  }
  for (const [k, v] of [
    ["max_real_provider_requests", merged.max_real_provider_requests],
    ["max_premium_invocations", merged.max_premium_invocations],
  ] as const) {
    if (!Number.isInteger(v) || v < 0) {
      throw new RuntimeError("PROJECT_BUDGET_INVALID", `budget_policy.${k} must be a non-negative integer`);
    }
  }
  if (merged.max_real_provider_requests > 1000 || merged.max_premium_invocations > 100) {
    throw new RuntimeError("PROJECT_BUDGET_INVALID", "budget_policy request limits are out of range");
  }
  return merged;
}
