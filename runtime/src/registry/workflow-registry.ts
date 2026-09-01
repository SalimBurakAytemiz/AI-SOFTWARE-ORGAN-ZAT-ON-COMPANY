import { readYaml, listYamlFiles } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { WorkflowDefinition } from "../core/types.ts";

const TERMINALS = new Set(["end", "abort", "done"]);

export interface WorkflowRegistry {
  byId: ReadonlyMap<string, WorkflowDefinition>;
  all(): WorkflowDefinition[];
  get(id: string): WorkflowDefinition;
  ids(): string[];
}

export function loadWorkflowRegistry(): WorkflowRegistry {
  const byId = new Map<string, WorkflowDefinition>();
  for (const file of listYamlFiles(paths.workflows)) {
    const data = readYaml<WorkflowDefinition>(file);
    assertValid("workflow.schema.json", data, `workflow ${file}`);
    assertWorkflowGraph(data);
    if (byId.has(data.id)) {
      throw new RegistryIntegrityError(`duplicate workflow id: ${data.id}`);
    }
    byId.set(data.id, data);
  }
  if (byId.size === 0) throw new RegistryIntegrityError("no workflow definitions found");
  return {
    byId,
    all: () => [...byId.values()],
    get: (id) => {
      const w = byId.get(id);
      if (!w) throw new RegistryIntegrityError(`unknown workflow: ${id}`);
      return w;
    },
    ids: () => [...byId.keys()].sort(),
  };
}

/** Reject a workflow whose transitions do not resolve or whose steps are unreachable. */
export function assertWorkflowGraph(w: WorkflowDefinition): void {
  const ids = new Set(w.steps.map((s) => s.id));
  if (ids.size !== w.steps.length) {
    throw new RegistryIntegrityError(`workflow ${w.id} has duplicate step ids`);
  }
  for (const s of w.steps) {
    for (const edge of [s.on_pass, s.on_fail]) {
      if (!ids.has(edge) && !TERMINALS.has(edge)) {
        throw new RegistryIntegrityError(
          `workflow ${w.id} step ${s.id} transitions to unknown '${edge}'`,
        );
      }
    }
  }
  // Reachability from the first step.
  const byId = new Map(w.steps.map((s) => [s.id, s]));
  const seen = new Set<string>([w.steps[0]!.id]);
  const stack = [w.steps[0]!.id];
  while (stack.length) {
    const cur = byId.get(stack.pop()!)!;
    for (const edge of [cur.on_pass, cur.on_fail]) {
      if (byId.has(edge) && !seen.has(edge)) {
        seen.add(edge);
        stack.push(edge);
      }
    }
  }
  const unreachable = w.steps.filter((s) => !seen.has(s.id)).map((s) => s.id);
  if (unreachable.length) {
    throw new RegistryIntegrityError(
      `workflow ${w.id} has unreachable steps: ${unreachable.join(", ")}`,
    );
  }
  // Production-safety invariant: a human_approval step must dominate every
  // PRODUCTION step (no path to production bypasses Human Founder approval).
  if (w.reaches_production) {
    assertApprovalDominatesProduction(w);
  }
}

function assertApprovalDominatesProduction(w: WorkflowDefinition): void {
  const barriers = new Set(w.steps.filter((s) => s.human_approval).map((s) => s.id));
  const firstProd = w.steps.find((s) => s.project_state === "PRODUCTION");
  if (barriers.size === 0) {
    throw new RegistryIntegrityError(
      `workflow ${w.id} reaches production but has no human_approval step`,
    );
  }
  if (!firstProd) {
    throw new RegistryIntegrityError(
      `workflow ${w.id} reaches_production but defines no PRODUCTION step`,
    );
  }
  const byId = new Map(w.steps.map((s) => [s.id, s]));
  const start = w.steps[0]!.id;
  if (barriers.has(start)) {
    throw new RegistryIntegrityError(`workflow ${w.id} start step is an approval barrier`);
  }
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    const cur = byId.get(stack.pop()!)!;
    for (const edge of [cur.on_pass, cur.on_fail]) {
      if (barriers.has(edge) || !byId.has(edge) || seen.has(edge)) continue;
      seen.add(edge);
      stack.push(edge);
    }
  }
  if (seen.has(firstProd.id)) {
    throw new RegistryIntegrityError(
      `workflow ${w.id}: PRODUCTION step '${firstProd.id}' is reachable without ` +
        `passing a human_approval step`,
    );
  }
}
