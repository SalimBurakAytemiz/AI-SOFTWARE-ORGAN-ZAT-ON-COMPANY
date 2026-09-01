import type { StateStore, SpanRecord } from "../state/store.ts";
import type { Clock } from "../core/clock.ts";
import { ID } from "../core/ids.ts";
import { redactSecrets } from "../core/redaction.ts";

// OpenTelemetry-shaped span interface (build spec section 28). V1 buffers spans in
// the state store; an OTLP exporter is a drop-in replacement for `emit()` later
// (ADR-013 - the runtime emits only OTLP). No Langfuse/collector is required to run.

export interface Span {
  setAttribute(key: string, value: unknown): void;
  end(status?: "OK" | "ERROR"): void;
}

export type SpanKind =
  | "agent"
  | "workflow"
  | "workflow_step"
  | "model_call"
  | "tool_call"
  | "policy_decision"
  | "approval_wait"
  | "task";

export class Observability {
  private readonly store: StateStore;
  private readonly clock: Clock;

  constructor(store: StateStore, clock: Clock) {
    this.store = store;
    this.clock = clock;
  }

  startSpan(
    name: string,
    kind: SpanKind,
    attributes: Record<string, unknown> = {},
    parentId: string | null = null,
    traceId?: string,
  ): Span {
    const rec: SpanRecord = {
      id: ID.span(),
      trace_id: traceId ?? ID.span(),
      parent_id: parentId,
      name,
      kind,
      attributes: redactSecrets(attributes),
      start: this.clock.isoNow(),
      end: null,
      status: "UNSET",
      at: this.clock.isoNow(),
    };
    let ended = false;
    return {
      setAttribute: (k, v) => {
        rec.attributes[k] = redactSecrets(v);
      },
      end: (status: "OK" | "ERROR" = "OK") => {
        if (ended) return;
        ended = true;
        rec.end = this.clock.isoNow();
        rec.status = status;
        this.store.appendSpan(rec);
      },
    };
  }

  list(limit?: number): SpanRecord[] {
    return this.store.listSpans(limit);
  }
}
