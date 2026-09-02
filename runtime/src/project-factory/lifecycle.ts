import { RuntimeError } from "../core/errors.ts";
import type { ProjectStore } from "./project-store.ts";
import {
  PROJECT_LIFECYCLE,
  nextLifecycleState,
  type ProjectDefinition,
  type ProjectLifecycleState,
} from "./project-model.ts";
import {
  acceptanceCriteriaDoc,
  briefDoc,
  buildPlanDoc,
  businessRulesDoc,
  requirementsDoc,
  userStoriesDoc,
} from "./product-docs.ts";

/**
 * Project Factory V0.1 lifecycle (build spec section 4).
 *
 *   DRAFT -> INTAKE -> DISCOVERY -> SPEC_READY -> PLAN_READY -> READY_FOR_BUILD
 *
 * Transitions are linear and forward-only in V0.1. Each transition has a
 * deterministic precondition (a required artifact must exist and be non-empty)
 * and a deterministic effect (it writes the next artifact set from the project
 * definition). BUILD is never entered here: READY_FOR_BUILD is terminal for
 * Project Factory and a separate Human Founder build authorization is required
 * before Runtime V1.1 may execute.
 */

/** Which product artifacts each state guarantees on disk once reached. */
export const STATE_ARTIFACTS: Record<ProjectLifecycleState, string[]> = {
  DRAFT: ["project.yml"],
  INTAKE: ["product/brief.md"],
  DISCOVERY: ["product/requirements.md", "product/business-rules.md"],
  SPEC_READY: ["product/user-stories.md", "product/acceptance-criteria.md"],
  PLAN_READY: ["plans/build-plan.md"],
  READY_FOR_BUILD: ["artifacts/runtime-handoff.json"],
};

/** Generate + write the artifacts a target state requires. Returns their paths. */
export function materializeState(
  store: ProjectStore,
  def: ProjectDefinition,
  target: ProjectLifecycleState,
): string[] {
  const written: string[] = [];
  const w = (path: string, content: string) => {
    store.writeFile(def.slug, { path, content });
    written.push(path);
  };
  switch (target) {
    case "DRAFT":
      break;
    case "INTAKE":
      w("product/brief.md", briefDoc(def));
      break;
    case "DISCOVERY":
      w("product/requirements.md", requirementsDoc(def));
      w("product/business-rules.md", businessRulesDoc(def));
      break;
    case "SPEC_READY":
      w("product/user-stories.md", userStoriesDoc(def));
      w("product/acceptance-criteria.md", acceptanceCriteriaDoc(def));
      break;
    case "PLAN_READY":
      w("plans/build-plan.md", buildPlanDoc(def));
      break;
    case "READY_FOR_BUILD":
      // The handoff package is written by the facade (it needs the product spec
      // assembled and checksummed); this state materializes nothing else.
      break;
  }
  return written;
}

/** Throw unless every artifact the *current* state guarantees is present. */
export function assertStateArtifacts(store: ProjectStore, def: ProjectDefinition): void {
  const reached = PROJECT_LIFECYCLE.slice(0, PROJECT_LIFECYCLE.indexOf(def.status) + 1);
  for (const s of reached) {
    for (const rel of STATE_ARTIFACTS[s]) {
      if (rel === "project.yml") continue;
      if (rel === "artifacts/runtime-handoff.json" && def.status !== "READY_FOR_BUILD") continue;
      if (!store.hasFile(def.slug, rel)) {
        throw new RuntimeError(
          "PROJECT_STATE_INCONSISTENT",
          `project '${def.slug}' is ${def.status} but ${rel} is missing`,
        );
      }
      if (store.readFile(def.slug, rel).trim().length === 0) {
        throw new RuntimeError("PROJECT_STATE_INCONSISTENT", `${rel} is empty for project '${def.slug}'`);
      }
    }
  }
}

export interface TransitionCheck {
  from: ProjectLifecycleState;
  to: ProjectLifecycleState;
}

/** Validate that `to` is exactly the next state after `from`. */
export function assertLinearTransition(from: ProjectLifecycleState, to: ProjectLifecycleState): TransitionCheck {
  const expected = nextLifecycleState(from);
  if (expected === null) {
    throw new RuntimeError(
      "PROJECT_LIFECYCLE_TERMINAL",
      `project is at ${from}, the terminal Project Factory state; entering BUILD needs a Human Founder build authorization`,
    );
  }
  if (to !== expected) {
    throw new RuntimeError(
      "PROJECT_LIFECYCLE_INVALID",
      `invalid transition ${from} -> ${to}; the only allowed next state is ${expected}`,
    );
  }
  return { from, to };
}

/** Append a transition to the project's on-disk lifecycle log. */
export function lifecycleLog(def: ProjectDefinition): string {
  const rows = def.history
    .map((h) => `| ${h.at} | ${h.state} | ${h.note.replace(/\|/g, "/")} |`)
    .join("\n");
  return [
    `# ${def.project_name} - Lifecycle Log`,
    "",
    "| at | state | note |",
    "| --- | --- | --- |",
    rows,
    "",
    def.build_authorization.granted
      ? `Build authorized by ${def.build_authorization.granted_by} at ${def.build_authorization.granted_at}.`
      : "Awaiting Human Founder build authorization before Runtime execution.",
  ].join("\n");
}
