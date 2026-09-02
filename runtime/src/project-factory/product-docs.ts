import type { ProjectDefinition } from "./project-model.ts";

/**
 * Deterministic product-document generation (Project Factory V0.1, build spec
 * section 13: "AI Company -> creates project -> structures requirements").
 *
 * These are structured scaffolds built from the project definition only - no
 * model call. They give Runtime V1.1's Business Analyst / Solution Architect a
 * concrete, non-empty starting point; the Runtime agents refine them during an
 * authorised build. Nothing here contains an unresolved placeholder marker.
 */

const bullets = (xs: string[]): string => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (none recorded)");

function frontMatter(def: ProjectDefinition, title: string): string {
  return [
    "---",
    "generated_by: project-factory@0.1",
    `project: ${def.slug}`,
    `title: ${JSON.stringify(title)}`,
    `lifecycle_state: ${def.status}`,
    "note: >",
    "  Deterministic scaffold generated from project.yml. Runtime V1.1 agents",
    "  refine this during an authorised build. Not the final specification.",
    "---",
    "",
  ].join("\n");
}

export function briefDoc(def: ProjectDefinition): string {
  return (
    frontMatter(def, `${def.project_name} - Product Brief`) +
    [
      `# ${def.project_name} - Product Brief`,
      "",
      `**Slug:** ${def.slug}  |  **Type:** ${def.project_type}  |  **Business model:** ${def.business_model}`,
      `**Target market:** ${def.target_market}  |  **Risk level:** ${def.risk_level}  |  **Security level:** ${def.security_level}`,
      "",
      "## Description",
      def.description,
      "",
      "## Business goal",
      def.business_goal,
      "",
      "## Target users",
      bullets(def.target_users),
      "",
      "## Platforms",
      bullets(def.platforms),
      "",
      "## Core features (initial)",
      bullets(def.core_features),
      "",
      "## Constraints",
      bullets(def.constraints),
      "",
      "## Integrations (candidate)",
      bullets(def.integrations),
      "",
      "## Non-goals for the first version",
      "- Anything not listed under core features above",
      "- Production deployment, payment execution, or destructive data operations (Human Founder controlled)",
    ].join("\n")
  );
}

export function requirementsDoc(def: ProjectDefinition): string {
  const reqs = def.core_features.map((f, i) => {
    const id = `FR-${String(i + 1).padStart(3, "0")}`;
    return `### ${id}. ${f}\n\n- **Priority:** ${i < 3 ? "must" : "should"}\n- **Rationale:** supports the business goal ("${def.business_goal}").\n- **Verification:** an automated test proves this feature behaves as specified.`;
  });
  const nfr = [
    `NFR-001. The system runs on: ${def.platforms.join(", ")}.`,
    `NFR-002. Security level is "${def.security_level}"; no secret is committed or logged.`,
    `NFR-003. All changes go through the ${def.requested_workflow} workflow with an independent review and a QA gate.`,
    "NFR-004. No production deployment, migration, or financial action occurs without explicit Human Founder approval.",
  ];
  return (
    frontMatter(def, `${def.project_name} - Requirements`) +
    [
      `# ${def.project_name} - Requirements`,
      "",
      "## Functional requirements",
      "",
      reqs.join("\n\n"),
      "",
      "## Non-functional requirements",
      "",
      bullets(nfr),
      "",
      "## Open questions for Discovery",
      bullets([
        "Confirm the priority order of the core features with the Human Founder",
        "Confirm the target market and any locale / regulatory constraints",
        def.integrations.length
          ? `Confirm concrete providers for: ${def.integrations.join(", ")}`
          : "Identify any third-party integrations the first version needs",
      ]),
    ].join("\n")
  );
}

export function businessRulesDoc(def: ProjectDefinition): string {
  const rules = [
    `BR-001. Every user-facing action respects the project's security level ("${def.security_level}").`,
    `BR-002. Business model is "${def.business_model}"; access and pricing rules follow from that.`,
    ...(def.business_model.includes("b2b")
      ? ["BR-B2B. Business customers may have accounts, quotes, and invoicing; individual customers use a simpler flow."]
      : []),
    ...(def.risk_level >= 4
      ? ["BR-RISK. This project is risk >= 4: authentication, authorization, and data-handling changes are RISK 5 and need the Human Founder."]
      : []),
    ...def.constraints.map((c, i) => `BR-C${String(i + 1).padStart(2, "0")}. Constraint honoured: ${c}`),
  ];
  return (
    frontMatter(def, `${def.project_name} - Business Rules`) +
    [`# ${def.project_name} - Business Rules`, "", bullets(rules)].join("\n")
  );
}

export function userStoriesDoc(def: ProjectDefinition): string {
  const stories: string[] = [];
  let n = 0;
  for (const user of def.target_users) {
    for (const feat of def.core_features.slice(0, 6)) {
      n += 1;
      stories.push(
        `### US-${String(n).padStart(3, "0")}\n\nAs a **${user}**, I want to **${feat.toLowerCase()}**, so that I get value from ${def.project_name}.`,
      );
    }
  }
  if (stories.length === 0) {
    stories.push(
      `### US-001\n\nAs a **user**, I want the first version of ${def.project_name} to work end to end, so that it can be evaluated.`,
    );
  }
  return (
    frontMatter(def, `${def.project_name} - User Stories`) +
    [`# ${def.project_name} - User Stories`, "", stories.join("\n\n")].join("\n")
  );
}

