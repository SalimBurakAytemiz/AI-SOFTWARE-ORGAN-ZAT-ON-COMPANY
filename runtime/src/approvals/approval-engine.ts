import type { StateStore } from "../state/store.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { Clock } from "../core/clock.ts";
import type { ApprovalRequest, ApprovalState, RiskLevel } from "../core/types.ts";
import { ID } from "../core/ids.ts";
import { RuntimeError } from "../core/errors.ts";

export const HUMAN_FOUNDER = "human-founder";

export interface ApprovalInput {
  task_id: string;
  run_id: string;
  workflow_id: string;
  step_id: string;
  requested_by: string;
  requested_action: string;
  reason: string;
  risk_level: RiskLevel;
  impact: string;
  environment: string;
  tests_summary: string;
  security_summary: string;
  rollback_summary: string;
  estimated_cost_usd: number | null;
  /** Optional TTL; when omitted the request never auto-expires. */
  ttl_ms?: number;
}

/**
 * The Human Approval Engine (build spec section 9). An AI agent can never approve
 * its own request; no agent can impersonate the Human Founder. Only the literal
 * approver "human-founder" may decide a request, and only while it is PENDING.
 */
export class ApprovalEngine {
  private readonly store: StateStore;
  private readonly audit: AuditLog;
  private readonly clock: Clock;

  constructor(store: StateStore, audit: AuditLog, clock: Clock) {
    this.store = store;
    this.audit = audit;
    this.clock = clock;
  }

  request(input: ApprovalInput): ApprovalRequest {
    const now = this.clock.isoNow();
    const req: ApprovalRequest = {
      id: ID.approval(),
      task_id: input.task_id,
      run_id: input.run_id,
      workflow_id: input.workflow_id,
      step_id: input.step_id,
      requested_by: input.requested_by,
      requested_action: input.requested_action,
      reason: input.reason,
      risk_level: input.risk_level,
      impact: input.impact,
      environment: input.environment,
      tests_summary: input.tests_summary,
      security_summary: input.security_summary,
      rollback_summary: input.rollback_summary,
      estimated_cost_usd: input.estimated_cost_usd,
      state: "PENDING",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      created_at: now,
      expires_at: input.ttl_ms
        ? new Date(this.clock.now().getTime() + input.ttl_ms).toISOString()
        : null,
    };
    this.store.putApproval(req);
    this.audit.record({
      task: input.task_id,
      agent_id: input.requested_by,
      action: `approval_request:${input.requested_action}`,
      reason: input.reason,
      risk_level: input.risk_level,
      approval_required: true,
      result: "APPROVAL_REQUIRED",
      input_reference: req.id,
    });
    return req;
  }

  get(id: string): ApprovalRequest | null {
    return this.expireIfDue(this.store.getApproval(id));
  }

  list(state?: ApprovalState): ApprovalRequest[] {
    const all = this.store.listApprovals(state ? { state } : undefined);
    return all.map((a) => this.expireIfDue(a)!).filter((a) => (state ? a.state === state : true));
  }

  approve(id: string, approver: string, note = ""): ApprovalRequest {
    return this.decide(id, approver, note, "APPROVED");
  }

  reject(id: string, approver: string, note = ""): ApprovalRequest {
    return this.decide(id, approver, note, "REJECTED");
  }

  cancel(id: string, note = "cancelled"): ApprovalRequest {
    const req = this.mustGet(id);
    if (req.state !== "PENDING") {
      throw new RuntimeError("APPROVAL_STATE", `approval ${id} is ${req.state}, not PENDING`);
    }
    const updated: ApprovalRequest = { ...req, state: "CANCELLED", decision_note: note };
    this.store.putApproval(updated);
    this.audit.record({
      task: req.task_id,
      action: `approval_cancelled:${req.requested_action}`,
      reason: note,
      risk_level: req.risk_level,
      approval_required: true,
      result: "BLOCKED",
      input_reference: id,
    });
    return updated;
  }

  private decide(
    id: string,
    approver: string,
    note: string,
    to: "APPROVED" | "REJECTED",
  ): ApprovalRequest {
    const req = this.mustGet(id);

    if (approver !== HUMAN_FOUNDER) {
      // No agent, and no other identity, may decide an approval.
      this.audit.record({
        task: req.task_id,
        agent_id: approver,
        action: `approval_decision_rejected:${req.requested_action}`,
        reason: `'${approver}' is not the Human Founder; only 'human-founder' may decide approvals`,
        risk_level: req.risk_level,
        approval_required: true,
        result: "BLOCKED",
        input_reference: id,
      });
      throw new RuntimeError(
        "NOT_HUMAN_FOUNDER",
        `only 'human-founder' may decide approvals; got '${approver}'`,
      );
    }
    if (req.requested_by === HUMAN_FOUNDER) {
      throw new RuntimeError(
        "SELF_APPROVAL",
        `approval ${id} was requested by human-founder and cannot be self-decided`,
      );
    }
    if (req.state !== "PENDING") {
      throw new RuntimeError(
        "APPROVAL_STATE",
        `approval ${id} is ${req.state}; only a PENDING request can be decided`,
      );
    }

    const nowIso = this.clock.isoNow();
    const updated: ApprovalRequest = {
      ...req,
      state: to as ApprovalState,
      decided_by: HUMAN_FOUNDER,
      decided_at: nowIso,
      decision_note: note,
    };
    this.store.putApproval(updated);
    this.audit.record({
      task: req.task_id,
      agent_id: "human-founder",
      agent_role: "human-founder",
      action: `${to === "APPROVED" ? "approval_granted" : "approval_rejected"}:${req.requested_action}`,
      reason: note || (to === "APPROVED" ? "approved by Human Founder" : "rejected by Human Founder"),
      risk_level: req.risk_level,
      approval_required: true,
      approved_by: to === "APPROVED" ? "human-founder" : null,
      approval_timestamp: nowIso,
      result: to === "APPROVED" ? "PASS" : "REJECTED",
      input_reference: id,
    });
    return updated;
  }

  private mustGet(id: string): ApprovalRequest {
    const req = this.get(id);
    if (!req) throw new RuntimeError("APPROVAL_NOT_FOUND", `unknown approval: ${id}`);
    return req;
  }

  private expireIfDue(req: ApprovalRequest | null): ApprovalRequest | null {
    if (!req || req.state !== "PENDING" || !req.expires_at) return req;
    if (this.clock.now().getTime() <= new Date(req.expires_at).getTime()) return req;
    const expired: ApprovalRequest = { ...req, state: "EXPIRED" };
    this.store.putApproval(expired);
    this.audit.record({
      task: req.task_id,
      action: `approval_expired:${req.requested_action}`,
      reason: "approval request passed its expiry without a Human Founder decision",
      risk_level: req.risk_level,
      approval_required: true,
      result: "BLOCKED",
      input_reference: req.id,
    });
    return expired;
  }
}
