import type { CommandClass } from "../core/types.ts";

// Sandbox abstraction (build spec section 23). V1 ships a local, working-directory
// bounded sandbox. Daytona / E2B are future adapters behind this same interface;
// none is a dependency of V1.

export interface ExecResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  blocked: boolean;
  blockReason?: string;
}

export interface Sandbox {
  readonly kind: string;
  /** Absolute path the sandbox confines all file operations to. */
  readonly workspace: string;
  classify(command: string): CommandClass;
  exec(command: string, opts?: { allowWrite?: boolean }): Promise<ExecResult>;
  readFile(relPath: string): string;
  writeFile(relPath: string, content: string): void;
  listFiles(): string[];
  dispose(): void;
}
