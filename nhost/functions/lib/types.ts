export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'database_event';

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type StepRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'paused_awaiting_approval'
  | 'skipped';

export type OrgRole = 'owner' | 'editor' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  calls_allowed: number;
  calls_used: number;
  quota_period_start: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  created_by: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  type: StepType;
  config: Record<string, unknown>;
}

export interface WorkflowTrigger {
  id: string;
  workflow_id: string;
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: RunStatus;
  started_by?: string;
  trigger_type: TriggerType;
  started_at: string;
  finished_at?: string;
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: StepRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempt_count: number;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  finished_at?: string;
}

export interface HasuraActionPayload<T = Record<string, unknown>> {
  action: { name: string };
  input: T;
  session_variables: {
    'x-hasura-user-id'?: string;
    'x-hasura-role'?: string;
    [key: string]: string | undefined;
  };
}

// Step-specific config shapes
export interface LlmCallConfig {
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
}

export interface HttpRequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface DbWriteConfig {
  label?: string;
}

export interface NotifyConfig {
  slack_webhook_url?: string;
  message_template?: string;
  channel?: string;
}

export interface ConditionalBranchConfig {
  condition: string; // e.g. "output.sentiment === 'positive'"
  truthy_skip_next?: boolean;
}

// Result of running a single step
export type StepExecutionResult =
  | { status: 'succeeded'; output: Record<string, unknown> }
  | { status: 'failed'; error: string }
  | { status: 'paused_awaiting_approval' }
  | { status: 'skipped'; output: Record<string, unknown> };
