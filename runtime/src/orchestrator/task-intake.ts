import type { StateStore } from "../state/store.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { Clock } from "../core/clock.ts";
import type { Task, RiskLevel } from "../core/types.ts";
import { ID } from "../core/ids.ts";

export interface TaskInput {
  title: string;
  description: string;
  project?: string;
  requested_by?: string;
  priority?: Task["priority"];
}

/** Human Founder task intake (build spec section 18). */
export class TaskIntake {
  private readonly store: StateStore;
  private readonly audit: AuditLog;
  private readonly clock: Clock;

  constructor(store: StateStore, audit: AuditLog, clock: Clock) {
    this.store = store;
    this.audit = audit;
    this.clock = clock;
  }

  create(input: TaskInput): Task {
    const now = this.clock.isoNow();
    const task: Task = {
      id: ID.task(),
      title: input.title.trim(),
      description: input.description.trim(),
      project: input.project ?? "runtime-proof",
      requested_by: input.requested_by ?? "human-founder",
      priority: input.priority ?? "normal",
      risk: 0 as RiskLevel,
      status: "CREATED",
      workflow_id: null,
      created_at: now,
      updated_at: now,
    };
    this.store.putTask(task);
    this.audit.record({
      task: task.id,
      agent_id: task.requested_by,
      action: "task_created",
      reason: task.title,
      result: "PASS",
    });
    return task;
  }

  get(id: string): Task | null {
    return this.store.getTask(id);
  }

  list(): Task[] {
    return this.store.listTasks();
  }

  save(task: Task): void {
    this.store.putTask({ ...task, updated_at: this.clock.isoNow() });
  }
}
