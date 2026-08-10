import {
  gqlAdmin,
  createStepRun,
  updateStepRun,
  updateWorkflowRunStatus,
  incrementQuotaUsed,
} from './db';
import { executeLlmCall } from './steps/llmCall';
import { executeHttpRequest } from './steps/httpRequest';
import { executeDbWrite } from './steps/dbWrite';
import { executeNotify } from './steps/notify';
import { executeConditionalBranch } from './steps/conditionalBranch';
import { executeApprovalGate } from './steps/approvalGate';
import type {
  WorkflowStep,
  StepExecutionResult,
  LlmCallConfig,
  HttpRequestConfig,
  DbWriteConfig,
  NotifyConfig,
  ConditionalBranchConfig,
} from './types';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface RunEngineOptions {
  workflowRunId: string;
  steps: WorkflowStep[];
  startFromOrder?: number;
  orgId: string;
}

/**
 * Core step execution loop.
 * Runs steps in order, handles retries, pauses on approval_gate,
 * updates step_run + workflow_run statuses throughout.
 *
 * Returns 'completed' | 'paused' | 'failed'
 */
export async function runEngine({
  workflowRunId,
  steps,
  startFromOrder = 0,
  orgId,
}: RunEngineOptions): Promise<'completed' | 'paused' | 'failed'> {
  let previousOutput: Record<string, unknown> = {};
  let skipNext = false;
  let llmCallsMade = 0;

  const stepsToRun = steps.filter((s) => s.step_order >= startFromOrder);

  for (const step of stepsToRun) {
    // Handle skip_next flag from conditional_branch
    if (skipNext) {
      skipNext = false;
      const stepRunId = await createStepRun(workflowRunId, step.id, previousOutput);
      await updateStepRun(stepRunId, {
        status: 'skipped',
        output: { skipped: true, reason: 'conditional_branch skip_next was true' },
      });
      continue;
    }

    // Create step_run record
    const stepRunId = await createStepRun(workflowRunId, step.id, previousOutput);

    // Execute with retry
    let result: StepExecutionResult | null = null;
    let lastError = '';
    let attemptCount = 0;

    const needsRetry = step.type === 'llm_call' || step.type === 'http_request';

    for (let attempt = 1; attempt <= (needsRetry ? MAX_RETRIES : 1); attempt++) {
      attemptCount = attempt;
      try {
        result = await executeStep(step, previousOutput, stepRunId, workflowRunId);
        break; // success — exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[runEngine] Step ${step.type} attempt ${attempt} failed: ${lastError}`);

        if (attempt < (needsRetry ? MAX_RETRIES : 1)) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // If all retries exhausted
    if (!result) {
      await updateStepRun(stepRunId, {
        status: 'failed',
        error: lastError,
        attempt_count: attemptCount,
      });
      await updateWorkflowRunStatus(workflowRunId, 'failed', new Date().toISOString());
      return 'failed';
    }

    // Handle execution result
    switch (result.status) {
      case 'paused_awaiting_approval': {
        await updateStepRun(stepRunId, {
          status: 'paused_awaiting_approval',
          attempt_count: attemptCount,
        });
        await updateWorkflowRunStatus(workflowRunId, 'paused');
        return 'paused';
      }

      case 'failed': {
        await updateStepRun(stepRunId, {
          status: 'failed',
          error: result.error,
          attempt_count: attemptCount,
        });
        await updateWorkflowRunStatus(workflowRunId, 'failed', new Date().toISOString());
        return 'failed';
      }

      case 'skipped':
      case 'succeeded': {
        const output = 'output' in result ? result.output : {};
        await updateStepRun(stepRunId, {
          status: result.status,
          output,
          attempt_count: attemptCount,
        });

        // Track LLM calls for quota
        if (step.type === 'llm_call') llmCallsMade++;

        // Check for conditional_branch skip_next
        if (step.type === 'conditional_branch' && output.skip_next === true) {
          skipNext = true;
        }

        previousOutput = output;
        break;
      }
    }
  }

  // All steps completed
  await updateWorkflowRunStatus(workflowRunId, 'completed', new Date().toISOString());

  // Increment quota once per completed run
  await incrementQuotaUsed(orgId);

  return 'completed';
}

async function executeStep(
  step: WorkflowStep,
  previousOutput: Record<string, unknown>,
  stepRunId: string,
  workflowRunId: string
): Promise<StepExecutionResult> {
  switch (step.type) {
    case 'llm_call':
      return executeLlmCall(step.config as unknown as LlmCallConfig, previousOutput);

    case 'http_request':
      return executeHttpRequest(step.config as unknown as HttpRequestConfig, previousOutput);

    case 'db_write':
      return executeDbWrite(
        step.config as unknown as DbWriteConfig,
        previousOutput,
        stepRunId,
        workflowRunId
      );

    case 'notify':
      return executeNotify(step.config as unknown as NotifyConfig, previousOutput, workflowRunId);

    case 'conditional_branch':
      return executeConditionalBranch(step.config as unknown as ConditionalBranchConfig, previousOutput);

    case 'approval_gate':
      return executeApprovalGate();

    default:
      throw new Error(`Unknown step type: ${(step as WorkflowStep).type}`);
  }
}

/**
 * Get remaining steps after a given step_order for resume-after-approval
 */
export async function getWorkflowStepsFromOrder(
  workflowRunId: string,
  fromOrder: number
): Promise<WorkflowStep[]> {
  const data = await gqlAdmin<{
    workflow_runs_by_pk: {
      workflow: {
        workflow_steps: WorkflowStep[];
      };
    } | null;
  }>(
    `query GetRemainingSteps($run_id: uuid!, $order: Int!) {
      workflow_runs_by_pk(id: $run_id) {
        workflow {
          workflow_steps(
            where: { step_order: { _gte: $order } },
            order_by: { step_order: asc }
          ) { id workflow_id step_order type config }
        }
      }
    }`,
    { run_id: workflowRunId, order: fromOrder }
  );

  return data.workflow_runs_by_pk?.workflow?.workflow_steps ?? [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
