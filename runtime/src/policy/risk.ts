import type { RiskLevel } from "../core/types.ts";

// RISK 5 domains (models/risk-policy.yml). Work touching any of these is critical:
// agents may analyze/plan/prepare only; execution needs the Human Founder.
export const RISK5_KEYWORDS: readonly string[] = [
  "authentication",
  "authn",
  "authorization",
  "authz",
  "login",
  "password",
  "session",
  "oauth",
  "token",
  "rbac",
  "permission",
  "access control",
  "payment",
  "refund",
  "payout",
  "invoice",
  "billing",
  "stripe",
  "checkout",
  "production database",
  "prod db",
  "migration",
  "destructive",
  "drop table",
  "truncate",
  "delete from",
  "production infrastructure",
  "terraform",
  "tofu apply",
  "dns",
  "secret",
  "credential",
  "api key",
  "customer data",
  "pii",
  "personal data",
  "export data",
  "bulk email",
  "bulk message",
  "ad budget",
  "advertising budget",
  "deploy to production",
  "production deploy",
  "merge to main",
  "security architecture",
  "crypto",
  "encryption key",
];

export function clampRisk(n: number): RiskLevel {
  if (n <= 0) return 0;
  if (n >= 5) return 5;
  return Math.round(n) as RiskLevel;
}

/**
 * Heuristic risk classification for a free-text instruction. Conservative: when a
 * RISK 5 keyword appears, the task is RISK 5 ("when in doubt, round up",
 * risk-policy.yml). This never *lowers* a caller-provided floor.
 */
export function assessRiskFromText(text: string, floor: RiskLevel = 0): RiskLevel {
  const t = text.toLowerCase();
  let risk: RiskLevel = floor;
  const bump = (to: RiskLevel) => {
    if (to > risk) risk = to;
  };

  if (RISK5_KEYWORDS.some((k) => t.includes(k))) bump(5);

  // Softer signals.
  if (/\b(refactor|rename|migrate|schema|database|deploy|release|infra)\b/.test(t)) {
    bump(3);
  }
  if (/\b(api|endpoint|service|backend|integration|feature|implement)\b/.test(t)) {
    bump(2);
  }
  if (/\b(typo|copy|wording|doc|comment|changelog|readme)\b/.test(t) && risk < 2) {
    bump(1);
  }
  return risk;
}

/** Does an action string denote a critical (Human-Founder-only) action? */
export function isCriticalAction(action: string, criticalActions: readonly string[]): boolean {
  return criticalActions.includes(action);
}
