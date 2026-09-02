import type { AgentDefinition, WorkflowStep, Task, WorkflowDefinition } from "../core/types.ts";
import type { Registries } from "../registry/index.ts";
import type { ProjectFacts } from "../proof/proof-workspace.ts";

/**
 * Reusable agent prompt / context assembler (build spec sections 11, 20, 25).
 *
 * There are NOT eighteen hand-written giant prompts. One assembler builds a
 * bounded context for any agent from: the company constitution constraints, the
 * agent's role, its skills, the task, the workflow stage, the relevant
 * prior-stage artifacts, the tools it is allowed to request, the required output
 * schema, its quality gates, the security constraints, and the Human Founder
 * authority. The whole repository is never dumped into a prompt.
 */

export interface StageInput {
  reg: Registries;
  agent: AgentDefinition;
  workflow: WorkflowDefinition;
  step: WorkflowStep;
  task: Task;
  /** Digest of prior stage artifacts, already selected by the caller. */
  priorArtifacts: { stage: string; agentId: string; path: string; excerpt: string }[];
  /** Runtime tool names this stage may request (adjudicated later by the gateway). */
  allowedRuntimeTools: string[];
  /** Optional: a unified diff of the proof workspace, for review/QA/security stages. */
  workspaceDiff?: string;
  /** Optional: a file listing / key file contents for the implementation stage. */
  workspaceFiles?: { path: string; content: string }[];
  /**
   * Optional: deterministic, runtime-computed facts about the target project
   * (module system, test command + discovery rule, entrypoint, existing tests).
   * Rendered as AUTHORITATIVE so the model never guesses the stack and is told
   * to ignore any earlier stage that described it differently.
   */
  projectFacts?: ProjectFacts;
  /**
   * Optional: stage-specific, acceptance-critical directives the caller derives
   * from the StagePlan (e.g. "this is a code stage - apply changes via tool
   * calls, not artifacts"). Rendered verbatim near the output contract.
   */
  stageDirectives?: string[];
  /** Hard cap on assembled context size in bytes (build spec section 21). */
  contextBudgetBytes?: number;
}

export interface AssembledPrompt {
  system: string;
  prompt: string;
  contextBytes: number;
  sections: string[];
  truncated: string[];
}

const CONSTITUTION_CONSTRAINTS = [
  "The Human Founder is the supreme authority. You are an employee, not an owner.",
  "You may analyze, plan, propose and PREPARE critical actions - never execute them.",
  "Critical actions (production deploy, merge to protected main, production DB migration, " +
    "production infra change, secret create/rotate, payment-config change, real financial " +
    "transaction, bulk customer messaging, customer-data export, access-control escalation, " +
    "critical security architecture change) STOP and wait for explicit Human Founder approval.",
  "Default deny. Least privilege. You may only request tools you were granted.",
  "Never output a secret, API key, credential or customer PII.",
  "This is a disposable, isolated proof. No production system, no real customer data, no money.",
];

