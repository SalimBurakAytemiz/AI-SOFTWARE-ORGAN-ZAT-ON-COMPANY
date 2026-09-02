import { newId } from "../core/ids.ts";
import { systemClock, type Clock } from "../core/clock.ts";
import { RuntimeError } from "../core/errors.ts";
import type { AuditLog } from "../audit/audit-log.ts";
import type { RiskLevel } from "../core/types.ts";
import { HUMAN_FOUNDER } from "../approvals/approval-engine.ts";
import { ProjectStore, toSlug, assertValidSlug } from "./project-store.ts";
import {
  parseIntake,
  type RawIntake,
  type StructuredIntake,
} from "./intake.ts";
import {
  budgetPolicyForRisk,
  resolveBudgetPolicy,
} from "./budget-policy.ts";
import {
  PROJECT_LIFECYCLE,
  PROJECT_SCHEMA_VERSION,
  INHERITED_GOVERNANCE,
  nextLifecycleState,
  type ProjectBudgetPolicy,
  type ProjectDefinition,
  type ProjectLifecycleState,
} from "./project-model.ts";
import { validateProjectDefinition } from "./schema-check.ts";
import {
  assertLinearTransition,
  assertStateArtifacts,
  lifecycleLog,
  materializeState,
} from "./lifecycle.ts";
import { projectReadme, decisionLog } from "./product-docs.ts";
import {
  buildHandoffPackage,
  type HandoffProductSpec,
  type RuntimeHandoffPackage,
} from "./runtime-handoff.ts";

/**
 * Project Factory V0.1 - facade (build spec sections 2-13).
 *
 * The Human Founder describes a project in natural language; Project Factory
 * turns it into a structured, persistent workspace under projects/<slug>/ and a
 * validated, immutable Runtime handoff package - and STOPS, waiting for an
 * explicit build authorization. It never builds the software and never invokes a
 * model provider (creation is deterministic and free).
 */

export interface CreateProjectOptions {
  /** Natural-language brief (labelled fields and/or prose). */
  brief: string;
  /** Explicit slug; otherwise derived from the project name. */
  slug?: string;
  /** Structured overrides from CLI flags or a partial YAML. */
  overrides?: Partial<StructuredIntake>;
  /** Budget-policy overrides (governance invariants are still enforced). */
  budgetOverrides?: Partial<ProjectBudgetPolicy>;
  /** Lifecycle state to stop at (default: READY_FOR_BUILD; never past it). */
  stopAt?: ProjectLifecycleState;
  createdBy?: string;
}

export interface ProjectStatus {
  slug: string;
  project_id: string;
  project_name: string;
  status: ProjectLifecycleState;
  next_state: ProjectLifecycleState | null;
  risk_level: number;
  security_level: ProjectDefinition["security_level"];
  requested_workflow: string;
  build_authorized: boolean;
  build_authorized_by: string | null;
  budget_policy: ProjectBudgetPolicy;
  handoff_present: boolean;
  handoff_checksum: string | null;
  artifacts: string[];
  history: ProjectDefinition["history"];
  updated_at: string;
}

export class ProjectFactory {
  readonly store: ProjectStore;
  private readonly clock: Clock;
  private readonly audit: AuditLog | null;

  constructor(opts: { store: ProjectStore; clock?: Clock; audit?: AuditLog | null }) {
    this.store = opts.store;
    this.clock = opts.clock ?? systemClock;
    this.audit = opts.audit ?? null;
  }

  private note(slug: string, action: string, reason: string, extra: Partial<Parameters<AuditLog["record"]>[0]> = {}): void {
    this.audit?.record({
      task: `project:${slug}`,
      agent_id: "project-factory",
      agent_role: "runtime",
      action,
      reason,
      result: "PASS",
      ...extra,
    });
  }

  // -------------------------------------------------------------------------

