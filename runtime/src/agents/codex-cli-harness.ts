import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redactString } from "../core/redaction.ts";

/**
 * PREMIUM implementation harness backed by the locally authenticated Codex CLI
 * (ChatGPT login), NOT the paid OpenAI API (build spec: model-tier escalation;
 * Human Founder authorization required).
 *
 * This is not an HTTP `ModelProvider`. It is a bounded, non-interactive shell to
 * the `codex exec` command. It:
 *   - never reads or copies Codex auth material (`~/.codex/auth.json` is never
 *     touched); readiness is probed only through `codex login status`;
 *   - runs `codex exec` with **stdin closed** (`/dev/null`). Codex CLI 0.152.1
 *     reads a *piped* stdin to EOF to append it as a `<stdin>` block; an open
 *     pipe that never closes (the default for `child_process.execFile`) makes
 *     Codex hang forever in "Reading additional input from stdin...". `spawn`
 *     with `stdio[0] = "ignore"` gives an immediate EOF and Codex proceeds.
 *   - runs in `--sandbox workspace-write` confined to the disposable proof
 *     workspace (the minimum needed to let Codex edit files there - NOT a global
 *     sandbox bypass), `--ephemeral` (no session files), `--json` for structured
 *     events, bounded wall-clock timeout;
 *   - on timeout kills the whole **process group** (SIGKILL) so Codex's sandbox
 *     helper descendants never survive the parent;
 *   - unsets `OPENAI_API_KEY` for the child so Codex uses the ChatGPT login and
 *     never an (empty-credit) API key;
 *   - returns a classified structured result. The runtime's own deterministic
 *     gates decide PASS/FAIL afterwards - Codex declaring success is never
 *     sufficient.
 */

const run = promisify(execFile);

/** Process-level classification of one `codex exec` run. */
export type CodexRunStatus =
  | "CODEX_SUCCESS" // exit 0
  | "CODEX_TIMEOUT" // killed at the wall-clock cap
  | "CODEX_AUTH_REQUIRED" // not logged in / auth expired
  | "CODEX_APPROVAL_BLOCKED" // an action needed interactive approval Codex could not get
  | "CODEX_PROCESS_ERROR"; // non-zero exit for any other reason
// (CODEX_NO_WORKSPACE_CHANGE is decided by the caller from the workspace diff.)

/** Non-secret Codex readiness. */
export interface CodexDetection {
  /** `codex` resolves on PATH and `codex --version` succeeded. */
  available: boolean;
  /** `codex login status` reports an authenticated ChatGPT session. */
  loggedIn: boolean;
  /** e.g. "codex-cli 0.152.1", or null. */
  version: string | null;
  /** Founder-readable one-liner (never a secret). */
  reason: string;
}

export interface CodexExecResult {
  status: CodexRunStatus;
  exitCode: number;
  timedOut: boolean;
  /** True if the harness had to SIGKILL the process group at the deadline. */
  killedProcessTree: boolean;
  /** The agent's final message (`codex exec -o`, else parsed from --json), bounded + redacted. */
  lastMessage: string;
  /** Bounded, redacted tail of combined stdout/stderr for the audit. */
  stdoutTail: string;
  durationMs: number;
  /** The exact argv used (no secrets - the key is unset, not passed). */
  invocation: string;
}

