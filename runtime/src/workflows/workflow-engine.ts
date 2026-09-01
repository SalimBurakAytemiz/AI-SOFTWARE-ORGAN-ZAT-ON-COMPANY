import type { StateStore } from "../state/store.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { ApprovalEngine } from "../approvals/approval-engine.ts";
import type { RuntimeControl } from "../state/runtime-control.ts";
import type { Registries } from "../registry/index.ts";
import type { Clock } from "../core/clock.ts";
import type {
  Task,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowRun,
  StepRecord,
  RunStatus,
  RiskLevel,
} from "../core/types.ts";
import { ID } from "../core/ids.ts";
import { InvalidTransitionError, RuntimeError } from "../core/errors.ts";

const TERMINALS = new Set(["end", "abort", "done"]);

export interface StepOutcome {
  result: "PASS" | "FAIL";
  byAgent: string;
  note: string;
  auditEventId?: string | null;
}

export interface ApprovalPacket {
  impact: string;
  tests_summary: string;
  security_summary: string;
  rollback_summary: string;
  estimated_cost_usd: number | null;
  ttl_ms?: number;
}

/**
 * Executes workflows/*.yml as gated state machines (build spec sections 15, 16, 26).
 * Runs are persisted after every transition so a run survives a process restart and
 * resumes from the correct step. No path advances past a human_approval step without
 * an APPROVED record from the ApprovalEngine.
 */
export class WorkflowEngine {
  private readonly reg: Registries;
  private readonly store: StateStore;
  private readonly audit: AuditLog;
  private readonly approvals: ApprovalEngine;
  private readonly control: RuntimeControl;
  private readonly clock: Clock;

  constructor(
    reg: Registries,
    store: StateStore,
    audit: AuditLog,
    approvals: ApprovalEngine,
    control: RuntimeControl,
    clock: Clock,
  ) {
    this.reg = reg;
    this.store = store;
    this.audit = audit;
    this.approvals = approvals;
    this.control = control;
    this.clock = clock;
  }

  start(task: Task, workflow: WorkflowDefinition): WorkflowRun {
    const first = workflow.steps[0]!;
    const now = this.clock.isoNow();
    const run: WorkflowRun = {
      id: ID.run(),
      task_id: task.id,
      workflow_id: workflow.id,
      current_step: first.id,
      status: "RUNNING",
      project_state: first.project_state ?? null,
      history: [],
      pending_approval_id: null,
      created_at: now,
      updated_at: now,
    };
    this.store.putRun(run);
    this.audit.record({
      task: task.id,
      action: `workflow_started:${workflow.id}`,
      reason: `run ${run.id} created for task ${task.id}`,
      risk_level: workflow.risk_level,
      new_state: run.project_state,
      result: "PASS",
    });
    return run;
  }

  getRun(id: string): WorkflowRun {
    const run = this.store.getRun(id);
    if (!run) throw new RuntimeError("RUN_NOT_FOUND", `unknown run: ${id}`);
    return run;
  }

  step(run: WorkflowRun): WorkflowStep {
    const wf = this.reg.workflows.get(run.workflow_id);
    const step = wf.steps.find((s) => s.id === run.current_step);
    if (!step) throw new RuntimeError("STEP_NOT_FOUND", `step ${run.current_step} missing`);
    return step;
  }

  private effectiveRisk(wf: WorkflowDefinition, step: WorkflowStep): RiskLevel {
    return (step.risk_level ?? wf.risk_level) as RiskLevel;
  }

  /**
   * Called when a run's current step is a human_approval step and no request is
   * open yet. Creates the PENDING approval and parks the run.
   */
  openApproval(runId: string, packet: ApprovalPacket): WorkflowRun {
    const run = this.getRun(runId);
    const wf = this.reg.workflows.get(run.workflow_id);
    const step = this.step(run);
    if (!step.human_approval) {
      throw new InvalidTransitionError(
        `step ${step.id} is not a human_approval step`,
      );
    }
    if (run.pending_approval_id) {
      const existing = this.approvals.get(run.pending_approval_id);
      if (existing && existing.state === "PENDING") return run;
    }
    const req = this.approvals.request({
      task_id: run.task_id,
      run_id: run.id,
      workflow_id: wf.id,
      step_id: step.id,
      requested_by: run.history.at(-1)?.owner ?? "system",
      requested_action: this.criticalActionFor(wf, step),
      reason: step.action,
      risk_level: 5,
      impact: packet.impact,
      environment: step.project_state === "PRODUCTION" ? "production" : "staging",
      tests_summary: packet.tests_summary,
      security_summary: packet.security_summary,
      rollback_summary: packet.rollback_summary,
      estimated_cost_usd: packet.estimated_cost_usd,
      ttl_ms: packet.ttl_ms,
    });
    const updated: WorkflowRun = {
      ...run,
      status: "APPROVAL_REQUIRED",
      pending_approval_id: req.id,
      project_state: "HUMAN_APPROVAL_REQUIRED",
      updated_at: this.clock.isoNow(),
    };
    this.store.putRun(updated);
    this.audit.record({
      task: run.task_id,
      action: `workflow_parked:${wf.id}.${step.id}`,
      reason: `awaiting Human Founder approval (${req.id})`,
      risk_level: 5,
      previous_state: run.project_state,
      new_state: "HUMAN_APPROVAL_REQUIRED",
      approval_required: true,
      result: "APPROVAL_REQUIRED",
      input_reference: req.id,
    });
    return updated;
  }

