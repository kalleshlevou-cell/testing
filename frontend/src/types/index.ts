export type OrgRole = 'owner' | 'editor' | 'viewer';

export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'db_event';

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_approval';

export interface Organization {
  id: string;
  name: string;
  quota_calls_used: number;
  quota_calls_allowed: number;
  quota_period_start: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id?: string;
  step_order: number;
  step_type: StepType;
  name: string;
  config: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowTrigger {
  id: string;
  workflow_id?: string;
  trigger_type: TriggerType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  triggered_by?: string;
  trigger_type: string;
  status: RunStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
  created_at: string;
  step_runs?: StepRun[];
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  step_id?: string;
  step?: WorkflowStep;
  status: StepStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempt_count: number;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  workflow_steps: WorkflowStep[];
  workflow_triggers: WorkflowTrigger[];
  workflow_runs?: WorkflowRun[];
}

export interface OrgContext {
  role: OrgRole;
  organization: Organization;
}

// Draft types used in the builder (before saving)
export interface DraftStep {
  _localId: string; // temporary client-side ID
  step_order: number;
  step_type: StepType;
  name: string;
  config: Record<string, unknown>;
}

export interface DraftTrigger {
  _localId: string;
  trigger_type: TriggerType;
  config: Record<string, unknown>;
  is_active: boolean;
}
