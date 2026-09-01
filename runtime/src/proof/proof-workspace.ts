import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  cpSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve, relative, isAbsolute, dirname, normalize, sep } from "node:path";
import type { CommandClass } from "../core/types.ts";
import { RuntimeError } from "../core/errors.ts";

const run = promisify(execFile);

/**
 * The disposable, isolated proof workspace (build spec sections 12, 17, 18, 39).
 *
 * - Seeded once from runtime/fixtures/demo-service into build/proof/<task-id>/workspace.
 * - Every path is normalised and verified: no "../" traversal, no absolute paths,
 *   no writes outside the workspace, no writes to .git internals, no writes to the
 *   company runtime source, no writes to files that look like secrets. DEFAULT DENY.
 * - Command execution is restricted to safe development commands (package scripts).
 *   Destructive / external-write / production commands are refused.
 * - The model never touches any of this directly: the RealAgentRunner asks the
 *   Capability Gateway first, and only an ALLOW reaches these methods.
 */

export type WorkspaceOp = "read" | "list" | "write" | "patch" | "exec";

const SECRET_PATH_RE = /(^|\/)(\.env(\.|$)|.*secret.*|.*credential.*|id_rsa|.*\.pem$|.*\.key$)/i;
const DENIED_PREFIXES = [".git", "node_modules"];