type ExecFn = (
  file: string,
  args: string[],
  opts: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

/** Low-level runner for one `codex exec` (stdin closed, process-tree-killed). Injectable for tests. */
export type CodexRunExecFn = (
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
) => Promise<{ exitCode: number; timedOut: boolean; killedProcessTree: boolean; stdout: string; stderr: string }>;

export interface CodexCliHarnessOptions {
  /** Injected exec for `detect()` (version + login status); defaults to child_process.execFile. */
  exec?: ExecFn;
  /** Injected `codex exec` runner; defaults to a real `spawn` with stdin closed + process-tree kill. */
  runExec?: CodexRunExecFn;
  /** Injected env; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Wall-clock cap for one `codex exec` run (ms). Default 15 min. */
  timeoutMs?: number;
  /** Optional model override (`codex exec -m <model>`); omit to use the account default. */
  model?: string;
  /** Directory for the transient `-o` last-message file (never the workspace). */
  scratchDir?: string;
}

const LAST_MSG_BYTES = 4000;
const STDOUT_TAIL_BYTES = 8000;
const OUTPUT_HARD_CAP = 8 * 1024 * 1024;

/**
 * Default `codex exec` runner. `spawn`, NOT `execFile`:
 *   - `stdio: ["ignore", "pipe", "pipe"]` -> child stdin is /dev/null -> Codex
 *     sees EOF immediately and never hangs in "Reading additional input";
 *   - `detached: true` -> the child leads its own process group, so at the
 *     deadline `process.kill(-pid, "SIGKILL")` reaps Codex AND its descendants.
 */
/**
 * Spawn `command` with stdin closed and its own process group, capturing bounded
 * stdout/stderr, and on `timeoutMs` killing the WHOLE group (SIGTERM then
 * SIGKILL). Exported so a regression test can drive it with a stub binary.
 */
export function runViaSpawn(
  command: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<{ exitCode: number; timedOut: boolean; killedProcessTree: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    const cap = (s: string, add: string) => (s.length < OUTPUT_HARD_CAP ? s + add : s);
    child.stdout?.on("data", (d) => (stdout = cap(stdout, String(d))));
    child.stderr?.on("data", (d) => (stderr = cap(stderr, String(d))));

    let timedOut = false;
    let killedProcessTree = false;
    const killTree = (sig: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, sig);
      } catch {
        try {
          child.kill(sig);
        } catch {
          /* already gone */
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killedProcessTree = true;
      killTree("SIGTERM");
      // hard stop shortly after, in case SIGTERM is ignored
      setTimeout(() => killTree("SIGKILL"), 3_000).unref();
    }, opts.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 127, timedOut, killedProcessTree, stdout, stderr: `${stderr}\n${String(err)}` });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const exitCode = typeof code === "number" ? code : timedOut ? 124 : signal ? 137 : 1;
      resolve({ exitCode, timedOut, killedProcessTree, stdout, stderr });
    });
  });
}

/**
 * Default `codex exec` runner. `spawn`, NOT `execFile`:
 *   - `stdio: ["ignore", "pipe", "pipe"]` -> child stdin is /dev/null -> Codex
 *     sees EOF immediately and never hangs in "Reading additional input";
 *   - its own process group -> at the deadline the whole tree is reaped.
 */
export const defaultRunExec: CodexRunExecFn = (args, opts) => runViaSpawn("codex", args, opts);

export class CodexCliHarness {
  private readonly exec: ExecFn;
  private readonly runExec: CodexRunExecFn;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private readonly model?: string;
  private readonly scratchDir: string;

  constructor(opts: CodexCliHarnessOptions = {}) {
    this.exec = opts.exec ?? (run as unknown as ExecFn);
    this.runExec = opts.runExec ?? defaultRunExec;
    this.env = opts.env ?? process.env;
    this.timeoutMs = opts.timeoutMs && opts.timeoutMs > 0 ? Math.floor(opts.timeoutMs) : 15 * 60_000;
    this.model = opts.model;
    this.scratchDir = opts.scratchDir ?? tmpdir();
  }

  /**
   * Env for the Codex child: a copy of the harness env with OPENAI_API_KEY
   * REMOVED so Codex authenticates via the stored ChatGPT login only.
   */
  private childEnv(): NodeJS.ProcessEnv {
    const e: NodeJS.ProcessEnv = { ...this.env };
    delete e.OPENAI_API_KEY;
    return e;
  }

