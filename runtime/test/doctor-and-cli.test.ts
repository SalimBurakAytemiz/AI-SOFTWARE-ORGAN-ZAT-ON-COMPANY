import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { memoryRuntime } from "./helpers.ts";
import { doctor } from "../src/core/doctor.ts";

const run = promisify(execFile);
const BIN = resolve(fileURLToPath(import.meta.url), "..", "..", "bin", "ai-company.js");

test("doctor reports healthy and never fails on optional/deferred systems", () => {
  const rt = memoryRuntime();
  try {
    const report = doctor(rt);
    assert.equal(report.healthy, true);
    const deferred = report.checks.filter((c) => c.status === "DEFERRED");
    assert.ok(deferred.length >= 3);
    assert.equal(report.checks.some((c) => c.status === "FAIL"), false);
    assert.ok(report.checks.some((c) => c.name === "mock provider" && c.status === "OK"));
  } finally {
    rt.close();
  }
});

test("CLI: doctor, agents list, workflows list and proof run offline with no API key", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ai-company-cli-"));
  const env: NodeJS.ProcessEnv = { ...process.env, AI_COMPANY_DATA_DIR: dataDir };
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENAI_API_KEY;
  delete env.AI_COMPANY_LITELLM_BASE_URL;
  try {
    const doctorOut = await run("node", [BIN, "doctor"], { env });
    assert.match(doctorOut.stdout, /healthy/);

    const agentsOut = await run("node", [BIN, "agents", "list"], { env });
    assert.match(agentsOut.stdout, /backend-engineer/);
    assert.match(agentsOut.stdout, /senior-code-reviewer/);

    const wfOut = await run("node", [BIN, "workflows", "list"], { env });
    assert.match(wfOut.stdout, /feature-development/);

    const proofOut = await run("node", [BIN, "proof"], { env });
    assert.match(proofOut.stdout, /HUMAN_APPROVAL_REQUIRED/);
    assert.match(proofOut.stdout, /PASS:/);

    const statusOut = await run("node", [BIN, "status"], { env });
    assert.match(statusOut.stdout, /pending approvals\s+1/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("CLI: task run classifies and drives to the approval gate", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ai-company-cli-"));
  const env = { ...process.env, AI_COMPANY_DATA_DIR: dataDir };
  try {
    const out = await run(
      "node",
      [BIN, "task", "run", "fix the broken pagination defect on the list endpoint"],
      { env },
    );
    assert.match(out.stdout, /bugfix/);
    assert.match(out.stdout, /AWAITING HUMAN FOUNDER/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
