import type { StateStore } from "./store.ts";
import type { AuditLog } from "../audit/audit-log.ts";

const PAUSE_KEY = "runtime.paused";
const PAUSE_REASON_KEY = "runtime.pause_reason";

/**
 * The global pause / kill switch (build spec section 30). When paused, all tool
 * writes, workflow progression involving writes, and external writes are blocked;
 * status, monitoring, audit reads, analysis and human review still work. Ordinary
 * agents cannot override it - only this control, driven by the CLI, can.
 */
export class RuntimeControl {
  private readonly store: StateStore;
  private readonly audit: AuditLog;

  constructor(store: StateStore, audit: AuditLog) {
    this.store = store;
    this.audit = audit;
  }

  isPaused(): boolean {
    return this.store.getFlag(PAUSE_KEY) === "true";
  }

  pauseReason(): string | null {
    return this.store.getFlag(PAUSE_REASON_KEY);
  }

  pause(reason: string, by = "human-founder"): void {
    if (this.isPaused()) return;
    this.store.setFlag(PAUSE_KEY, "true");
    this.store.setFlag(PAUSE_REASON_KEY, reason);
    this.audit.record({
      agent_id: by,
      action: "runtime_pause",
      reason,
      result: "PASS",
    });
  }

  resume(by = "human-founder"): void {
    if (!this.isPaused()) return;
    this.store.setFlag(PAUSE_KEY, "false");
    this.audit.record({
      agent_id: by,
      action: "runtime_resume",
      reason: "global pause lifted",
      result: "PASS",
    });
  }
}
