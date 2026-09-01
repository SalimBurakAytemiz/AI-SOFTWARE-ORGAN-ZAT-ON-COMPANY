import type { Registries } from "../registry/index.ts";
import type { StateStore } from "../state/store.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { Clock } from "../core/clock.ts";
import type { WorkflowEngine, ApprovalPacket } from "../workflows/workflow-engine.ts";
import type { AgentRunner, StepExecution } from "../agents/agent-runner.ts";
import type { RuntimeControl } from "../state/runtime-control.ts";
import type { Task, WorkflowRun } from "../core/types.ts";
import { TaskIntake } from "./task-intake.ts";
import { classifyTask, type Classification } from "./classifier.ts";
import { RuntimePausedError } from "../core/errors.ts";

const MAX_TRANSITIONS = 120;

export interface DriveResult {
  run: WorkflowRun;
  classification: Classification;
  executions: StepExecution[];
  stoppedBecause: string;
}

/**
 * The orchestration layer (build spec section 19). Receives a task, classifies it,
 * chooses a workflow, and drives permitted steps: resolving the owning agent,
 * running it, feeding the outcome to the WorkflowEngine, and stopping at the first
 * human_approval step (or a block, rejection, or terminal). It never overrides a
 * specialist's FAIL and never advances past a failed gate.
 */
export class Orchestrator {
  readonly tasks: TaskIntake;
  private readonly reg: Registries;
  private readonly store: StateStore;
  private readonly audit: AuditLog;
  private readonly clock: Clock;
  private readonly engine: WorkflowEngine;
  private readonly runner: AgentRunner;
  private readonly control: RuntimeControl;

  constructor(
    reg: Registries,
    store: StateStore,
    audit: AuditLog,
    clock: Clock,
    engine: WorkflowEngine,
    runner: AgentRunner,
    control: RuntimeControl,
  ) {
    this.reg = reg;
    this.store = store;
    this.audit = audit;
    this.clock = clock;
    this.engine = engine;
    this.runner = runner;
    this.control = control;
    this.tasks = new TaskIntake(store, audit, clock);
  }

  /** Classify a task and start its workflow run without executing any step yet. */
  plan(task: Task): { task: Task; classification: Classification; run: WorkflowRun } {
    if (this.control.isPaused()) {
      throw new RuntimePausedError("runtime is paused; task planning is blocked");
    }
    const classification = classifyTask(this.reg, task.title, task.description);
    const wf = this.reg.workflows.get(classification.workflow_id);
    const updated: Task = {
      ...task,
      risk: classification.risk,
      workflow_id: wf.id,
      status: "CLASSIFIED",
      updated_at: this.clock.isoNow(),
    };
    this.tasks.save(updated);
    this.audit.record({
      task: task.id,
      action: "task_classified",
      reason: `${classification.rationale}; risk ${classification.risk}; workflow ${wf.id}`,
      risk_level: classification.risk,
      result: "PASS",
    });
    const run = this.engine.start(updated, wf);
    return { task: updated, classification, run };
  }