export function acceptanceCriteriaDoc(def: ProjectDefinition): string {
  const acs = def.core_features.map((feat, i) => {
    const id = `AC-${String(i + 1).padStart(3, "0")}`;
    return [
      `### ${id} - ${feat}`,
      "",
      `- **Given** ${def.project_name} is running`,
      `- **When** a ${def.target_users[0] ?? "user"} exercises "${feat}"`,
      "- **Then** the system responds correctly and an automated test proves it",
      "- **And** no unrelated behaviour changes and no secret is exposed",
    ].join("\n");
  });
  return (
    frontMatter(def, `${def.project_name} - Acceptance Criteria`) +
    [
      `# ${def.project_name} - Acceptance Criteria`,
      "",
      acs.join("\n\n"),
      "",
      "## Global acceptance gates (inherited from Runtime V1.1)",
      bullets([
        "The full automated test suite passes (real exit code, not a claim)",
        "An independent reviewer (never the implementer) approves the change",
        "The deterministic security checks pass (no secret, no new risky dependency)",
        "The run STOPS at HUMAN_APPROVAL_REQUIRED before any production step",
      ]),
    ].join("\n")
  );
}

export function buildPlanDoc(def: ProjectDefinition): string {
  return (
    frontMatter(def, `${def.project_name} - Build Plan`) +
    [
      `# ${def.project_name} - Build Plan`,
      "",
      `**Requested workflow:** ${def.requested_workflow}  |  **Risk level:** ${def.risk_level}`,
      "",
      "## Approach",
      bullets([
        "Runtime V1.1's Software Factory drives the requested workflow with real agents",
        "Model routing stays FREE-FIRST; premium implementation needs a separate Human Founder authorization",
        `Budget policy: <= ${def.budget_policy.max_real_provider_requests} real requests, ${def.budget_policy.max_premium_invocations} premium invocations`,
      ]),
      "",
      "## Work breakdown (initial)",
      bullets(
        def.core_features.map((f, i) => `Milestone ${i + 1}: ${f} - implement + test + independent review`),
      ),
      "",
      "## Definition of done",
      bullets([
        "Every acceptance criterion in product/acceptance-criteria.md is met with test evidence",
        "QA gate and security gate PASS",
        "Release review marks READY_FOR_HUMAN_APPROVAL",
        "The run parks at HUMAN_APPROVAL_REQUIRED for the Human Founder",
      ]),
      "",
      "## Not in scope for Project Factory",
      "- Executing this plan. Project Factory prepares it; Runtime executes it only after a Human Founder build authorization.",
    ].join("\n")
  );
}

export function projectReadme(def: ProjectDefinition): string {
  return [
    `# ${def.project_name}`,
    "",
    "> Project workspace created by **Project Factory V0.1**. This is a project",
    "> *definition*, not a built application. Runtime V1.1's Software Factory",
    "> executes it only after an explicit Human Founder build authorization.",
    "",
    `- **Slug:** ${def.slug}`,
    `- **Lifecycle state:** ${def.status}`,
    `- **Type:** ${def.project_type}  |  **Business model:** ${def.business_model}  |  **Market:** ${def.target_market}`,
    `- **Risk level:** ${def.risk_level}  |  **Security level:** ${def.security_level}`,
    `- **Requested workflow:** ${def.requested_workflow}`,
    `- **Build authorized:** ${def.build_authorization.granted ? `yes (by ${def.build_authorization.granted_by})` : "no - awaiting Human Founder"}`,
    "",
    "## Layout",
    "",
    "```",
    `${def.slug}/`,
    "  project.yml                  canonical project definition",
    "  README.md                    this file",
    "  product/                     brief, requirements, business rules, user stories, acceptance criteria",
    "  architecture/                architecture notes (filled during an authorised build)",
    "  plans/                       build plan",
    "  decisions/                   project decision log",
    "  state/                       lifecycle transition log",
    "  artifacts/runtime-handoff.json   immutable Runtime execution package",
    "```",
    "",
    "## Governance (inherited from Runtime V1.1)",
    "",
    bullets([
      "Human Founder approval before any production step",
      "Global kill switch and append-only audit apply",
      "Capability gates and secret protection apply",
      "No automatic production deployment, no financial actions, no destructive production operations",
    ]),
  ].join("\n");
}

export function decisionLog(def: ProjectDefinition): string {
  return (
    frontMatter(def, `${def.project_name} - Decision Log`) +
    [
      `# ${def.project_name} - Decision Log`,
      "",
      `## D-001 (${def.created_at}) - Project created via Project Factory V0.1`,
      "",
      bullets([
        `Project type inferred/confirmed as "${def.project_type}"`,
        `Business model "${def.business_model}", target market "${def.target_market}"`,
        `Risk level ${def.risk_level}, security level "${def.security_level}"`,
        `Requested workflow "${def.requested_workflow}"`,
      ]),
      "",
      "Further decisions (architecture, platform choice, provider selection) are made by",
      "Runtime V1.1 agents during an authorised build and appended here.",
    ].join("\n")
  );
}