  createProject(opts: CreateProjectOptions): ProjectDefinition {
    const raw: RawIntake = { brief: opts.brief, overrides: opts.overrides };
    const intake = parseIntake(raw);
    const s = intake.structured;

    const slug = opts.slug ? opts.slug : toSlug(s.project_name);
    assertValidSlug(slug);
    if (this.store.exists(slug)) {
      throw new RuntimeError("PROJECT_SLUG_TAKEN", `a project with slug '${slug}' already exists`);
    }

    const stopAt = opts.stopAt ?? "READY_FOR_BUILD";
    if (!PROJECT_LIFECYCLE.includes(stopAt)) {
      throw new RuntimeError("PROJECT_LIFECYCLE_INVALID", `unknown lifecycle state '${stopAt}'`);
    }

    const now = this.clock.isoNow();
    const budget = resolveBudgetPolicy(
      budgetPolicyForRisk(s.risk_level, s.security_level),
      opts.budgetOverrides,
    );

    let def: ProjectDefinition = {
      schema_version: PROJECT_SCHEMA_VERSION,
      project_id: newId("proj"),
      project_name: s.project_name,
      slug,
      description: s.description,
      business_goal: s.business_goal,
      project_type: s.project_type,
      target_users: s.target_users,
      target_market: s.target_market,
      business_model: s.business_model,
      platforms: s.platforms,
      core_features: s.core_features,
      constraints: s.constraints,
      integrations: s.integrations,
      security_level: s.security_level,
      risk_level: s.risk_level,
      budget_policy: budget,
      requested_workflow: s.requested_workflow,
      governance: { ...INHERITED_GOVERNANCE },
      status: "DRAFT",
      build_authorization: { granted: false, granted_by: null, granted_at: null, note: null },
      created_by: opts.createdBy ?? HUMAN_FOUNDER,
      created_at: now,
      updated_at: now,
      history: [
        { state: "DRAFT", at: now, note: `created via Project Factory; ${intake.assumptions.length} inferred field(s)` },
      ],
    };

    this.assertValid(def);
    this.store.scaffold(slug);
    this.store.saveDefinition(def);
    this.store.writeFile(slug, { path: "README.md", content: projectReadme(def) });
    this.store.writeFile(slug, { path: "decisions/decision-log.md", content: decisionLog(def) });
    this.store.writeFile(slug, {
      path: "product/intake-assumptions.md",
      content: [
        `# ${def.project_name} - Intake Assumptions`,
        "",
        "Fields Project Factory inferred or defaulted from the brief. Correct any of",
        "these by editing project.yml before authorizing the build.",
        "",
        ...intake.assumptions.map((a) => `- ${a}`),
      ].join("\n"),
    });
    this.store.writeFile(slug, { path: "state/lifecycle.md", content: lifecycleLog(def) });
    this.note(slug, "project_created", `project '${slug}' created (risk ${def.risk_level}, ${def.security_level})`, {
      risk_level: def.risk_level as RiskLevel,
      new_state: "DRAFT",
    });

    // Walk the lifecycle deterministically up to stopAt (never past READY_FOR_BUILD).
    const targetIdx = PROJECT_LIFECYCLE.indexOf(stopAt);
    while (PROJECT_LIFECYCLE.indexOf(def.status) < targetIdx) {
      def = this.advance(def);
    }
    return def;
  }

  /** Advance a persisted project one lifecycle state forward. */
  advanceProject(slug: string): ProjectDefinition {
    const def = this.store.loadDefinition(slug);
    this.assertValid(def);
    assertStateArtifacts(this.store, def);
    return this.advance(def);
  }

  private advance(def: ProjectDefinition): ProjectDefinition {
    const to = nextLifecycleState(def.status);
    assertLinearTransition(def.status, to as ProjectLifecycleState);
    const next = to as ProjectLifecycleState;
    const now = this.clock.isoNow();

    const written = materializeState(this.store, { ...def, status: next }, next);

    let handoffChecksum: string | null = null;
    if (next === "READY_FOR_BUILD") {
      const pkg = this.assembleHandoff({ ...def, status: "READY_FOR_BUILD" });
      handoffChecksum = pkg.checksum;
      const rel = this.store.saveHandoff(def.slug, pkg);
      written.push(rel);
    }

    const updated: ProjectDefinition = {
      ...def,
      status: next,
      updated_at: now,
      history: [
        ...def.history,
        {
          state: next,
          at: now,
          note:
            next === "READY_FOR_BUILD"
              ? `runtime handoff package generated (${handoffChecksum})`
              : `generated: ${written.join(", ") || "(no new artifacts)"}`,
        },
      ],
    };
    this.assertValid(updated);
    this.store.saveDefinition(updated);
    this.store.writeFile(updated.slug, { path: "README.md", content: projectReadme(updated) });
    this.store.writeFile(updated.slug, { path: "state/lifecycle.md", content: lifecycleLog(updated) });
    this.note(updated.slug, "project_lifecycle_transition", `${def.status} -> ${next}`, {
      previous_state: def.status,
      new_state: next,
      risk_level: updated.risk_level as RiskLevel,
    });
    return updated;
  }

