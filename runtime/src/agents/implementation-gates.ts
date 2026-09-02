import type { ProofWorkspace } from "../proof/proof-workspace.ts";
import { looksLikeSecret } from "../core/redaction.ts";

/**
 * Deterministic implementation-stage quality gates (build spec sections 22, 23).
 *
 * ONE source of truth, used by BOTH the free/paid-API model runner
 * (`RealAgentRunner`) and the Codex CLI premium harness. The model - or Codex -
 * declaring success is never sufficient: the outcome is decided here from
 * machine evidence only. Nothing in this module weakens a gate; it exists so the
 * two implementation paths cannot drift apart.
 */

export interface TestEvidence {
  command: string;
  exitCode: number;
  passed: number;
  failed: number;
  ran: boolean;
}

export interface SecurityCheck {
  check: string;
  result: string;
  detail: string;
}

/** Is this a changed *source* file (a `.js/.ts/...` NOT under a test path)? */
export function isSourceFile(p: string): boolean {
  return (
    /\.(m?js|cjs|ts)$/.test(p) &&
    !/(^|\/)tests?\//.test(p) &&
    !/\.(test|spec)\./.test(p) &&
    !/-test\./.test(p)
  );
}

/** Is this a changed *test* file the project's runner would discover? */
export function isTestFile(p: string): boolean {
  return (
    /(^|\/)test\//.test(p) ||
    /\.(test|spec)\.(m?js|cjs|ts)$/.test(p) ||
    /-test\.(m?js|cjs|ts)$/.test(p)
  );
}

/**
 * Parse `node --test` summary lines for pass/fail counts. Node's reporter has
 * used both `# pass 1` (TAP) and `ℹ pass 1` (spec) formats across versions.
 */
