import type { RiskLevel } from "../core/types.ts";
import type { Registries } from "../registry/index.ts";
import { assessRiskFromText, clampRisk } from "../policy/risk.ts";

export interface Classification {
  workflow_id: string;
  task_type: string;
  risk: RiskLevel;
  rationale: string;
}

const RULES: { test: RegExp; workflow: string; taskType: string }[] = [
  { test: /\b(outage|incident|degrad|is down|p1|sev1|customer impact)\b/i, workflow: "incident", taskType: "hard_debugging_or_rca" },
  { test: /\bhotfix|ship (a )?fix (before|now)|time-sensitive fix\b/i, workflow: "hotfix", taskType: "simple_bugfix" },
  { test: /\b(cve-\d|vulnerabilit|security finding|exploit|red[- ]team)\b/i, workflow: "security-finding", taskType: "security_review" },
  { test: /\b(dependency|dependencies|renovate|bump .*version|upgrade .*(package|library))\b/i, workflow: "dependency-update", taskType: "simple_bugfix" },
  { test: /\b(schema change|database migration|add (a )?column|alter table|new index)\b/i, workflow: "database-migration", taskType: "migration_design" },
  { test: /\b(architecture|re-architect|restructure|technology change|swap .* framework)\b/i, workflow: "architecture-change", taskType: "architecture_design" },
  { test: /\b(bug|defect|broken|regression|not working|incorrect behaviou?r|throws an error)\b/i, workflow: "bugfix", taskType: "simple_bugfix" },
  { test: /\b(cut a release|release the|prepare (a )?release)\b/i, workflow: "release", taskType: "release_verification" },
];

/**
 * Task intake classification (build spec sections 18, 19). The Human Founder does
 * not pick agents or a workflow; the runtime derives them. Falls back to
 * feature-development.
 */
export function classifyTask(reg: Registries, title: string, description: string): Classification {
  const text = `${title}\n${description}`;
  const match = RULES.find((r) => r.test.test(text));
  const workflowId = match?.workflow ?? "feature-development";
  const taskType = match?.taskType ?? "feature_implementation";
  const wf = reg.workflows.get(workflowId);
  const risk = clampRisk(
    Math.max(assessRiskFromText(text, wf.risk_level as RiskLevel), wf.risk_level),
  );
  return {
    workflow_id: workflowId,
    task_type: taskType,
    risk,
    rationale: match
      ? `matched '${match.test.source}' -> ${workflowId}`
      : `no specific signal; defaulted to feature-development`,
  };
}
