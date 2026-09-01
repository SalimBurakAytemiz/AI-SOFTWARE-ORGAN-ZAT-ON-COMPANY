import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  cpSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import type { CommandClass } from "../core/types.ts";
import type { Sandbox, ExecResult } from "./sandbox.ts";

const run = promisify(execFile);

// Commands that are refused outright regardless of classification.
const HARD_BLOCK = [
  /\brm\s+-rf?\s+\/(?:\s|$)/, // rm -rf /
  /\b(mkfs|dd)\b/,
  /:\(\)\s*\{/, // fork bomb
  /\bshutdown\b|\breboot\b/,
  /\bcurl\b[^|]*\|\s*(sh|bash)\b/, // curl | sh
  /\bgit\s+push\b/, // no pushes from a sandbox
  /\bsudo\b/,
];

const DESTRUCTIVE = [/\brm\s+-rf?\b/, /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, /\bdrop\s+(table|database)\b/i, /\btruncate\b/i];
const EXTERNAL = [/\b(curl|wget|nc|ssh|scp)\b/, /\bnpm\s+publish\b/, /\bgh\s+/];
const WRITE = [/\b(npm|pnpm|yarn)\s+(install|i|ci|add)\b/, /\bmkdir\b/, /\btouch\b/, />>?/, /\bgit\s+(commit|add|checkout|branch|switch)\b/];

/**
 * A local sandbox: an isolated temp workspace, an allow-list execution model, and
 * hard blocks on destructive / production / network-egress commands. Not a security
 * boundary against hostile code - it is a guard rail for V1's deterministic proof
 * flow. MicroVM isolation (E2B) is the production answer and plugs in here.
 */
export class LocalSandbox implements Sandbox {
  readonly kind = "local";
  readonly workspace: string;
  private disposed = false;

  constructor(opts: { seedFrom?: string; root?: string } = {}) {
    const base = opts.root ?? mkdtempSync(join(tmpdir(), "ai-company-sbx-"));
    this.workspace = resolve(base);
    mkdirSync(this.workspace, { recursive: true });
    if (opts.seedFrom && existsSync(opts.seedFrom)) {
      cpSync(opts.seedFrom, this.workspace, { recursive: true });
    }
  }

  classify(command: string): CommandClass {
    if (HARD_BLOCK.some((re) => re.test(command))) return "DESTRUCTIVE";
    if (DESTRUCTIVE.some((re) => re.test(command))) return "DESTRUCTIVE";
    if (/\b(deploy|kubectl\s+apply|terraform\s+apply|tofu\s+apply)\b/.test(command)) {
      return "PRODUCTION_WRITE";
    }
    if (EXTERNAL.some((re) => re.test(command))) return "EXTERNAL_WRITE";
    if (WRITE.some((re) => re.test(command))) return "DEVELOPMENT_WRITE";
    return "READ_ONLY";
  }

  async exec(command: string, opts: { allowWrite?: boolean } = {}): Promise<ExecResult> {
    this.assertLive();
    const started = Date.now();
    const cls = this.classify(command);

    if (
      HARD_BLOCK.some((re) => re.test(command)) ||
      cls === "DESTRUCTIVE" ||
      cls === "PRODUCTION_WRITE" ||
      cls === "EXTERNAL_WRITE"
    ) {
      return {
        command,
        exitCode: 126,
        stdout: "",
        stderr: `blocked: '${command}' classified ${cls}`,
        duration_ms: Date.now() - started,
        blocked: true,
        blockReason: `classified ${cls}; the local sandbox permits READ_ONLY and DEVELOPMENT_WRITE only`,
      };
    }
    if (cls === "DEVELOPMENT_WRITE" && !opts.allowWrite) {
      return {
        command,
        exitCode: 126,
        stdout: "",
        stderr: `blocked: '${command}' is DEVELOPMENT_WRITE and allowWrite was not granted`,
        duration_ms: Date.now() - started,
        blocked: true,
        blockReason: "caller did not pass allowWrite",
      };
    }

    try {
      const { stdout, stderr } = await run("bash", ["-lc", command], {
        cwd: this.workspace,
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          PATH: process.env.PATH ?? "",
          HOME: this.workspace,
          AI_COMPANY_SANDBOX: "1",
        },
      });
      return {
        command,
        exitCode: 0,
        stdout,
        stderr,
        duration_ms: Date.now() - started,
        blocked: false,
      };
    } catch (err) {
      const e = err as { code?: number; stdout?: string; stderr?: string };
      return {
        command,
        exitCode: typeof e.code === "number" ? e.code : 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(err),
        duration_ms: Date.now() - started,
        blocked: false,
      };
    }
  }

  readFile(relPath: string): string {
    return readFileSync(this.safe(relPath), "utf8");
  }

  writeFile(relPath: string, content: string): void {
    this.assertLive();
    const abs = this.safe(relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  listFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".git") continue;
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else out.push(relative(this.workspace, abs));
      }
    };
    walk(this.workspace);
    return out.sort();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    rmSync(this.workspace, { recursive: true, force: true });
  }

  private safe(relPath: string): string {
    if (isAbsolute(relPath)) {
      throw new Error(`sandbox paths must be relative: ${relPath}`);
    }
    const abs = resolve(this.workspace, relPath);
    if (abs !== this.workspace && !abs.startsWith(this.workspace + "/")) {
      throw new Error(`path escapes sandbox workspace: ${relPath}`);
    }
    return abs;
  }

  private assertLive(): void {
    if (this.disposed) throw new Error("sandbox has been disposed");
  }
}
