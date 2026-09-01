import type { AgentDefinition, WorkflowStep, Task } from "../core/types.ts";
import type { Registries } from "../registry/index.ts";

export interface BoundedContext {
  agent_id: string;
  step_id: string;
  /** Only the parts of the organization this agent needs for this step. */
  sections: Record<string, string>;
  byte_size: number;
}

/**
 * Bounded context assembly (build spec section 20). An agent receives only what its
 * responsibility needs: the task, the current step, its own definition, its skills,
 * the applicable policies, and the previous stage's output. The full repository is
 * never dumped into a prompt; a Repomix pack would be a scoped sub-section here.
 */
export function buildContext(
  reg: Registries,
  agent: AgentDefinition,
  step: WorkflowStep,
  task: Task,
  previousOutput: string | null,
): BoundedContext {
  const sections: Record<string, string> = {
    task: `${task.title}\n${task.description}\n(risk ${task.risk}, project ${task.project})`,
    step: `${step.name}: ${step.action}`,
    role: `${agent.title} (${agent.department}). Mission: ${agent.mission.trim()}`,
    responsibilities: agent.responsibilities.map((r) => `- ${r}`).join("\n"),
    non_responsibilities: agent.non_responsibilities.map((r) => `- ${r}`).join("\n"),
    skills: agent.required_skills
      .map((id) => {
        const s = reg.skills.byId.get(id);
        return s ? `- ${s.id}: ${s.summary.trim()}` : `- ${id}`;
      })
      .join("\n"),
    quality_gates: agent.quality_gates.map((g) => `- ${g}`).join("\n"),
    policies: ["human-approval", "agent-permissions", "security"]
      .map((id) => {
        const p = reg.policies.byId.get(id);
        return p ? `- ${p.id}: ${p.purpose.trim()}` : `- ${id}`;
      })
      .join("\n"),
  };
  if (previousOutput) sections.previous_stage_output = previousOutput.slice(0, 4000);

  const byteSize = Object.values(sections).reduce((n, v) => n + Buffer.byteLength(v), 0);
  return { agent_id: agent.id, step_id: step.id, sections, byte_size: byteSize };
}
