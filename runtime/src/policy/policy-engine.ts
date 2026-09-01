import type {
  AgentDefinition,
  PolicyDecision,
  RiskLevel,
  CommandClass,
} from "../core/types.ts";
import type { Registries } from "../registry/index.ts";
import { CRITICAL_ACTIONS } from "../registry/policy-registry.ts";

export interface PolicyQuery {
  agent: AgentDefinition | null; // null == 'system' / non-agent caller
  /** A capability id (github.create_pr) OR null when checking a bare action. */
  capability: string | null;
  /** A named action (production_deployment, analyze, ...). */
  action: string;
  risk: RiskLevel;
  environment: "development" | "sandbox" | "staging" | "production" | "none";
  paused: boolean;
}

const WRITE_CLASSES: ReadonlySet<CommandClass> = new Set<CommandClass>([
  "DEVELOPMENT_WRITE",
  "DESTRUCTIVE",
  "EXTERNAL_WRITE",
  "PRODUCTION_WRITE",
  "FINANCIAL",
]);

/**
 * The default-deny authorization decision point. Every consequential action in the
 * runtime is evaluated here before it happens. Unknown => DENY. Uncertain => DENY.
 * Critical action or RISK 5 => APPROVAL_REQUIRED (build spec sections 8, 13, 36).
 */
export class PolicyEngine {
  private readonly reg: Registries;

  constructor(reg: Registries) {
    this.reg = reg;
  }

  evaluate(q: PolicyQuery): PolicyDecision {
    const matched: string[] = [];

    // 1. Critical actions are reserved to the Human Founder, always.
    if (CRITICAL_ACTIONS.includes(q.action)) {
      return {
        effect: "APPROVAL_REQUIRED",
        reason: `'${q.action}' is a critical action reserved to the Human Founder (Constitution Article 3)`,
        matched_rules: ["human-approval:NO_STANDING_DELEGATION"],
        risk_level: 5,
        approver: "human-founder",
      };
    }

    // 2. Pure preparation is always allowed (human-approval:PREPARE_IS_ALLOWED).
    const PREP = ["analyze", "plan", "propose", "prepare", "draft", "request_approval"];
    if (q.capability === null && PREP.includes(q.action)) {
      return {
        effect: "ALLOW",
        reason: "preparation carries no execution risk",
        matched_rules: ["human-approval:PREPARE_IS_ALLOWED"],
        risk_level: q.risk,
        approver: null,
      };
    }

    // 3. Capability checks (default deny).
    if (q.capability !== null) {
      const cap = this.reg.tools.capabilities.get(q.capability);
      if (!cap) {
        return this.deny(`unknown capability '${q.capability}'`, ["agent-permissions:DEFAULT_DENY"], q.risk);
      }
      if (!cap.grantable) {
        return this.deny(
          `capability '${q.capability}' is non-grantable (${cap.reason_not_grantable?.trim() ?? "reserved to the Human Founder"})`,
          ["agent-permissions:NON_GRANTABLE_NEVER"],
          5,
        );
      }
      if (!q.agent) {
        return this.deny(
          `non-agent caller may not use capability '${q.capability}'`,
          ["agent-permissions:DEFAULT_DENY"],
          q.risk,
        );
      }
      if (q.agent.forbidden_tools.includes(q.capability)) {
        return this.deny(
          `'${q.capability}' is in ${q.agent.id}.forbidden_tools`,
          ["agent-permissions:FORBIDDEN_TOOLS_HONORED"],
          q.risk,
        );
      }
      if (!q.agent.allowed_tools.includes(q.capability)) {
        return this.deny(
          `${q.agent.id} was not granted '${q.capability}' (default deny)`,
          ["agent-permissions:DEFAULT_DENY"],
          q.risk,
        );
      }
      if (cap.risk_level > q.agent.risk_level) {
        return this.deny(
          `'${q.capability}' (risk ${cap.risk_level}) exceeds ${q.agent.id} ceiling ${q.agent.risk_level}`,
          ["agent-permissions:WITHIN_RISK_CEILING"],
          cap.risk_level,
        );
      }
      matched.push("agent-permissions:CAPABILITY_SCOPED");

      const cls = this.reg.tools.commandClass(q.capability);

      // 4. Global pause blocks writes (build spec section 30).
      if (q.paused && WRITE_CLASSES.has(cls)) {
        return this.deny(
          `runtime is paused; '${q.capability}' (${cls}) is blocked until resume`,
          ["runtime:GLOBAL_PAUSE"],
          q.risk,
        );
      }

      // 5. Production / financial writes never proceed autonomously.
      if (cls === "PRODUCTION_WRITE" || cls === "FINANCIAL") {
        return {
          effect: "APPROVAL_REQUIRED",
          reason: `'${q.capability}' is a ${cls} action`,
          matched_rules: [...matched, "human-approval:NO_STANDING_DELEGATION"],
          risk_level: 5,
          approver: "human-founder",
        };
      }
      if (q.environment === "production" && WRITE_CLASSES.has(cls)) {
        return {
          effect: "APPROVAL_REQUIRED",
          reason: `write to production ('${q.capability}') requires Human Founder approval`,
          matched_rules: [...matched, "production:NO_AGENT_PRODUCTION_WRITE"],
          risk_level: 5,
          approver: "human-founder",
        };
      }
    }

    // 6. RISK 5 work always additionally requires the Human Founder.
    if (q.risk >= 5) {
      return {
        effect: "APPROVAL_REQUIRED",
        reason: "RISK 5 work requires explicit Human Founder approval (models/risk-policy.yml)",
        matched_rules: [...matched, "risk-policy:RISK_5_RULE"],
        risk_level: 5,
        approver: "human-founder",
      };
    }

    return {
      effect: "ALLOW",
      reason: matched.length ? "within granted capability and risk ceiling" : "non-consequential action",
      matched_rules: matched,
      risk_level: q.risk,
      approver: null,
    };
  }

  private deny(reason: string, rules: string[], risk: RiskLevel): PolicyDecision {
    return { effect: "DENY", reason, matched_rules: rules, risk_level: risk, approver: null };
  }
}
