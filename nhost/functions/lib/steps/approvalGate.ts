import type { StepExecutionResult } from '../types';

/**
 * Approval Gate step handler.
 * Sets the step run to paused_awaiting_approval and signals the run engine to stop.
 * The run resumes only when approveStep Action is called.
 */
export async function executeApprovalGate(): Promise<StepExecutionResult> {
  // Signal the run engine to pause — no output needed here
  // The run engine will handle setting statuses on step_run and workflow_run
  return { status: 'paused_awaiting_approval' };
}