  /**
   * Resume a parked run after the Human Founder has decided its approval. APPROVED
   * follows the step's on_pass edge; REJECTED follows on_fail and marks the run
   * REJECTED. A still-PENDING approval leaves the run parked.
   */
  resumeAfterApproval(runId: string): WorkflowRun {
    const run = this.getRun(runId);
    const step = this.step(run);
    if (run.status !== "APPROVAL_REQUIRED" || !run.pending_approval_id) {
      throw new InvalidTransitionError(`run ${runId} is not awaiting approval`);
    }
    const approval = this.approvals.get(run.pending_approval_id);
    if (!approval) throw new RuntimeError("APPROVAL_NOT_FOUND", run.pending_approval_id);

    if (approval.state === "PENDING") return run;

    if (approval.state === "APPROVED") {
      const record = this.pushHistory(run, step, "PASS", "human-founder", "approved by Human Founder", null);
      return this.transition(run, step, step.on_pass, "RUNNING", record, approval.decided_by);
    }
    // REJECTED / EXPIRED / CANCELLED -> follow on_fail, mark run REJECTED.
    const record = this.pushHistory(
      run,
      step,
      "FAIL",
      "human-founder",
      `approval ${approval.state.toLowerCase()}`,
      null,
    );
    return this.transition(run, step, step.on_fail, "REJECTED", record, null);
  }

  /**
   * Submit the outcome of a non-approval step. Enforces owner match, global pause,
   * and the rule that any step owned by the Human Founder or at RISK 5 / PRODUCTION
   * needs an APPROVED approval on the run before it can pass.
   */
  submitOutcome(runId: string, outcome: StepOutcome): WorkflowRun {
    const run = this.getRun(runId);
    if (run.status !== "RUNNING") {
      throw new InvalidTransitionError(
        `run ${runId} is ${run.status}; cannot submit a step outcome`,
      );
    }
    const wf = this.reg.workflows.get(run.workflow_id);
    const step = this.step(run);
    const risk = this.effectiveRisk(wf, step);

    if (step.human_approval) {
      throw new InvalidTransitionError(
        `step ${step.id} is a human_approval step; use openApproval/resumeAfterApproval`,
      );
    }

    // Owner must match the step's declared owner (system may act for system steps).
    if (
      outcome.byAgent !== step.owner &&
      !(step.owner === "system" && outcome.byAgent === "system") &&
      !(step.owner === "human-founder" && outcome.byAgent === "human-founder")
    ) {
      this.audit.record({
        task: run.task_id,
        agent_id: outcome.byAgent,
        action: `step_owner_mismatch:${wf.id}.${step.id}`,
        reason: `${outcome.byAgent} may not act on a step owned by ${step.owner}`,
        risk_level: risk,
        result: "BLOCKED",
      });
      throw new InvalidTransitionError(
        `step ${step.id} is owned by ${step.owner}, not ${outcome.byAgent}`,
      );
    }

    // Reviewer independence: a review step's actor must not have implemented.
    if (isReviewStep(step)) {
      const implementers = run.history
        .filter((h) => isImplementStep(wf, h.step_id))
        .map((h) => h.owner);
      if (implementers.includes(outcome.byAgent)) {
        throw new RuntimeError(
          "REVIEWER_NOT_INDEPENDENT",
          `${outcome.byAgent} implemented this change and cannot also review it`,
        );
      }
    }

    // Global pause blocks progression of write-ish steps.
    if (this.control.isPaused() && stepWrites(step)) {
      const updated: WorkflowRun = { ...run, status: "PAUSED", updated_at: this.clock.isoNow() };
      this.store.putRun(updated);
      this.audit.record({
        task: run.task_id,
        action: `workflow_blocked_paused:${wf.id}.${step.id}`,
        reason: "global pause is engaged; write-bearing workflow progression is blocked",
        risk_level: risk,
        result: "BLOCKED",
      });
      return updated;
    }

    // A Human-Founder-owned / RISK 5 / PRODUCTION step needs a prior APPROVED approval.
    const needsApproval =
      step.owner === "human-founder" ||
      risk >= 5 ||
      step.project_state === "PRODUCTION";
    let approvedBy: string | null = null;
    if (needsApproval && outcome.result === "PASS") {
      const approved = this.runHasApproval(run);
      approvedBy = approved?.decided_by ?? null;
      if (!approved) {
        const updated: WorkflowRun = { ...run, status: "BLOCKED", updated_at: this.clock.isoNow() };
        this.store.putRun(updated);
        this.audit.record({
          task: run.task_id,
          action: `workflow_blocked_no_approval:${wf.id}.${step.id}`,
          reason: `step ${step.id} requires an approved Human Founder authorization that is not present`,
          risk_level: 5,
          approval_required: true,
          result: "BLOCKED",
        });
        return updated;
      }
    }

    const record = this.pushHistory(
      run,
      step,
      outcome.result,
      outcome.byAgent,
      outcome.note,
      outcome.auditEventId ?? null,
    );
    const target = outcome.result === "PASS" ? step.on_pass : step.on_fail;
    const nextStatus: RunStatus = outcome.result === "FAIL" && target === "abort" ? "ABORTED" : "RUNNING";
    return this.transition(run, step, target, nextStatus, record, approvedBy);
  }

