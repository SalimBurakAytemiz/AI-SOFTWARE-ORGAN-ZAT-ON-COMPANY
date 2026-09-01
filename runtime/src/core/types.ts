// Shared domain types for the AI Software Company Agent Runtime.
// These mirror the Organization V1.0 configuration schemas in ../../../schemas.

export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const MODEL_TIERS = [
  "NO_AI",
  "LOW_COST",
  "STANDARD_CODING",
  "ADVANCED_REASONING",
  "CRITICAL_REVIEW",
] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const PROJECT_STATES = [
  "IDEA",
  "SPEC",
  "PLAN",
  "DESIGN",
  "BUILD",
  "REVIEW",
  "TEST",
  "SECURITY",
  "STAGING",
  "APPROVAL",
  "PRODUCTION",
  "MONITORING",
  "IMPROVEMENT",
  "HUMAN_APPROVAL_REQUIRED",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

// ---------------------------------------------------------------------------
// Agent, skill, tool, capability
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  id: string;
  title: string;
  department: string;
  seniority: string;
  purpose: string;
  mission: string;
  responsibilities: string[];
  non_responsibilities: string[];
  required_skills: string[];
  domain_knowledge: string[];
  programming_languages: string[];
  frameworks: string[];
  engineering_practices: string[];
  preferred_model_tier: ModelTier;
  fallback_model_tier: ModelTier;
  risk_level: RiskLevel;
  allowed_tools: string[];
  forbidden_tools: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  human_approval_required: string[];
  inputs: string[];
  outputs: string[];
  quality_gates: string[];
  handoff_from: string[];
  handoff_to: string[];
  escalation_to: string;
  memory_scope: {
    read: string[];
    write: string[];
    retention?: string;
    forbidden?: string[];
  };
  context_requirements: string[];
  audit_requirements: string[];
  success_metrics: string[];
  failure_conditions: string[];
  notes?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  summary: string;
  when_to_use: string[];
  when_not_to_use?: string[];
  procedure: string[];
  inputs: string[];
  outputs: string[];
  quality_checks: string[];
  failure_modes: string[];
  risk_level: RiskLevel;
  tools_touched?: string[];
  source_influences: string[];
  status: "ACTIVE" | "DRAFT" | "DEFERRED" | "DEPRECATED";
  notes?: string;
}

export interface CapabilityDefinition {
  id: string;
  tool: string;
  description: string;
  risk_level: RiskLevel;
  grantable: boolean;
  reason_not_grantable?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  purpose: string;
  status: "ADOPTED" | "OPTIONAL" | "DEFERRED" | "REJECTED" | "RESEARCH";
  runtime_dependency: boolean;
  trust_level: "high" | "medium" | "low" | "untrusted";
  security_risk: "low" | "medium" | "high" | "critical";
  permissions_required: string[];
  adapter_required: boolean;
  cost_model: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  name: string;
  owner: string;
  action: string;
  project_state?: ProjectState;
  gate?: boolean;
  human_approval?: boolean;
  risk_level?: RiskLevel;
  on_pass: string;
  on_fail: string;
  audit_event?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  purpose: string;
  trigger: string[];
  risk_level: RiskLevel;
  reaches_production?: boolean;
  steps: WorkflowStep[];
  produces: string[];
  invariants: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type PolicyEffect = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "REQUIRE_REVIEW";

export interface PolicyRule {
  id: string;
  statement: string;
  effect: PolicyEffect;
  applies_to?: string[];
  actions?: string[];
  conditions?: string[];
  approver?: string;
  rationale?: string;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  purpose: string;
  authority: "human-founder";
  default: "DENY" | "ALLOW";
  rules: PolicyRule[];
  enforcement: string[];
  review: string;
  related_policies?: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Tasks and workflow runs
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "CREATED"
  | "CLASSIFIED"
  | "RUNNING"
  | "APPROVAL_REQUIRED"
  | "BLOCKED"
  | "REJECTED"
  | "COMPLETED"
  | "ABORTED";

export interface Task {
  id: string;
  title: string;
  description: string;
  project: string;
  requested_by: string;
  priority: "low" | "normal" | "high" | "urgent";
  risk: RiskLevel;
  status: TaskStatus;
  workflow_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RunStatus =
  | "RUNNING"
  | "APPROVAL_REQUIRED"
  | "BLOCKED"
  | "REJECTED"
  | "COMPLETED"
  | "ABORTED"
  | "PAUSED";

export type StepResult =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "PENDING"
  | "APPROVAL_REQUIRED"
  | "REJECTED";

export interface StepRecord {
  step_id: string;
  owner: string;
  result: StepResult;
  note: string;
  at: string;
  audit_event_id: string | null;
}

export interface WorkflowRun {
  id: string;
  task_id: string;
  workflow_id: string;
  current_step: string;
  status: RunStatus;
  project_state: ProjectState | null;
  history: StepRecord[];
  pending_approval_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export type ApprovalState =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface ApprovalRequest {
  id: string;
  task_id: string;
  run_id: string;
  workflow_id: string;
  step_id: string;
  requested_by: string; // agent id or 'system'
  requested_action: string;
  reason: string;
  risk_level: RiskLevel;
  impact: string;
  environment: string;
  tests_summary: string;
  security_summary: string;
  rollback_summary: string;
  estimated_cost_usd: number | null;
  state: ApprovalState;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Policy decisions
// ---------------------------------------------------------------------------

export type DecisionEffect = "ALLOW" | "DENY" | "APPROVAL_REQUIRED";

export interface PolicyDecision {
  effect: DecisionEffect;
  reason: string;
  matched_rules: string[];
  risk_level: RiskLevel;
  approver: string | null;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  project: string;
  task: string;
  agent_id: string;
  agent_role: string;
  model: string;
  tool: string | null;
  capability: string | null;
  action: string;
  reason: string;
  input_reference: string | null;
  output_reference: string | null;
  risk_level: RiskLevel;
  previous_state: string | null;
  new_state: string | null;
  approval_required: boolean;
  approved_by: string | null;
  approval_timestamp: string | null;
  result: "PASS" | "FAIL" | "BLOCKED" | "PENDING" | "APPROVAL_REQUIRED" | "REJECTED";
  duration: number | null;
  estimated_cost: number | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Command / tool safety classification
// ---------------------------------------------------------------------------

export const COMMAND_CLASSES = [
  "READ_ONLY",
  "DEVELOPMENT_WRITE",
  "DESTRUCTIVE",
  "EXTERNAL_WRITE",
  "PRODUCTION_WRITE",
  "FINANCIAL",
] as const;
export type CommandClass = (typeof COMMAND_CLASSES)[number];
