import { join } from "node:path";
import { loadRegistries, type Registries } from "./registry/index.ts";
import { SqliteStore } from "./state/sqlite-store.ts";
import type { StateStore } from "./state/store.ts";
import { systemClock, type Clock } from "./core/clock.ts";
import { AuditLog } from "./audit/audit-log.ts";
import { ApprovalEngine } from "./approvals/approval-engine.ts";
import { RuntimeControl } from "./state/runtime-control.ts";
import { PolicyEngine } from "./policy/policy-engine.ts";
import { CapabilityGateway } from "./permissions/capability-gateway.ts";
import { CostAccounting } from "./cost/cost-accounting.ts";
import { Observability } from "./telemetry/observability.ts";
import { WorkflowEngine } from "./workflows/workflow-engine.ts";
import { AgentRunner, type OutcomeScript } from "./agents/agent-runner.ts";
import { Orchestrator } from "./orchestrator/orchestrator.ts";
import { ModelRouter } from "./models/router.ts";
import { MockModelProvider } from "./models/mock-provider.ts";
import { LiteLlmProvider } from "./models/litellm-provider.ts";
import type { ModelProvider } from "./models/provider.ts";
import { dataDir } from "./config/paths.ts";

export interface RuntimeOptions {
  storePath?: string; // ':memory:' or a file path
  clock?: Clock;
  outcomeScript?: OutcomeScript;
  /** Extra providers, tried before the built-in mock/litellm pair. */
  providers?: ModelProvider[];
}

/**
 * Composition root. Wires the whole runtime from the Organization V1.0
 * configuration. Fails fast (throws RegistryIntegrityError) if that configuration
 * is inconsistent - the runtime must not start on a broken organization.
 */
export class Runtime {
  readonly registries: Registries;
  readonly store: StateStore;
  readonly clock: Clock;
  readonly audit: AuditLog;
  readonly approvals: ApprovalEngine;
  readonly control: RuntimeControl;
  readonly policy: PolicyEngine;
  readonly gateway: CapabilityGateway;
  readonly cost: CostAccounting;
  readonly observability: Observability;
  readonly workflows: WorkflowEngine;
  readonly router: ModelRouter;
  readonly orchestrator: Orchestrator;
  readonly providers: ModelProvider[];

  private constructor(opts: RuntimeOptions) {
    this.registries = loadRegistries();
    this.clock = opts.clock ?? systemClock;
    this.store = new SqliteStore(opts.storePath ?? join(dataDir(), "runtime.sqlite"));
    this.audit = new AuditLog(this.store, this.clock);
    this.control = new RuntimeControl(this.store, this.audit);
    this.approvals = new ApprovalEngine(this.store, this.audit, this.clock);
    this.policy = new PolicyEngine(this.registries);
    this.gateway = new CapabilityGateway(this.registries, this.policy, this.audit, this.control);
    this.cost = new CostAccounting(this.store, this.clock, this.registries.models);
    this.observability = new Observability(this.store, this.clock);

    this.providers = [
      ...(opts.providers ?? []),
      new MockModelProvider(),
      new LiteLlmProvider(),
    ];
    this.router = new ModelRouter(this.registries.models, this.providers);

    this.workflows = new WorkflowEngine(
      this.registries,
      this.store,
      this.audit,
      this.approvals,
      this.control,
      this.clock,
    );
    const runner = new AgentRunner(
      this.registries,
      this.router,
      this.gateway,
      this.cost,
      this.observability,
      this.audit,
      opts.outcomeScript,
    );
    this.orchestrator = new Orchestrator(
      this.registries,
      this.store,
      this.audit,
      this.clock,
      this.workflows,
      runner,
      this.control,
    );
  }

  static create(opts: RuntimeOptions = {}): Runtime {
    return new Runtime(opts);
  }

  close(): void {
    this.store.close();
  }
}