export function parseNodeTestCounts(output: string): { pass: number; fail: number } {
  const pass = Number(
    output.match(/(?:#|ℹ)\s*pass\s+(\d+)/)?.[1] ?? output.match(/(\d+)\s+passing/)?.[1] ?? 0,
  );
  const fail = Number(
    output.match(/(?:#|ℹ)\s*fail\s+(\d+)/)?.[1] ?? output.match(/(\d+)\s+failing/)?.[1] ?? 0,
  );
  return { pass: Number.isFinite(pass) ? pass : 0, fail: Number.isFinite(fail) ? fail : 0 };
}

/** Deterministic security checks on the workspace diff (never trust prose). */
export function deterministicSecurityChecks(ws: ProofWorkspace): SecurityCheck[] {
  const diff = ws.diff();
  const checks: SecurityCheck[] = [];

  checks.push({
    check: "no-secret-in-diff",
    result: looksLikeSecret(diff) ? "FAIL" : "PASS",
    detail: looksLikeSecret(diff)
      ? "secret-like material detected in the change"
      : "no secret material in the change",
  });

  const addedDeps = /^\+.*"dependencies"|^\+\s*"[^"]+":\s*"\^?\d/m.test(diff);
  checks.push({
    check: "no-new-runtime-dependency",
    result: addedDeps ? "FAIL" : "PASS",
    detail: addedDeps
      ? "the change adds a runtime dependency (review required)"
      : "no new runtime dependency",
  });

  const dangerous = /^\+.*(child_process|eval\(|new Function\(|vm\.runIn)/m.test(diff);
  checks.push({
    check: "no-dangerous-api-introduced",
    result: dangerous ? "FAIL" : "PASS",
    detail: dangerous ? "change introduces child_process/eval/vm" : "no dangerous dynamic-execution API introduced",
  });

  return checks;
}

export interface ImplGateDecisionInput {
  /** Workspace-relative paths this stage changed (git diff / executed tool writes). */
  changedFiles: string[];
  /** Did the implementer attempt any change at all (fileChanges emitted / Codex ran)? */
  hadChangeAttempt: boolean;
  /** `workspace.hasChanges()` - the real git diff vs the seed. */
  workspaceHasChanges: boolean;
  /** Whether `plan.requireInSource` is present in the workspace source (null = no such requirement). */
  sourceContainsRequired: boolean | null;
  testEvidence: TestEvidence | null;
  securityChecks: SecurityCheck[] | null;
  plan: {
    requireWorkspaceChange: boolean;
    requireTestChange?: boolean;
    requireInSource?: string;
    restrictStatusTo?: ("READY_FOR_HUMAN_APPROVAL" | "BLOCKED")[];
  };
  /** The implementer's self-declared status (PASS by default for a harness). */
  baseStatus: "PASS" | "FAIL" | "BLOCKED";
}

export interface ImplGateDecision {
  outcome: "PASS" | "FAIL" | "BLOCKED";
  enforcementNotes: string[];
}

/**
 * Decide the enforced implementation outcome from machine evidence ONLY. Pure -
 * no I/O. The exact same checks and messages the RealAgentRunner has always
 * applied; extracting them keeps the Codex CLI path identical.
 */
export function decideImplementationOutcome(input: ImplGateDecisionInput): ImplGateDecision {
  const { changedFiles, plan, testEvidence, securityChecks } = input;
  const notes: string[] = [];
  let outcome: "PASS" | "FAIL" | "BLOCKED" =
    input.baseStatus === "BLOCKED" ? "BLOCKED" : input.baseStatus === "FAIL" ? "FAIL" : "PASS";

  const wroteSource = changedFiles.some(isSourceFile);
  const wroteTest = changedFiles.some(isTestFile);

  if (plan.requireWorkspaceChange && !input.hadChangeAttempt && changedFiles.length === 0) {
    outcome = "BLOCKED";
    notes.push("blocked: a code stage must deliver its change as `fileChanges` entries - none were provided");
  }
  if (plan.requireWorkspaceChange && !wroteSource && changedFiles.length > 0) {
    outcome = "BLOCKED";
    notes.push(`blocked: no source file was changed (only wrote: ${changedFiles.join(", ") || "nothing"})`);
  }
  if (plan.requireTestChange && !wroteTest) {
    outcome = "BLOCKED";
    notes.push(
      "blocked: acceptance requires an automated test, but no test file was added or updated " +
        "(a test must live under `test/` or be named `*.test.*` for the runner to discover it)",
    );
  }
  if (plan.requireWorkspaceChange && !input.workspaceHasChanges) {
    outcome = "BLOCKED";
    notes.push("blocked: stage was required to change the workspace but produced no diff");
  }
  if (plan.requireInSource && input.sourceContainsRequired === false) {
    outcome = "BLOCKED";
    notes.push(`blocked: required token '${plan.requireInSource}' not found in workspace source`);
  }
  if (testEvidence && (testEvidence.exitCode !== 0 || testEvidence.failed > 0 || !testEvidence.ran)) {
    outcome = "FAIL";
    notes.push(
      `fail: npm test exit=${testEvidence.exitCode} failed=${testEvidence.failed} ran=${testEvidence.ran}`,
    );
  }
  if (testEvidence && testEvidence.exitCode === 0 && testEvidence.passed === 0) {
    outcome = "FAIL";
    notes.push("fail: no tests were executed (0 passing) - acceptance requires automated tests");
  }
  if (securityChecks && securityChecks.some((c) => c.result === "FAIL")) {
    outcome = "FAIL";
    notes.push("fail: deterministic security check failed");
  }
  if (plan.restrictStatusTo) {
    notes.push(`release verdict: ${outcome === "PASS" ? "READY_FOR_HUMAN_APPROVAL" : "BLOCKED"}`);
  }

  return { outcome, enforcementNotes: notes };
}

/**
 * Run the full deterministic implementation-stage validation against the current
 * workspace state (npm test + security checks + the gate decision). Used by the
 * Codex CLI premium harness after Codex has written its change. The
 * RealAgentRunner keeps its own npm-test loop (it interleaves a model repair)
 * but shares `decideImplementationOutcome` + `deterministicSecurityChecks`.
 */
export async function evaluateImplementationGates(opts: {
  workspace: ProofWorkspace;
  changedFiles: string[];
  hadChangeAttempt: boolean;
  runTests: boolean;
  runSecurityScan: boolean;
  plan: ImplGateDecisionInput["plan"];
}): Promise<{
  outcome: "PASS" | "FAIL" | "BLOCKED";
  enforcementNotes: string[];
  testEvidence: TestEvidence | null;
  securityChecks: SecurityCheck[] | null;
  testStdoutTail: string;
}> {
  const { workspace, plan } = opts;

  let testEvidence: TestEvidence | null = null;
  let testStdoutTail = "";
  if (opts.runTests) {
    const res = await workspace.exec("npm test");
    const counts = parseNodeTestCounts(res.stdout + "\n" + res.stderr);
    testEvidence = {
      command: "npm test",
      exitCode: res.exitCode,
      passed: counts.pass,
      failed: counts.fail,
      ran: res.allowed,
    };
    testStdoutTail = `${res.stdout}\n${res.stderr}`.replace(/\s+$/g, "").slice(-1800);
  }

  const securityChecks = opts.runSecurityScan ? deterministicSecurityChecks(workspace) : null;

  let sourceContainsRequired: boolean | null = null;
  if (plan.requireInSource) {
    sourceContainsRequired = workspace
      .list()
      .some((p) => {
        if (!/\.(js|ts)$/.test(p)) return false;
        try {
          return workspace.read(p).includes(plan.requireInSource!);
        } catch {
          return false;
        }
      });
  }

  const decision = decideImplementationOutcome({
    changedFiles: opts.changedFiles,
    hadChangeAttempt: opts.hadChangeAttempt,
    workspaceHasChanges: workspace.hasChanges(),
    sourceContainsRequired,
    testEvidence,
    securityChecks,
    plan,
    baseStatus: "PASS",
  });

  return {
    outcome: decision.outcome,
    enforcementNotes: decision.enforcementNotes,
    testEvidence,
    securityChecks,
    testStdoutTail,
  };
}