const HARD_BLOCK_CMD = [
  /\brm\s+-rf?\b/,
  /\b(mkfs|dd|shutdown|reboot|sudo)\b/,
  /:\(\)\s*\{/,
  /\bcurl\b[^|]*\|\s*(sh|bash)/,
  /\bgit\s+push\b/,
  /\bnpm\s+publish\b/,
  /\b(kubectl|terraform|tofu)\s+apply\b/,
  /\bdeploy\b/,
  />\s*\/(etc|usr|bin|dev)\b/,
];

// Allow-list of safe development commands for the fixture project.
const ALLOWED_CMD = [
  /^npm\s+(ci|install|i)\s*$/,
  /^npm\s+test\s*$/,
  /^npm\s+run\s+(lint|typecheck|build|test)\s*$/,
  /^node\s+--test(\s+\S+)?\s*$/,
  /^node\s+--test\s+test\/?\s*$/,
];

export interface WorkspaceExecResult {
  command: string;
  classification: CommandClass;
  allowed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  blockReason?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
}

export class ProofWorkspace {
  readonly root: string;
  readonly taskId: string;
  private gitReady = false;

  constructor(opts: { buildRoot: string; taskId: string; seedFrom: string }) {
    this.taskId = opts.taskId;
    this.root = resolve(join(opts.buildRoot, "proof", opts.taskId, "workspace"));
    mkdirSync(this.root, { recursive: true });
    if (readdirSync(this.root).length === 0) {
      if (!existsSync(opts.seedFrom)) {
        throw new RuntimeError("PROOF_SEED_MISSING", `fixture not found: ${opts.seedFrom}`);
      }
      cpSync(opts.seedFrom, this.root, { recursive: true });
    }
  }

  // --- path safety -----------------------------------------------------------

  /** Resolve a caller-supplied relative path, or throw. DEFAULT DENY. */
  private safePath(relPath: string, op: WorkspaceOp): string {
    if (typeof relPath !== "string" || relPath.trim() === "") {
      throw new RuntimeError("WORKSPACE_PATH", `${op}: empty path`);
    }
    if (isAbsolute(relPath)) {
      throw new RuntimeError("WORKSPACE_PATH", `${op}: absolute paths are denied: ${relPath}`);
    }
    const norm = normalize(relPath).replace(/^(\.\/)+/, "");
    if (norm === ".." || norm.startsWith(".." + sep) || norm.includes(sep + ".." + sep)) {
      throw new RuntimeError("WORKSPACE_TRAVERSAL", `${op}: path traversal denied: ${relPath}`);
    }
    const abs = resolve(this.root, norm);
    if (abs !== this.root && !abs.startsWith(this.root + sep)) {
      throw new RuntimeError("WORKSPACE_ESCAPE", `${op}: path escapes the workspace: ${relPath}`);
    }
    const rel = relative(this.root, abs);
    const top = rel.split(sep)[0] ?? "";
    if (DENIED_PREFIXES.includes(top)) {
      throw new RuntimeError("WORKSPACE_DENIED", `${op}: '${top}/' is not writable/readable: ${relPath}`);
    }
    if ((op === "write" || op === "patch") && SECRET_PATH_RE.test(rel)) {
      throw new RuntimeError("WORKSPACE_SECRET_PATH", `${op}: refusing to write a secret-like path: ${relPath}`);
    }
    return abs;
  }

  // --- file operations ------------------------------------------------------

  read(relPath: string): string {
    const abs = this.safePath(relPath, "read");
    if (!existsSync(abs)) throw new RuntimeError("WORKSPACE_NOT_FOUND", `read: ${relPath} does not exist`);
    return readFileSync(abs, "utf8");
  }

  list(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".git") continue;
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else out.push(relative(this.root, abs));
      }
    };
    walk(this.root);
    return out.sort();
  }

  /** Key files a model needs to understand the fixture, bounded in size. */
  keyFiles(maxBytesEach = 4000): WorkspaceFile[] {
    return this.list()
      .filter((p) => /\.(js|ts|json|md)$/.test(p) && !p.includes("package-lock"))
      .slice(0, 12)
      .map((p) => ({ path: p, content: this.read(p).slice(0, maxBytesEach) }));
  }

  write(relPath: string, content: string): void {
    if (typeof content !== "string") {
      throw new RuntimeError("WORKSPACE_WRITE", `write: content must be a string for ${relPath}`);
    }
    const abs = this.safePath(relPath, "write");
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  patch(relPath: string, find: string, replace: string): void {
    const abs = this.safePath(relPath, "patch");
    if (!existsSync(abs)) throw new RuntimeError("WORKSPACE_NOT_FOUND", `patch: ${relPath} does not exist`);
    const before = readFileSync(abs, "utf8");
    if (!find || !before.includes(find)) {
      throw new RuntimeError("WORKSPACE_PATCH_MISS", `patch: 'find' text not present in ${relPath}`);
    }
    writeFileSync(abs, before.replace(find, replace));
  }

  // --- command execution ---------------------------------------------------

  classifyCommand(command: string): CommandClass {
    const c = command.trim();
    if (HARD_BLOCK_CMD.some((re) => re.test(c))) return "DESTRUCTIVE";
    if (/\b(kubectl|terraform|tofu)\b/.test(c) || /\bdeploy\b/.test(c)) return "PRODUCTION_WRITE";
    if (/\b(curl|wget|nc|ssh|scp|gh)\b/.test(c)) return "EXTERNAL_WRITE";
    if (/\bnpm\s+(ci|install|i|test)\b/.test(c) || /\bnode\s+--test\b/.test(c) || /\bnpm\s+run\b/.test(c)) {
      return "DEVELOPMENT_WRITE";
    }
    return "READ_ONLY";
  }

  async exec(command: string): Promise<WorkspaceExecResult> {
    const started = Date.now();
    const c = command.trim();
    const classification = this.classifyCommand(c);

    if (
      HARD_BLOCK_CMD.some((re) => re.test(c)) ||
      classification === "DESTRUCTIVE" ||
      classification === "PRODUCTION_WRITE" ||
      classification === "EXTERNAL_WRITE" ||
      classification === "FINANCIAL"
    ) {
      return {
        command: c,
        classification,
        allowed: false,
        exitCode: 126,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - started,
        blockReason: `command classified ${classification}; the proof permits safe DEVELOPMENT commands only`,
      };
    }
    if (!ALLOWED_CMD.some((re) => re.test(c))) {
      return {
        command: c,
        classification,
        allowed: false,
        exitCode: 126,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - started,
        blockReason: "command is not in the proof development allow-list (npm test|lint|typecheck|build, npm ci/install, node --test)",
      };
    }

    if (!this.gitReady) this.ensureGit();

    const [bin, ...args] = c.split(/\s+/);
    try {
      const { stdout, stderr } = await run(bin!, args, {
        cwd: this.root,
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          PATH: process.env.PATH ?? "",
          HOME: this.root,
          NODE_ENV: "test",
          npm_config_offline: "true",
          npm_config_audit: "false",
          npm_config_fund: "false",
          AI_COMPANY_PROOF_WORKSPACE: "1",
        },
      });
      return {
        command: c,
        classification,
        allowed: true,
        exitCode: 0,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const e = err as { code?: number; stdout?: string; stderr?: string };
      return {
        command: c,
        classification,
        allowed: true,
        exitCode: typeof e.code === "number" ? e.code : 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(err),
        durationMs: Date.now() - started,
      };
    }
  }

  // --- git diff ------------------------------------------------------------

  private ensureGit(): void {
    try {
      execFileSyncQuiet("git", ["init", "-q"], this.root);
      execFileSyncQuiet("git", ["config", "user.email", "proof@ai-software-company.local"], this.root);
      execFileSyncQuiet("git", ["config", "user.name", "proof-runtime"], this.root);
      execFileSyncQuiet("git", ["add", "-A"], this.root);
      execFileSyncQuiet("git", ["commit", "-q", "-m", "proof: seed fixture", "--no-verify"], this.root);
      this.gitReady = true;
    } catch {
      this.gitReady = false;
    }
  }

  /** Unified diff of everything changed since the seed commit. */
  diff(): string {
    if (!this.gitReady) this.ensureGit();
    if (!this.gitReady) return "(git unavailable; diff not computed)";
    try {
      execFileSyncQuiet("git", ["add", "-A"], this.root);
      const out = execFileSyncCapture("git", ["diff", "--cached", "--stat", "-p"], this.root);
      return out.trim() || "(no changes)";
    } catch (err) {
      return `(diff failed: ${String(err)})`;
    }
  }

  hasChanges(): boolean {
    const d = this.diff();
    return d !== "(no changes)" && !d.startsWith("(git unavailable");
  }

  dispose(keepArtifacts = true): void {
    if (!keepArtifacts) rmSync(this.root, { recursive: true, force: true });
  }
}

// Minimal sync child_process helpers kept local so proof-workspace has no extra deps.
function execFileSyncQuiet(bin: string, args: string[], cwd: string): void {
  execFileSync(bin, args, { cwd, stdio: "ignore" });
}
function execFileSyncCapture(bin: string, args: string[], cwd: string): string {
  return execFileSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}