  /** Probe availability + ChatGPT-login readiness. Never reads auth files. */
  async detect(): Promise<CodexDetection> {
    let version: string | null = null;
    try {
      const v = await this.exec("codex", ["--version"], { timeout: 15_000, env: this.childEnv() });
      version = (v.stdout || v.stderr).trim().split("\n")[0]?.trim() || null;
    } catch (err) {
      return {
        available: false,
        loggedIn: false,
        version: null,
        reason: `codex CLI not available: ${redactString(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
      };
    }
    try {
      const s = await this.exec("codex", ["login", "status"], { timeout: 15_000, env: this.childEnv() });
      const out = `${s.stdout}\n${s.stderr}`;
      const loggedIn = /logged in using chatgpt/i.test(out);
      return {
        available: true,
        loggedIn,
        version,
        reason: loggedIn
          ? `${version} - authenticated ChatGPT session`
          : `${version} present but not logged in with ChatGPT (run 'codex login')`,
      };
    } catch (err) {
      return {
        available: true,
        loggedIn: false,
        version,
        reason: `codex login status failed: ${redactString(err instanceof Error ? err.message : String(err)).slice(0, 200)}`,
      };
    }
  }

  /**
   * Run one bounded, non-interactive Codex implementation pass against the
   * disposable proof workspace. Codex edits files directly; the caller validates
   * afterwards with the runtime's deterministic gates.
   */
  async runImplementation(opts: { workspaceRoot: string; prompt: string }): Promise<CodexExecResult> {
    const started = Date.now();
    const outDir = mkdtempSync(join(this.scratchDir, "codex-out-"));
    const outFile = join(outDir, "last-message.txt");
    const args = [
      "exec",
      "--cd",
      opts.workspaceRoot,
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
      "--json",
      "-o",
      outFile,
      ...(this.model ? ["-m", this.model] : []),
      opts.prompt,
    ];
    const invocation = `env -u OPENAI_API_KEY codex ${args.slice(0, -1).join(" ")} "<prompt>" </dev/null`;

    const r = await this.runExec(args, {
      cwd: opts.workspaceRoot,
      env: this.childEnv(),
      timeoutMs: this.timeoutMs,
    });
    const combined = `${r.stdout}\n${r.stderr}`;

    let lastMessage = "";
    try {
      lastMessage = readFileSync(outFile, "utf8");
    } catch {
      /* no -o file */
    }
    if (!lastMessage.trim()) lastMessage = lastAssistantMessageFromJson(r.stdout);
    rmSync(outDir, { recursive: true, force: true });

    return {
      status: classifyCodexRun(r.exitCode, r.timedOut, combined),
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      killedProcessTree: r.killedProcessTree,
      lastMessage: redactString(lastMessage).trim().slice(0, LAST_MSG_BYTES),
      stdoutTail: redactString(combined).replace(/\n{3,}/g, "\n\n").trim().slice(-STDOUT_TAIL_BYTES),
      durationMs: Date.now() - started,
      invocation,
    };
  }
}

/** Classify a finished `codex exec` from its exit code + output (no secrets in the output). */
export function classifyCodexRun(exitCode: number, timedOut: boolean, output: string): CodexRunStatus {
  if (timedOut) return "CODEX_TIMEOUT";
  if (exitCode === 0) return "CODEX_SUCCESS";
  const o = output.toLowerCase();
  if (/not logged in|login required|auth(?:entication)? (?:required|expired|failed)|re-?authenticate|please run ['"]?codex login/.test(o)) {
    return "CODEX_AUTH_REQUIRED";
  }
  if (/needs approval|requires approval|approval (?:required|blocked)|not permitted by the sandbox|sandbox denied|permission denied .*sandbox|awaiting approval/.test(o)) {
    return "CODEX_APPROVAL_BLOCKED";
  }
  return "CODEX_PROCESS_ERROR";
}

/** Best-effort final assistant text from a `codex exec --json` stdout stream. */
function lastAssistantMessageFromJson(stdout: string): string {
  let msg = "";
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const j = JSON.parse(t) as { type?: string; item?: { type?: string; text?: string; content?: unknown } };
      const item = j.item;
      if (!item) continue;
      const text =
        typeof item.text === "string"
          ? item.text
          : Array.isArray(item.content)
            ? (item.content as { text?: string }[]).map((c) => c.text ?? "").join("")
            : "";
      if ((j.type === "item.completed" || j.type === "item.updated") && text) msg = text;
    } catch {
      /* not a json event */
    }
  }
  return msg;
}