const OUTPUT_CONTRACT = `Respond with EXACTLY ONE JSON object and nothing else: no prose before or after,
no markdown fence, no comments. Every field below is required (use [] or null,
never omit a field). Fields:

{
  "status": "PASS" | "FAIL" | "BLOCKED",
  "summary": "<= 300 chars: what you did and the outcome",
  "reasoningSummary": "<= 300 chars: the decision rationale for audit (NOT chain-of-thought)",
  "artifacts": [ { "path": "relative/path.md", "kind": "report|doc|code|test|plan|evidence", "content": "the artifact body" } ],
  "fileChanges": [ { "path": "src/server.js", "operation": "create|modify", "content": "the COMPLETE new file text" } ],
  "recommendations": [ "short string", ... ],
  "requestedToolCalls": [ { "tool": "workspace.read|workspace.list|workspace.write|workspace.patch|workspace.exec", "args_json": "<JSON object literal as a string>", "reason": "short string" } ],
  "handoff": { "to": "<agent-id>", "why": "short string" } | null,
  "qualityEvidence": [ { "check": "string", "result": "PASS|FAIL|NOT_RUN", "detail": "short string" } ],
  "risks": [ "short string", ... ],
  "errors": [ "short string", ... ]
}

Rules:
- Produce ONLY the artifacts your role owns (see "Your outputs"). One artifact per file. Keep each
  "content" tight - a focused report or the actual file text, not an essay; do not restate the task,
  the context, or another artifact back to us.
- CODE CHANGES go in "fileChanges", NOT in "artifacts" and NOT in "requestedToolCalls". Each
  fileChanges entry is ONE COMPLETE file (never a fragment, never a prose stub, never a diff). The
  runtime applies each one to the workspace through the permission gateway. "artifacts" are
  documentation only and are NEVER written to the repository.
- Only list tools in requestedToolCalls that appear in "Tools you may request". You do NOT need a
  tool call to run tests - the runtime runs the project's own test command itself after this stage.
- "args_json" is a STRING containing one JSON object (escape the inner quotes); use "{}" when there
  are no arguments. Use requestedToolCalls only for read-only inspection (workspace.read/list).
- Match the project EXACTLY as described in "project_facts" (below): its module system, its test
  command, its entrypoint and exports. Do not introduce a framework, dependency or test runner that
  is not already there. Make the SMALLEST change that satisfies the task.
- Every file you write must be syntactically valid in the project's module system before tests run.
- If you cannot complete the stage safely, use status "BLOCKED" and explain in "errors".
- Do not claim a test passed unless the evidence shows it ran and passed.
- The response must be a single valid JSON object on its own - strict JSON, double-quoted keys and
  strings, no trailing commas, no truncation. This applies to the first response and any retry.`;