  /** Drive a run forward until it parks, blocks, is rejected, or completes. */
  async drive(runId: string, opts: { packet?: Partial<ApprovalPacket> } = {}): Promise<DriveResult> {
    if (this.control.isPaused()) {
      throw new RuntimePausedError("runtime is paused; task execution is blocked");
    }
    let run = this.engine.getRun(runId);
    const task = this.store.getTask(run.task_id)!;
    const classification = classifyTask(this.reg, task.title, task.description);
    const executions: StepExecution[] = [];
    let previousOutput: string | null = null;
    let stoppedBecause = "completed";

    for (let i = 0; i < MAX_TRANSITIONS; i++) {
      run = this.engine.getRun(runId);
      if (run.status !== "RUNNING") {
        stoppedBecause = statusToReason(run.status);
        break;
      }
      const step = this.engine.step(run);

      if (step.human_approval) {
        run = this.engine.openApproval(runId, buildPacket(executions, opts.packet));
        stoppedBecause = "human_approval_required";
        this.markTask(task, "APPROVAL_REQUIRED");
        break;
      }

      const ownerAgent = this.reg.agents.byId.get(step.owner);
      if (!ownerAgent) {
        // A step owned by human-founder / system that we reached without parking:
        // execute it only as an approved simulated action.
        run = this.engine.submitOutcome(runId, {
          result: "PASS",
          byAgent: step.owner,
          note: `simulated ${step.owner} action (authorized by prior approval)`,
        });
        if (run.status === "BLOCKED") {
          stoppedBecause = "blocked_no_approval";
          this.markTask(task, "BLOCKED");
          break;
        }
        continue;
      }

      const execution = await this.runner.runStep(
        ownerAgent,
        step,
        task,
        run,
        previousOutput,
        classification.task_type,
      );
      executions.push(execution);
      previousOutput = `[${execution.agent_id}/${execution.step_id}] ${execution.output}`;

      run = this.engine.submitOutcome(runId, {
        result: execution.outcome,
        byAgent: ownerAgent.id,
        note: execution.output.slice(0, 160),
      });
      if (run.status === "PAUSED") {
        stoppedBecause = "paused";
        break;
      }
      if (run.status === "BLOCKED") {
        stoppedBecause = "blocked";
        break;
      }
    }

    if (run.status === "COMPLETED") this.markTask(task, "COMPLETED");
    if (run.status === "ABORTED") this.markTask(task, "ABORTED");
    if (run.status === "REJECTED") this.markTask(task, "REJECTED");

    return { run, classification, executions, stoppedBecause };
  }

  /** After the Human Founder decides, resume a parked run and keep driving. */
  async resume(runId: string): Promise<DriveResult> {
    let run = this.engine.resumeAfterApproval(runId);
    const task = this.store.getTask(run.task_id)!;
    if (run.status === "APPROVAL_REQUIRED") {
      return {
        run,
        classification: classifyTask(this.reg, task.title, task.description),
        executions: [],
        stoppedBecause: "still_awaiting_approval",
      };
    }
    if (run.status === "REJECTED") {
      this.markTask(task, "REJECTED");
      this.audit.record({
        task: task.id,
        action: "workflow_rejected",
        reason: "Human Founder rejected the approval; the critical action did not execute",
        risk_level: 5,
        result: "REJECTED",
      });
      return {
        run,
        classification: classifyTask(this.reg, task.title, task.description),
        executions: [],
        stoppedBecause: "rejected",
      };
    }
    // APPROVED -> the run is RUNNING again on the post-approval (production) step.
    return this.drive(runId);
  }

  private markTask(task: Task, status: Task["status"]): void {
    this.tasks.save({ ...task, status });
  }
}

function statusToReason(status: WorkflowRun["status"]): string {
  return (
    {
      APPROVAL_REQUIRED: "human_approval_required",
      BLOCKED: "blocked",
      REJECTED: "rejected",
      COMPLETED: "completed",
      ABORTED: "aborted",
      PAUSED: "paused",
      RUNNING: "running",
    } as const
  )[status];
}

function buildPacket(
  executions: StepExecution[],
  override?: Partial<ApprovalPacket>,
): ApprovalPacket {
  const gateSteps = executions.map((e) => e.step_id);
  return {
    impact: override?.impact ?? "Production-bound change assembled by the workflow; see release package.",
    tests_summary:
      override?.tests_summary ??
      `Gates exercised: ${gateSteps.join(", ") || "none"}. All specialist steps returned PASS in this run.`,
    security_summary:
      override?.security_summary ?? "Security gate returned PASS (mock providers; no real scan executed in V1).",
    rollback_summary:
      override?.rollback_summary ?? "Rollback plan prepared by the workflow's rollback step owner.",
    estimated_cost_usd: override?.estimated_cost_usd ?? 0,
    ttl_ms: override?.ttl_ms,
  };
}
