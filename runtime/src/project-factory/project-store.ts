import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { stringify as stringifyYaml } from "yaml";
import { looksLikeSecret } from "../core/redaction.ts";
import { RuntimeError } from "../core/errors.ts";
import type { ProjectDefinition } from "./project-model.ts";

/**
 * Filesystem persistence for Project Factory workspaces (build spec section 5).
 *
 * Each project is a directory under `projects/<slug>/` containing a canonical
 * `project.yml`, a `README.md`, and the structured product/architecture/plans/
 * decisions/state/artifacts subtree. This mirrors the repository's existing
 * "configuration as reviewable files" convention (agents/, workflows/,
 * project-state/) rather than hiding project definitions inside the SQLite
 * runtime store.
 */

export const PROJECT_SUBDIRS = [
  "product",
  "architecture",
  "plans",
  "decisions",
  "state",
  "artifacts",
] as const;

const SLUG_RE = /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/;

export function toSlug(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 50).replace(/-$/, "");
}

export function assertValidSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new RuntimeError(
      "PROJECT_SLUG_INVALID",
      `project slug '${slug}' is invalid (need lowercase letters, digits and hyphens, 3-50 chars, no leading/trailing hyphen)`,
    );
  }
}

export interface ProjectFile {
  /** Workspace-relative path, e.g. "product/brief.md". */
  path: string;
  content: string;
}

export class ProjectStore {
  /** Absolute path to the projects root (repo `projects/` by default). */
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  dir(slug: string): string {
    assertValidSlug(slug);
    return join(this.root, slug);
  }

  exists(slug: string): boolean {
    return existsSync(join(this.dir(slug), "project.yml"));
  }

  list(): string[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root)
      .filter((n) => {
        const p = join(this.root, n);
        return statSync(p).isDirectory() && existsSync(join(p, "project.yml"));
      })
      .sort();
  }

  /** Create the directory skeleton for a new project. Fails if the slug exists. */
  scaffold(slug: string): void {
    assertValidSlug(slug);
    const base = this.dir(slug);
    if (existsSync(base)) {
      throw new RuntimeError("PROJECT_SLUG_TAKEN", `project '${slug}' already exists at ${base}`);
    }
    mkdirSync(base, { recursive: true });
    for (const sub of PROJECT_SUBDIRS) mkdirSync(join(base, sub), { recursive: true });
  }

  /** Write a workspace file. Refuses secret-looking content. */
  writeFile(slug: string, file: ProjectFile): void {
    const rel = file.path.replace(/^\/+/, "");
    if (rel.includes("..") || rel.startsWith("/")) {
      throw new RuntimeError("PROJECT_PATH_INVALID", `unsafe project file path: ${file.path}`);
    }
    if (looksLikeSecret(file.content)) {
      throw new RuntimeError(
        "PROJECT_FILE_SECRET",
        `refusing to write '${rel}': content looks like a secret/credential`,
      );
    }
    const abs = join(this.dir(slug), rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, file.content.endsWith("\n") ? file.content : file.content + "\n");
  }

  readFile(slug: string, rel: string): string {
    const abs = join(this.dir(slug), rel.replace(/^\/+/, ""));
    if (!existsSync(abs)) throw new RuntimeError("PROJECT_FILE_NOT_FOUND", `${rel} not found for project '${slug}'`);
    return readFileSync(abs, "utf8");
  }

  hasFile(slug: string, rel: string): boolean {
    return existsSync(join(this.dir(slug), rel.replace(/^\/+/, "")));
  }

  /** Persist the canonical project.yml (secret-checked, deterministic key order). */
  saveDefinition(def: ProjectDefinition): void {
    const yaml =
      "# Project Factory V0.1 - canonical project definition.\n" +
      "# Validates against runtime/src/project-factory/project-model.ts (PROJECT_SCHEMA).\n" +
      stringifyYaml(def, { lineWidth: 100 });
    if (looksLikeSecret(yaml)) {
      throw new RuntimeError("PROJECT_FILE_SECRET", "project.yml content looks like a secret; aborting write");
    }
    writeFileSync(join(this.dir(def.slug), "project.yml"), yaml);
  }

  loadDefinition(slug: string): ProjectDefinition {
    const raw = this.readFile(slug, "project.yml");
    return parseYaml(raw) as ProjectDefinition;
  }

  /** Persist the immutable Runtime handoff package as JSON under artifacts/. */
  saveHandoff(slug: string, pkg: unknown): string {
    const json = JSON.stringify(pkg, null, 2) + "\n";
    if (looksLikeSecret(json)) {
      throw new RuntimeError("PROJECT_FILE_SECRET", "handoff package looks like it contains a secret; aborting write");
    }
    const rel = "artifacts/runtime-handoff.json";
    writeFileSync(join(this.dir(slug), rel), json);
    return rel;
  }

  loadHandoff(slug: string): unknown {
    return JSON.parse(this.readFile(slug, "artifacts/runtime-handoff.json"));
  }
}
