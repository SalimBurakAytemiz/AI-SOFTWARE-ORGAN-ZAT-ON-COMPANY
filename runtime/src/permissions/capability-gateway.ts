import type { Registries } from "../registry/index.ts";
import type { PolicyEngine, PolicyQuery } from "../policy/policy-engine.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { RuntimeControl } from "../state/runtime-control.ts";
import type { PolicyDecision, RiskLevel, CommandClass } from "../core/types.ts";

export interface AuthorizeRequest {
  agentId: string | null; // null == system caller
  capability: string | null;
  action: string;
  taskId: string;
  runId?: string;
  stepId?: string;
  risk: RiskLevel;
  environment?: PolicyQuery["environment"];
  reason: string;
}

export interface AuthorizeResult {
  decision: PolicyDecision;
  allowed: boolean;
  approvalRequired: boolean;
  commandClass: CommandClass | null;
  auditEventId: string;
}

/**
 * The Capability Gateway (build spec section 8). Every potentially consequential
 * tool call passes through here first. It resolves the agent, consults the global
 * pause, evaluates the PolicyEngine (default deny), records an audit event for the
 * request and its outcome, and returns whether the call may proceed. It never
 * executes the tool itself.
 */
export class CapabilityGateway {
  private readonly reg: Registries;
  private readonly policy: PolicyEngine;
  private readonly audit: AuditLog;
  private readonly control: RuntimeControl;

  constructor(
    reg: Registries,
    policy: PolicyEngine,
    audit: AuditLog,
    control: RuntimeControl,
  ) {
    this.reg = reg;
    this.policy = policy;
    this.audit = audit;
    this.control = control;
  }

  authorize(req: AuthorizeRequest): AuthorizeResult {
    const agent = req.agentId ? this.reg.agents.byId.get(req.agentId) ?? null : null;
    const environment = req.environment ?? "sandbox";
    const paused = this.control.isPaused();

    const commandClass =
      req.capability && this.reg.tools.capabilities.has(req.capability)
        ? this.reg.tools.commandClass(req.capability)
        : null;

    const decision = this.policy.evaluate({
      agent,
      capability: req.capability,
      action: req.action,
      risk: req.risk,
      environment,
      paused,
    });

    const result =
      decision.effect === "ALLOW"
        ? "PASS"
        : decision.effect === "APPROVAL_REQUIRED"
          ? "APPROVAL_REQUIRED"
          : "BLOCKED";

    const evt = this.audit.record({
      task: req.taskId,
      agent_id: req.agentId ?? "system",
      agent_role: agent?.department ?? "runtime",
      tool:
        req.capability && this.reg.tools.capabilities.has(req.capability)
          ? this.reg.tools.capability(req.capability).tool
          : null,
      capability: req.capability,
      action: `tool_request:${req.action}`,
      reason: `${req.reason} -> ${decision.effect}: ${decision.reason}`,
      risk_level: decision.risk_level,
      approval_required: decision.effect === "APPROVAL_REQUIRED",
      result,
    });

    return {
      decision,
      allowed: decision.effect === "ALLOW",
      approvalRequired: decision.effect === "APPROVAL_REQUIRED",
      commandClass,
      auditEventId: evt.event_id,
    };
  }
}