  /**
   * Record the Human Founder's authorization to build this project with Runtime
   * V1.1. Only 'human-founder' may authorize. Does NOT start a build - it flips
   * the gate and regenerates the (now authorized) handoff package.
   */
  authorizeBuild(slug: string, opts: { by: string; note?: string }): ProjectDefinition {
    const def = this.store.loadDefinition(slug);
    this.assertValid(def);
    if (opts.by !== HUMAN_FOUNDER) {
      this.audit?.record({
        task: `project:${slug}`,
        agent_id: opts.by,
        action: "project_build_authorization_rejected",
        reason: `'${opts.by}' is not the Human Founder; only 'human-founder' may authorize a build`,
        result: "BLOCKED",
        risk_level: 5,
        approval_required: true,
      });
      throw new RuntimeError("NOT_HUMAN_FOUNDER", `only 'human-founder' may authorize a build; got '${opts.by}'`);
    }
    if (def.status !== "READY_FOR_BUILD") {
      throw new RuntimeError(
        "PROJECT_NOT_READY",
        `project '${slug}' is ${def.status}; it must reach READY_FOR_BUILD before a build can be authorized`,
      );
    }
    if (def.build_authorization.granted) {
      return def; // idempotent
    }
    const now = this.clock.isoNow();
    const updated: ProjectDefinition = {
      ...def,
      updated_at: now,
      build_authorization: {
        granted: true,
        granted_by: HUMAN_FOUNDER,
        granted_at: now,
        note: opts.note ?? "Human Founder authorized Runtime V1.1 execution for this project.",
      },
      history: [...def.history, { state: "READY_FOR_BUILD", at: now, note: "build authorized by Human Founder" }],
    };
    this.assertValid(updated);
    const pkg = this.assembleHandoff(updated);
    this.store.saveHandoff(slug, pkg);
    this.store.saveDefinition(updated);
    this.store.writeFile(slug, { path: "README.md", content: projectReadme(updated) });
    this.store.writeFile(slug, { path: "state/lifecycle.md", content: lifecycleLog(updated) });
    this.audit?.record({
      task: `project:${slug}`,
      agent_id: HUMAN_FOUNDER,
      action: "project_build_authorized",
      reason: updated.build_authorization.note ?? "build authorized",
      result: "PASS",
      risk_level: 5,
      approval_required: true,
      approved_by: HUMAN_FOUNDER,
      approval_timestamp: now,
    });
    return updated;
  }

  /** Assemble the product spec strings and build+validate the handoff package. */
  private assembleHandoff(def: ProjectDefinition): RuntimeHandoffPackage {
    const read = (rel: string): string => this.store.readFile(def.slug, rel);
    const product: HandoffProductSpec = {
      brief: read("product/brief.md"),
      requirements: read("product/requirements.md"),
      business_rules: read("product/business-rules.md"),
      user_stories: read("product/user-stories.md"),
      acceptance_criteria: read("product/acceptance-criteria.md"),
    };
    return buildHandoffPackage(def, product, this.clock.isoNow());
  }

  // -------------------------------------------------------------------------

  getProjectStatus(slug: string): ProjectStatus {
    const def = this.store.loadDefinition(slug);
    const handoff = this.store.hasFile(slug, "artifacts/runtime-handoff.json")
      ? (this.store.loadHandoff(slug) as RuntimeHandoffPackage)
      : null;
    return {
      slug: def.slug,
      project_id: def.project_id,
      project_name: def.project_name,
      status: def.status,
      next_state: nextLifecycleState(def.status),
      risk_level: def.risk_level,
      security_level: def.security_level,
      requested_workflow: def.requested_workflow,
      build_authorized: def.build_authorization.granted,
      build_authorized_by: def.build_authorization.granted_by,
      budget_policy: def.budget_policy,
      handoff_present: handoff !== null,
      handoff_checksum: handoff?.checksum ?? null,
      artifacts: this.projectArtifacts(slug),
      history: def.history,
      updated_at: def.updated_at,
    };
  }

  listProjects(): ProjectStatus[] {
    return this.store.list().map((slug) => this.getProjectStatus(slug));
  }

  private projectArtifacts(slug: string): string[] {
    const rels = [
      "project.yml",
      "README.md",
      "product/brief.md",
      "product/requirements.md",
      "product/business-rules.md",
      "product/user-stories.md",
      "product/acceptance-criteria.md",
      "product/intake-assumptions.md",
      "plans/build-plan.md",
      "decisions/decision-log.md",
      "state/lifecycle.md",
      "artifacts/runtime-handoff.json",
    ];
    return rels.filter((r) => this.store.hasFile(slug, r));
  }

  private assertValid(def: ProjectDefinition): void {
    const check = validateProjectDefinition(def);
    if (!check.valid) {
      throw new RuntimeError(
        "PROJECT_DEFINITION_INVALID",
        `project definition for '${def.slug ?? "?"}' failed schema validation: ${check.errors.join("; ")}`,
      );
    }
  }
}
