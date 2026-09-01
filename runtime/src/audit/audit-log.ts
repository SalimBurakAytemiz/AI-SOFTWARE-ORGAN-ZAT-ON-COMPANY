import type { StateStore } from "../state/store.ts";
import type { AuditEvent, RiskLevel } from "../core/types.ts";
import type { Clock } from "../core/clock.ts";
import { ID } from "../core/ids.ts";
import { redactSecrets } from "../core/redaction.ts";
import { assertValid } from "../config/schema-validator.ts";

export type AuditInput = Partial<AuditEvent> &
  Pick<AuditEvent, "action" | "reason" | "result">;

/**
 * Append-only audit ledger. Every significant runtime action becomes one event
 * (build spec section 17). Events are redacted then validated against
 * schemas/audit-event.schema.json before they are stored; an invalid event is a
 * bug and must throw rather than be silently dropped.
 */
export class AuditLog {
  private readonly store: StateStore;
  private readonly clock: Clock;

  constructor(store: StateStore, clock: Clock) {
    this.store = store;
    this.clock = clock;
  }

  record(input: AuditInput): AuditEvent {
    const event: AuditEvent = {
      event_id: input.event_id ?? ID.audit(),
      timestamp: input.timestamp ?? this.clock.isoNow(),
      project: input.project ?? "AI Software Company",
      task: input.task ?? "-",
      agent_id: input.agent_id ?? "system",
      agent_role: input.agent_role ?? "runtime",
      model: input.model ?? "none",
      tool: input.tool ?? null,
      capability: input.capability ?? null,
      action: input.action,
      reason: input.reason,
      input_reference: input.input_reference ?? null,
      output_reference: input.output_reference ?? null,
      risk_level: (input.risk_level ?? 0) as RiskLevel,
      previous_state: input.previous_state ?? null,
      new_state: input.new_state ?? null,
      approval_required: input.approval_required ?? false,
      approved_by: input.approved_by ?? null,
      approval_timestamp: input.approval_timestamp ?? null,
      result: input.result,
      duration: input.duration ?? null,
      estimated_cost: input.estimated_cost ?? null,
      error: input.error ?? null,
    };

    const safe = redactSecrets(event);
    assertValid("audit-event.schema.json", safe, "audit event");
    this.store.appendAudit(safe);
    return safe;
  }

  list(limit?: number): AuditEvent[] {
    return this.store.listAudit(limit);
  }
}