export function assembleAgentPrompt(input: StageInput): AssembledPrompt {
  const {
    reg,
    agent,
    workflow,
    step,
    task,
    priorArtifacts,
    allowedRuntimeTools,
    workspaceDiff,
    workspaceFiles,
  } = input;
  const budget = input.contextBudgetBytes ?? 24_000;

  const skills = agent.required_skills
    .map((id) => {
      const s = reg.skills.byId.get(id);
      return s ? `- ${s.id}: ${s.summary.trim()}` : `- ${id}`;
    })
    .join("\n");

  const system = [
    `You are the ${agent.title} (agent id: ${agent.id}) at the AI Software Company.`,
    `Department: ${agent.department}. Seniority: ${agent.seniority}.`,
    `Mission: ${agent.mission.trim()}`,
    ``,
    `COMPANY CONSTITUTION CONSTRAINTS:`,
    ...CONSTITUTION_CONSTRAINTS.map((c) => `- ${c}`),
    ``,
    `You are one stage in the "${workflow.name}" workflow. Stay strictly within your role.`,
    `Do the current stage's work only. Hand off to the next role; do not do their job.`,
  ].join("\n");

  const sections: { name: string; body: string; keep?: boolean }[] = [
    {
      name: "task",
      keep: true,
      body: `Title: ${task.title}\nDescription: ${task.description}\nProject: ${task.project} (risk ${task.risk})\nRequested by: ${task.requested_by}`,
    },
    {
      name: "current_stage",
      keep: true,
      body: `Stage: ${step.name} (${step.id})\nAction: ${step.action}\nProject state: ${step.project_state ?? "-"}${step.gate ? "\nThis stage is a QUALITY GATE - issue an explicit PASS/FAIL with evidence." : ""}`,
    },
    {
      name: "your_role",
      keep: true,
      body:
        `Responsibilities:\n${agent.responsibilities.map((r) => `- ${r}`).join("\n")}\n\n` +
        `NOT your responsibility:\n${agent.non_responsibilities.map((r) => `- ${r}`).join("\n")}`,
    },
    { name: "your_skills", body: skills || "- (none listed)" },
    {
      name: "your_outputs",
      keep: true,
      body: agent.outputs.map((o) => `- ${o}`).join("\n"),
    },
    {
      name: "your_quality_gates",
      keep: true,
      body: agent.quality_gates.map((g) => `- ${g}`).join("\n"),
    },
    {
      name: "tools_you_may_request",
      keep: true,
      body:
        allowedRuntimeTools.length > 0
          ? allowedRuntimeTools.map((t) => `- ${t}`).join("\n")
          : "- (none - this is an analysis/documentation stage; use artifacts only)",
    },
    {
      name: "security_constraints",
      body: [
        "- No secret, key, token or credential in any artifact or output.",
        "- No customer PII, payment data or production data.",
        "- Additive, least-change edits only; do not touch unrelated files.",
        "- All file writes are confined to the disposable proof workspace.",
      ].join("\n"),
    },
    {
      name: "human_founder_authority",
      body:
        "The workflow will STOP for explicit Human Founder approval before any production step. " +
        "Nothing you do deploys, merges or releases anything. Prepare evidence for that decision.",
    },
  ];

  if (priorArtifacts.length > 0) {
    sections.push({
      name: "prior_stage_artifacts",
      keep: true,
      body: priorArtifacts
        .map((a) => `### ${a.stage} by ${a.agentId} - ${a.path}\n${a.excerpt}`)
        .join("\n\n"),
    });
  }
  if (input.projectFacts) {
    const pf = input.projectFacts;
    sections.push({
      name: "project_facts",
      keep: true,
      body: [
        "AUTHORITATIVE - computed directly from the current workspace. If any earlier stage's",
        "artifact describes a different framework, language, module system or test runner, that",
        "earlier stage was IMPRECISE: follow these facts, not the prior artifact.",
        "",
        `- language: ${pf.language}`,
        `- package manager: ${pf.packageManager}`,
        `- module system: ${pf.moduleType}  (${pf.moduleSyntax})`,
        `- test command (run by the runtime after this stage): ${pf.testCommand}`,
        `- test runner: ${pf.testRunner}`,
        `- test discovery: ${pf.testDiscoveryRule}`,
        `- add new tests at: ${pf.recommendedTestPath}`,
        `- source dir(s): ${pf.sourceDirs.join(", ")}`,
        `- server/library entrypoint: ${pf.serverEntrypoint ?? "(none found)"}`,
        `- entrypoint exports: ${pf.entrypointExports.length ? pf.entrypointExports.join(", ") : "(none detected)"}`,
        `- existing tests: ${pf.existingTests.length ? pf.existingTests.join(", ") : "(none)"}`,
        `- npm scripts: ${Object.entries(pf.npmScripts).map(([k, v]) => `${k}="${v}"`).join("  ") || "(none)"}`,
      ].join("\n"),
    });
  }
  if (workspaceFiles && workspaceFiles.length > 0) {
    sections.push({
      name: "proof_workspace_files",
      keep: true,
      body: workspaceFiles
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join("\n\n"),
    });
  }
  if (workspaceDiff !== undefined) {
    sections.push({
      name: "proof_workspace_diff",
      keep: true,
      body: workspaceDiff.trim() ? workspaceDiff : "(no changes in the workspace yet)",
    });
  }

  // Context budgeting: keep the "keep" sections whole; truncate the rest to fit.
  const truncated: string[] = [];
  const rendered: string[] = [];
  let used = Buffer.byteLength(system) + Buffer.byteLength(OUTPUT_CONTRACT);

  for (const s of sections) {
    const header = `## ${s.name}\n`;
    let body = s.body;
    const full = header + body + "\n\n";
    const cost = Buffer.byteLength(full);
    if (used + cost <= budget) {
      rendered.push(full);
      used += cost;
      continue;
    }
    const remaining = Math.max(0, budget - used - Buffer.byteLength(header) - 32);
    if (s.keep || remaining > 400) {
      const slice = body.slice(0, s.keep ? Math.max(remaining, 1200) : remaining);
      body = slice + (slice.length < s.body.length ? "\n…[truncated for context budget]" : "");
      const clipped = header + body + "\n\n";
      rendered.push(clipped);
      used += Buffer.byteLength(clipped);
      if (body.length < s.body.length) truncated.push(s.name);
    } else {
      truncated.push(s.name);
    }
  }

  const directives = input.stageDirectives ?? [];
  const prompt = [
    ...rendered,
    ...(directives.length > 0
      ? ["## stage_directives (acceptance-critical)", directives.map((d) => `- ${d}`).join("\n"), ""]
      : []),
    "## required_output_contract",
    OUTPUT_CONTRACT,
    "",
    `Now perform the "${step.name}" stage and return the JSON object.`,
  ].join("\n");

  return {
    system,
    prompt,
    contextBytes: Buffer.byteLength(system) + Buffer.byteLength(prompt),
    sections: sections.map((s) => s.name),
    truncated,
  };
}
