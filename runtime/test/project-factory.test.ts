import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { memoryRuntime } from "./helpers.ts";
import { ProjectStore } from "../src/project-factory/project-store.ts";
import { ProjectFactory } from "../src/project-factory/project-factory.ts";
import {
  validateProjectDefinition,
  validateHandoffPackage,
} from "../src/project-factory/schema-check.ts";
import { verifyHandoffPackage } from "../src/project-factory/runtime-handoff.ts";
import { parseIntake } from "../src/project-factory/intake.ts";
import { resolveBudgetPolicy, defaultBudgetPolicy } from "../src/project-factory/budget-policy.ts";
import { PROJECT_LIFECYCLE } from "../src/project-factory/project-model.ts";

function pf() {
  const dir = mkdtempSync(join(tmpdir(), "pf-"));
  const rt = memoryRuntime();
  const factory = new ProjectFactory({
    store: new ProjectStore(join(dir, "projects")),
    clock: rt.clock,
    audit: rt.audit,
  });
  return {
    factory,
    rt,
    dir,
    cleanup: () => {
      rt.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const HEALTH_BRIEF =
  "Project name: Sample Health API\nDescription: A simple API service with a GET /health endpoint returning 200 and JSON.";

test("Project Factory: creates a valid, schema-conformant project workspace and stops at READY_FOR_BUILD", async () => {
  const { factory, dir, cleanup } = pf();
  try {
    const def = factory.createProject({ brief: HEALTH_BRIEF });

    assert.equal(def.slug, "sample-health-api");
    assert.equal(def.status, "READY_FOR_BUILD"); // never BUILD, never authorized
    assert.equal(def.build_authorization.granted, false);
    assert.match(def.project_id, /^proj_/);
    assert.equal(def.schema_version, "0.1");
    assert.equal(def.requested_workflow, "feature-development");
    assert.equal(validateProjectDefinition(def).valid, true, JSON.stringify(validateProjectDefinition(def).errors));

    // Governance is the fixed inherited set - a project cannot weaken it.
    for (const v of Object.values(def.governance)) assert.equal(v, true);

    // Persistence: the whole workspace tree is on disk.
    const base = join(dir, "projects", def.slug);
    for (const rel of [
      "project.yml",
      "README.md",
      "product/brief.md",
      "product/requirements.md",
      "product/business-rules.md",
      "product/user-stories.md",
      "product/acceptance-criteria.md",
      "plans/build-plan.md",
      "decisions/decision-log.md",
      "state/lifecycle.md",
      "artifacts/runtime-handoff.json",
    ]) {
      assert.ok(existsSync(join(base, rel)), `missing ${rel}`);
      assert.ok(readFileSync(join(base, rel), "utf8").trim().length > 0, `${rel} is empty`);
    }

    // project.yml round-trips and re-validates.
    const reloaded = parseYaml(readFileSync(join(base, "project.yml"), "utf8"));
    assert.equal(validateProjectDefinition(reloaded).valid, true);
    assert.deepEqual(reloaded, factory.store.loadDefinition(def.slug));
  } finally {
    cleanup();
  }
});

test("Project Factory: lifecycle transitions are linear, forward-only, and never enter BUILD", async () => {
  const { factory, cleanup } = pf();
  try {
    const def = factory.createProject({ brief: HEALTH_BRIEF, stopAt: "DRAFT" });
    assert.equal(def.status, "DRAFT");

    const seen = ["DRAFT"];
    let cur = def.slug;
    for (let i = 0; i < 10; i++) {
      const before = factory.getProjectStatus(cur).status;
      if (before === "READY_FOR_BUILD") break;
      const after = factory.advanceProject(cur).status;
      seen.push(after);
    }
    assert.deepEqual(seen, [...PROJECT_LIFECYCLE]);

    // Advancing past the terminal state is refused (no BUILD).
    assert.throws(() => factory.advanceProject(def.slug), /PROJECT_LIFECYCLE_TERMINAL|terminal/);

    // History records every transition once, in order.
    const hist = factory.getProjectStatus(def.slug).history.map((h) => h.state);
    assert.deepEqual(hist, [...PROJECT_LIFECYCLE]);
  } finally {
    cleanup();
  }
});

test("Project Factory: rejects a project whose definition would not satisfy the schema", async () => {
  const { factory, cleanup } = pf();
  try {
    // Empty brief -> intake refuses.
    assert.throws(() => factory.createProject({ brief: "" }), /PROJECT_INTAKE_EMPTY|required/);
    // A too-short project name -> invalid slug -> refused before anything is written.
    assert.throws(
      () => factory.createProject({ brief: "Project name: no\nDescription: a valid length description here" }),
      /PROJECT_SLUG_INVALID/,
    );
    // A requested_workflow that violates the schema pattern is caught by validation.
    assert.throws(
      () =>
        factory.createProject({
          brief: "Project name: Bad Workflow Project\nDescription: a valid length description here",
          overrides: { requested_workflow: "Not A Valid Workflow!" },
        }),
      /PROJECT_DEFINITION_INVALID/,
    );
    assert.equal(factory.listProjects().length, 0, "no partial workspace should remain");
    // Direct schema check of a malformed definition.
    const bad = validateProjectDefinition({ slug: "X BAD", project_name: "y" });
    assert.equal(bad.valid, false);
    assert.ok(bad.errors.length > 0);
  } finally {
    cleanup();
  }
});

test("Project Factory: a duplicate slug is refused", async () => {
  const { factory, cleanup } = pf();
  try {
    factory.createProject({ brief: HEALTH_BRIEF });
    assert.throws(() => factory.createProject({ brief: HEALTH_BRIEF }), /PROJECT_SLUG_TAKEN|already exists/);
    // Also refused on explicit slug collision.
    assert.throws(
      () => factory.createProject({ brief: "Description: another one here for testing", slug: "sample-health-api" }),
      /PROJECT_SLUG_TAKEN/,
    );
  } finally {
    cleanup();
  }
});

test("Project Factory: project list and status reflect on-disk state", async () => {
  const { factory, cleanup } = pf();
  try {
    factory.createProject({ brief: HEALTH_BRIEF });
    factory.createProject({ brief: "Project name: Widget Store\nDescription: An online store selling widgets to businesses in Germany." });

    const list = factory.listProjects();
    assert.deepEqual(list.map((p) => p.slug).sort(), ["sample-health-api", "widget-store"]);

    const ws = list.find((p) => p.slug === "widget-store")!;
    assert.equal(ws.project_name, "Widget Store");
    assert.equal(ws.status, "READY_FOR_BUILD");
    assert.equal(ws.build_authorized, false);
    assert.ok(ws.handoff_present);
    assert.match(ws.handoff_checksum ?? "", /^sha256:[0-9a-f]{64}$/);

    // A fresh factory instance sees the same state (durable, not in-memory).
    const fresh = new ProjectFactory({ store: factory.store });
    assert.equal(fresh.listProjects().length, 2);
  } finally {
    cleanup();
  }
});

test("Project Factory: the Human Founder build gate", async () => {
  const { factory, rt, cleanup } = pf();
  try {
    const def = factory.createProject({ brief: HEALTH_BRIEF });
    assert.equal(def.build_authorization.granted, false);

    // Nobody but 'human-founder' may authorize.
    assert.throws(
      () => factory.authorizeBuild(def.slug, { by: "backend-engineer" }),
      /NOT_HUMAN_FOUNDER/,
    );
    assert.throws(
      () => factory.authorizeBuild(def.slug, { by: "solution-architect" }),
      /NOT_HUMAN_FOUNDER/,
    );
    assert.equal(factory.getProjectStatus(def.slug).build_authorized, false);

    // Cannot authorize a project that has not reached READY_FOR_BUILD.
    const draft = factory.createProject({ brief: "Project name: Draft Thing\nDescription: a draft project only for testing", stopAt: "DISCOVERY" });
    assert.throws(() => factory.authorizeBuild(draft.slug, { by: "human-founder" }), /PROJECT_NOT_READY/);

    // Human Founder authorizes -> gate flips, handoff regenerated, audited.
    const authed = factory.authorizeBuild(def.slug, { by: "human-founder", note: "approved for build" });
    assert.equal(authed.build_authorization.granted, true);
    assert.equal(authed.build_authorization.granted_by, "human-founder");
    assert.ok(authed.build_authorization.granted_at);

    const audit = rt.audit.list(1_000_000).filter((e) => e.task === `project:${def.slug}`);
    assert.ok(audit.some((e) => e.action === "project_build_authorized" && e.approved_by === "human-founder"));
    assert.ok(audit.some((e) => e.action === "project_build_authorization_rejected" && e.result === "BLOCKED"));

    // Idempotent.
    const again = factory.authorizeBuild(def.slug, { by: "human-founder" });
    assert.equal(again.build_authorization.granted_at, authed.build_authorization.granted_at);
  } finally {
    cleanup();
  }
});

test("Project Factory: budget policy defaults are free-first with premium disabled; invariants enforced", async () => {
  const d = defaultBudgetPolicy();
  assert.equal(d.free_first, true);
  assert.equal(d.max_premium_invocations, 0);
  assert.equal(d.premium_authorization_required, true);

  // free_first cannot be disabled.
  assert.throws(() => resolveBudgetPolicy(d, { free_first: false }), /PROJECT_BUDGET_INVALID/);
  // premium_authorization_required cannot be disabled.
  assert.throws(() => resolveBudgetPolicy(d, { premium_authorization_required: false }), /PROJECT_BUDGET_INVALID/);
  // negative limits rejected.
  assert.throws(() => resolveBudgetPolicy(d, { max_real_provider_requests: -1 }), /PROJECT_BUDGET_INVALID/);

  const { factory, cleanup } = pf();
  try {
    const def = factory.createProject({
      brief: HEALTH_BRIEF,
      budgetOverrides: { max_real_provider_requests: 12 },
    });
    assert.equal(def.budget_policy.max_real_provider_requests, 12);
    assert.equal(def.budget_policy.free_first, true);
    assert.equal(def.budget_policy.max_premium_invocations, 0);
  } finally {
    cleanup();
  }
});

test("Project Factory: the Runtime handoff package validates, is checksum-protected, and carries governance", async () => {
  const { factory, cleanup } = pf();
  try {
    const def = factory.createProject({ brief: HEALTH_BRIEF });
    const pkg = factory.store.loadHandoff(def.slug) as Record<string, unknown>;

    assert.equal(validateHandoffPackage(pkg).valid, true, JSON.stringify(validateHandoffPackage(pkg).errors));
    assert.equal(pkg.package_version, "0.1");
    assert.equal(pkg.project_id, def.project_id);
    assert.equal(pkg.requested_workflow, "feature-development");
    const product = pkg.product as Record<string, unknown>;
    for (const k of ["brief", "requirements", "business_rules", "user_stories", "acceptance_criteria"]) {
      assert.ok(typeof product[k] === "string" && (product[k] as string).length > 0);
    }

    const v = verifyHandoffPackage(pkg);
    assert.equal(v.checksumOk, true);
    assert.equal(v.governanceOk, true);
    assert.equal(v.buildAuthorized, false); // not yet authorized
    assert.equal(v.valid, true);

    // Tamper detection: change a field, checksum must fail.
    const tampered = { ...pkg, risk_level: 5 };
    assert.equal(verifyHandoffPackage(tampered).checksumOk, false);
    assert.equal(verifyHandoffPackage(tampered).valid, false);

    // Weakened governance is rejected.
    const weak = { ...pkg, governance: { ...(pkg.governance as object), no_financial_actions: false } };
    assert.equal(verifyHandoffPackage(weak).governanceOk, false);

    // After Human Founder authorization the package reports buildAuthorized.
    factory.authorizeBuild(def.slug, { by: "human-founder" });
    const authedPkg = factory.store.loadHandoff(def.slug);
    assert.equal(verifyHandoffPackage(authedPkg).buildAuthorized, true);
    assert.equal(verifyHandoffPackage(authedPkg).checksumOk, true);
  } finally {
    cleanup();
  }
});

test("Project Factory: no secret leakage - a brief that looks like a secret is refused", async () => {
  const { factory, cleanup } = pf();
  try {
    // Synthetic all-x token: `looksLikeSecret` matches the `sk-` provider-key
    // shape; gitleaks' own allowlist ignores an all-x placeholder.
    assert.throws(
      () =>
        factory.createProject({
          brief: "Project name: Leaky\nDescription: it should connect using sk-xxxxxxxxxxxxxxxxxxxxxxxx as the key",
        }),
      /PROJECT_INTAKE_SECRET|secret/i,
    );
    assert.equal(factory.listProjects().length, 0, "no project workspace should have been created");
  } finally {
    cleanup();
  }
});

test("Project Factory: creating a project has NO provider / payment / deployment / workflow-run side effects", async () => {
  const { factory, rt, cleanup } = pf();
  try {
    const def = factory.createProject({ brief: HEALTH_BRIEF });
    factory.authorizeBuild(def.slug, { by: "human-founder" });

    // No workflow run, no task, no approval request was created in the Runtime store.
    assert.equal(rt.store.listRuns().length, 0);
    assert.equal(rt.store.listTasks().length, 0);
    assert.equal(rt.approvals.list().length, 0);
    // No cost record (no model call).
    assert.equal(rt.store.listCost().length, 0);

    const audit = rt.audit.list(1_000_000);
    // Only Project-Factory audit actions; nothing that executes a workflow / deploy / payment.
    for (const e of audit) {
      assert.ok(e.action.startsWith("project_"), `unexpected audit action ${e.action}`);
      assert.ok(!/deploy|production|payment|refund|financial|workflow_step/i.test(e.action));
    }
    // The build authorization is recorded but the run is not started - Runtime is separate.
    assert.ok(audit.some((e) => e.action === "project_build_authorized"));
  } finally {
    cleanup();
  }
});

test("Project Factory: deterministic intake - same brief always yields the same structured result", () => {
  const brief =
    "I want an e-commerce system selling cleaning supplies to individual and business customers in Türkiye.";
  const a = parseIntake({ brief });
  const b = parseIntake({ brief });
  assert.deepEqual(a.structured, b.structured);
  assert.equal(a.structured.project_type, "ecommerce");
  assert.equal(a.structured.business_model, "b2b2c");
  assert.equal(a.structured.target_market, "Türkiye");
  assert.deepEqual([...a.structured.platforms].sort(), ["web"]);
});

test("Project Factory: intake heuristics raise risk and security for payment/auth language", () => {
  const r = parseIntake({
    brief: "Project name: Pay Thing\nDescription: a checkout service handling payment and customer PII with login",
  });
  assert.equal(r.structured.risk_level, 5);
  assert.equal(r.structured.security_level, "high");
});
