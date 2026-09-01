import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { StateStore, CostRecord, SpanRecord } from "./store.ts";
import type {
  Task,
  WorkflowRun,
  ApprovalRequest,
  AuditEvent,
} from "../core/types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS flags (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, created_at TEXT NOT NULL, json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, state TEXT NOT NULL, created_at TEXT NOT NULL, json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, timestamp TEXT NOT NULL, json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cost (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, at TEXT NOT NULL, json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spans (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, at TEXT NOT NULL, json TEXT NOT NULL
);
`;

/**
 * Durable state on the built-in node:sqlite engine. The audit, cost and span
 * tables are append-only (INSERT only; no UPDATE/DELETE path exists in this class).
 */
export class SqliteStore implements StateStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
  }

  getFlag(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM flags WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setFlag(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO flags(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  putTask(task: Task): void {
    this.db
      .prepare(
        "INSERT INTO tasks(id, created_at, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
      )
      .run(task.id, task.created_at, JSON.stringify(task));
  }
  getTask(id: string): Task | null {
    return this.readOne<Task>("SELECT json FROM tasks WHERE id = ?", id);
  }
  listTasks(): Task[] {
    return this.readMany<Task>("SELECT json FROM tasks ORDER BY created_at ASC");
  }

  putRun(run: WorkflowRun): void {
    this.db
      .prepare(
        "INSERT INTO runs(id, task_id, created_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
      )
      .run(run.id, run.task_id, run.created_at, JSON.stringify(run));
  }
  getRun(id: string): WorkflowRun | null {
    return this.readOne<WorkflowRun>("SELECT json FROM runs WHERE id = ?", id);
  }
  getRunByTask(taskId: string): WorkflowRun | null {
    return this.readOne<WorkflowRun>(
      "SELECT json FROM runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
      taskId,
    );
  }
  listRuns(): WorkflowRun[] {
    return this.readMany<WorkflowRun>("SELECT json FROM runs ORDER BY created_at ASC");
  }

  putApproval(a: ApprovalRequest): void {
    this.db
      .prepare(
        "INSERT INTO approvals(id, state, created_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, json = excluded.json",
      )
      .run(a.id, a.state, a.created_at, JSON.stringify(a));
  }
  getApproval(id: string): ApprovalRequest | null {
    return this.readOne<ApprovalRequest>("SELECT json FROM approvals WHERE id = ?", id);
  }
  listApprovals(filter?: { state?: string }): ApprovalRequest[] {
    if (filter?.state) {
      return this.readMany<ApprovalRequest>(
        "SELECT json FROM approvals WHERE state = ? ORDER BY created_at ASC",
        filter.state,
      );
    }
    return this.readMany<ApprovalRequest>("SELECT json FROM approvals ORDER BY created_at ASC");
  }

  appendAudit(e: AuditEvent): void {
    this.db
      .prepare("INSERT INTO audit(event_id, timestamp, json) VALUES (?, ?, ?)")
      .run(e.event_id, e.timestamp, JSON.stringify(e));
  }
  listAudit(limit = 1000): AuditEvent[] {
    return this.readMany<AuditEvent>(
      "SELECT json FROM audit ORDER BY seq ASC LIMIT ?",
      limit,
    );
  }

  appendCost(c: CostRecord): void {
    this.db
      .prepare("INSERT INTO cost(id, at, json) VALUES (?, ?, ?)")
      .run(c.id, c.at, JSON.stringify(c));
  }
  listCost(): CostRecord[] {
    return this.readMany<CostRecord>("SELECT json FROM cost ORDER BY seq ASC");
  }

  appendSpan(s: SpanRecord): void {
    this.db
      .prepare("INSERT INTO spans(id, at, json) VALUES (?, ?, ?)")
      .run(s.id, s.at, JSON.stringify(s));
  }
  listSpans(limit = 1000): SpanRecord[] {
    return this.readMany<SpanRecord>(
      "SELECT json FROM spans ORDER BY seq ASC LIMIT ?",
      limit,
    );
  }

  close(): void {
    this.db.close();
  }

  private readOne<T>(sql: string, ...params: (string | number)[]): T | null {
    const row = this.db.prepare(sql).get(...params) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as T) : null;
  }
  private readMany<T>(sql: string, ...params: (string | number)[]): T[] {
    const rows = this.db.prepare(sql).all(...params) as { json: string }[];
    return rows.map((r) => JSON.parse(r.json) as T);
  }
}