  // ---- internals -------------------------------------------------------------

  private transition(
    run: WorkflowRun,
    from: WorkflowStep,
    target: string,
    tentativeStatus: RunStatus,
    record: StepRecord,
    approvedBy: string | null,
  ): WorkflowRun {
    const wf = this.reg.workflows.get(run.workflow_id);
    let status: RunStatus = tentativeStatus;
    let projectState = run.project_state;
    let currentStep = target;

    if (TERMINALS.has(target)) {
      status = target === "abort" ? "ABORTED" : record.result === "FAIL" && tentativeStatus === "REJECTED" ? "REJECTED" : "COMPLETED";
      currentStep = from.id; // park on the last real step for inspection
    } else {
      const next = wf.steps.find((s) => s.id === target);
      if (!next) throw new InvalidTransitionError(`${wf.id}: '${target}' is not a step`);
      projectState = next.project_state ?? projectState;
    }

    const updated: WorkflowRun = {
      ...run,
      current_step: currentStep,
      status,
      project_state: projectState,
      history: [...run.history, record],
      pending_approval_id: null,
      updated_at: this.clock.isoNow(),
    };
    this.store.putRun(updated);
    this.audit.record({
      task: run.task_id,
      agent_id: record.owner,
      agent_role: this.reg.agents.byId.get(record.owner)?.department ?? "runtime",
      action: `workflow_step:${wf.id}.${from.id}`,
      reason: `${record.result} -> ${target}${TERMINALS.has(target) ? ` (${status})` : ""}: ${record.note}`,
      risk_level: this.effectiveRisk(wf, from),
      previous_state: run.project_state,
      new_state: projectState,
      approval_required: Boolean(from.human_approval),
      approved_by: approvedBy,
      approval_timestamp: approvedBy ? this.clock.isoNow() : null,
      result: record.result === "PASS" ? "PASS" : "FAIL",
      input_reference: record.audit_event_id,
    });
    return updated;
  }

  private pushHistory(
    _run: WorkflowRun,
    step: WorkflowStep,
    result: "PASS" | "FAIL",
    owner: string,
    note: string,
    auditEventId: string | null,
  ): StepRecord {
    return {
      step_id: step.id,
      owner,
      result: result === "PASS" ? "PASS" : "FAIL",
      note,
      at: this.clock.isoNow(),
      audit_event_id: auditEventId,
    };
  }

  private runHasApproval(run: WorkflowRun) {
    return this.store
      .listApprovals({ state: "APPROVED" })
      .find((a) => a.run_id === run.id && a.decided_by === "human-founder");
  }

  private criticalActionFor(wf: WorkflowDefinition, step: WorkflowStep): string {
    if (step.project_state === "PRODUCTION" || /deploy|production/.test(step.id)) {
      return "production_deployment";
    }
    if (/migrat/.test(step.id) || /migrat/.test(step.action)) {
      return "production_database_migration";
    }
    if (wf.id === "architecture-change") return "critical_security_architecture_change";
    return "production_deployment";
  }
}

function isReviewStep(step: WorkflowStep): boolean {
  return step.id === "code_review" || step.id === "review";
}

function isImplementStep(wf: WorkflowDefinition, stepId: string): boolean {
  return ["implementation", "implement", "fix", "design", "adr"].includes(stepId);
}

function stepWrites(step: WorkflowStep): boolean {
  return /implement|deploy|migrat|staging|production|apply|fix|merge|release/.test(
    `${step.id} ${step.action}`.toLowerCase(),
  );
}
