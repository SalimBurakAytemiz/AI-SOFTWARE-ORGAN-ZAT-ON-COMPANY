import { RegistryIntegrityError } from "../core/errors.ts";
import { loadAgentRegistry, type AgentRegistry } from "./agent-registry.ts";
import { loadSkillRegistry, type SkillRegistry } from "./skill-registry.ts";
import { loadToolRegistry, type ToolRegistry } from "./tool-registry.ts";
import { loadWorkflowRegistry, type WorkflowRegistry } from "./workflow-registry.ts";
import {
  loadPolicyRegistry,
  type PolicyRegistry,
  CRITICAL_ACTIONS,
} from "./policy-registry.ts";
import { loadModelRegistry, type ModelRegistry } from "./model-registry.ts";

export interface Registries {
  agents: AgentRegistry;
  skills: SkillRegistry;
  tools: ToolRegistry;
  workflows: WorkflowRegistry;
  policies: PolicyRegistry;
  models: ModelRegistry;
}

/**
 * Load and cross-validate every Organization V1.0 configuration artifact.
 * Throws RegistryIntegrityError on the first broken reference; the runtime must
 * not start with an inconsistent organization (build spec section 6).
 */
export function loadRegistries(): Registries {
  const agents = loadAgentRegistry();
  const skills = loadSkillRegistry();
  const tools = loadToolRegistry();
  const workflows = loadWorkflowRegistry();
  const policies = loadPolicyRegistry();
  const models = loadModelRegistry();

  const problems: string[] = [];
  const agentIds = new Set(agents.ids());
  const skillIds = new Set(skills.ids());
  const ownerVocab = new Set([...agentIds, "human-founder", "system", "external"]);

  for (const agent of agents.all()) {
    for (const skill of agent.required_skills) {
      if (!skillIds.has(skill)) {
        problems.push(`agent ${agent.id}: unknown required skill '${skill}'`);
      }
    }
    for (const cap of [...agent.allowed_tools, ...agent.forbidden_tools]) {
      if (!tools.capabilities.has(cap)) {
        problems.push(`agent ${agent.id}: unknown capability '${cap}'`);
      }
    }
    for (const cap of agent.allowed_tools) {
      if (!tools.isGrantable(cap)) {
        problems.push(
          `agent ${agent.id}: granted non-grantable capability '${cap}' ` +
            `(reserved to the Human Founder)`,
        );
      }
      const capRisk = tools.capability(cap).risk_level;
      if (capRisk > agent.risk_level) {
        problems.push(
          `agent ${agent.id} (ceiling ${agent.risk_level}) granted '${cap}' ` +
            `at risk ${capRisk}`,
        );
      }
    }
    const bothWays = agent.allowed_tools.filter((c) => agent.forbidden_tools.includes(c));
    if (bothWays.length) {
      problems.push(`agent ${agent.id}: ${bothWays.join(", ")} in allowed and forbidden`);
    }
    for (const target of [
      ...agent.handoff_from,
      ...agent.handoff_to,
      agent.escalation_to,
    ]) {
      if (!ownerVocab.has(target)) {
        problems.push(`agent ${agent.id}: handoff/escalation to unknown '${target}'`);
      }
    }
    const leaked = agent.allowed_actions.filter((a) => CRITICAL_ACTIONS.includes(a));
    if (leaked.length) {
      problems.push(
        `agent ${agent.id}: critical action(s) in allowed_actions: ${leaked.join(", ")}`,
      );
    }
    const notForbidden = CRITICAL_ACTIONS.filter(
      (a) => !agent.forbidden_actions.includes(a),
    );
    if (notForbidden.length) {
      problems.push(
        `agent ${agent.id}: does not forbid critical action(s): ${notForbidden.join(", ")}`,
      );
    }
    if (agent.risk_level >= 5) {
      problems.push(`agent ${agent.id}: risk ceiling is 5 (no agent may reach RISK 5)`);
    }
  }

  for (const wf of workflows.all()) {
    for (const step of wf.steps) {
      if (!ownerVocab.has(step.owner)) {
        problems.push(`workflow ${wf.id} step ${step.id}: unknown owner '${step.owner}'`);
      }
    }
  }

  if (problems.length) {
    throw new RegistryIntegrityError(
      `organization configuration is inconsistent (${problems.length} problem(s))`,
      problems,
    );
  }

  return { agents, skills, tools, workflows, policies, models };
}
