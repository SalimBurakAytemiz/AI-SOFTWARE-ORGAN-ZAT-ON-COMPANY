import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Runtime, type RuntimeOptions } from "../src/runtime.ts";
import { fixedClock } from "../src/core/clock.ts";

export function memoryRuntime(opts: Partial<RuntimeOptions> = {}): Runtime {
  return Runtime.create({
    storePath: ":memory:",
    clock: fixedClock("2026-09-01T00:00:00.000Z"),
    ...opts,
  });
}

export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "ai-company-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Create + classify + drive a task, returning the run. */
export async function runTask(rt: Runtime, instruction: string) {
  const task = rt.orchestrator.tasks.create({ title: instruction.slice(0, 60), description: instruction });
  const { run, classification } = rt.orchestrator.plan(task);
  const result = await rt.orchestrator.drive(run.id);
  return { task, ...result, classification };
}
