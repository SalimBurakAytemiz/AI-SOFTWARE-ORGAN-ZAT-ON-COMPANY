import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

// runtime/src/config/paths.ts -> repo root is three levels up from this dir.
const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_ROOT = resolve(HERE, "..", "..");
export const REPO_ROOT =
  process.env.AI_COMPANY_REPO_ROOT ?? resolve(RUNTIME_ROOT, "..");

export const paths = {
  repoRoot: REPO_ROOT,
  runtimeRoot: RUNTIME_ROOT,
  agents: join(REPO_ROOT, "agents", "software-company"),
  skills: join(REPO_ROOT, "skills"),
  workflows: join(REPO_ROOT, "workflows"),
  policies: join(REPO_ROOT, "policies"),
  schemas: join(REPO_ROOT, "schemas"),
  models: join(REPO_ROOT, "models"),
  tools: join(REPO_ROOT, "tools"),
  projectState: join(REPO_ROOT, "project-state", "current.yml"),
  fixtures: join(RUNTIME_ROOT, "fixtures"),
};

/** Where Project Factory persists project workspaces. Overridable for tests. */
export function projectsDir(): string {
  return process.env.AI_COMPANY_PROJECTS_DIR ?? join(REPO_ROOT, "projects");
}

/** Where mutable runtime state lives. Overridable for tests and for a scratch run. */
export function dataDir(): string {
  return process.env.AI_COMPANY_DATA_DIR ?? join(RUNTIME_ROOT, ".data");
}
