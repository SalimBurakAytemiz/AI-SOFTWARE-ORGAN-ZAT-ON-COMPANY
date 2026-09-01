import type {
  Task,
  WorkflowRun,
  ApprovalRequest,
  AuditEvent,
} from "../core/types.ts";

export interface CostRecord {
  id: string;
  task_id: string | null;
  run_id: string | null;
  agent_id: string | null;
  workflow_id: string | null;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  duration_ms: number | null;
  cost_known: boolean;
  at: string;
}

export interface SpanRecord {
  id: string;
  trace_id: string;
  parent_id: string | null;
  name: string;
  kind: string;
  attributes: Record<string, unknown>;
  start: string;
  end: string | null;
  status: "OK" | "ERROR" | "UNSET";
  at: string;
}

/**
 * Durable runtime state. A workflow run must survive a process restart and resume
 * from the correct step (build spec section 16). The interface is storage-agnostic
 * so SQLite can be swapped for PostgreSQL later (section 39).
 */
export interface StateStore {
  // key/value runtime flags (e.g. global pause)
  getFlag(key: string): string | null;
  setFlag(key: string, value: string): void;

  // tasks
  putTask(task: Task): void;
  getTask(id: string): Task | null;
  listTasks(): Task[];

  // workflow runs
  putRun(run: WorkflowRun): void;
  getRun(id: string): WorkflowRun | null;
  getRunByTask(taskId: string): WorkflowRun | null;
  listRuns(): WorkflowRun[];

  // approvals
  putApproval(a: ApprovalRequest): void;
  getApproval(id: string): ApprovalRequest | null;
  listApprovals(filter?: { state?: string }): ApprovalRequest[];

  // audit (append-only)
  appendAudit(e: AuditEvent): void;
  listAudit(limit?: number): AuditEvent[];

  // cost
  appendCost(c: CostRecord): void;
  listCost(): CostRecord[];

  // telemetry spans
  appendSpan(s: SpanRecord): void;
  listSpans(limit?: number): SpanRecord[];

  close(): void;
}
