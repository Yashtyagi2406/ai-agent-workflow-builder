import { gqlAdmin } from '../db';
import type { DbWriteConfig, StepExecutionResult } from '../types';

/**
 * DB Write step handler.
 * Saves previous step output into workflow_results table.
 * Only org owners can add this step type (enforced at DB trigger + Hasura level).
 */
export async function executeDbWrite(
  config: DbWriteConfig,
  previousOutput: Record<string, unknown>,
  stepRunId: string,
  workflowRunId: string
): Promise<StepExecutionResult> {
  const data = await gqlAdmin<{ insert_workflow_results_one: { id: string } }>(
    `mutation WriteResult($step_run_id: uuid!, $workflow_run_id: uuid!, $data: jsonb!) {
      insert_workflow_results_one(object: {
        step_run_id: $step_run_id,
        workflow_run_id: $workflow_run_id,
        data: $data
      }) { id }
    }`,
    {
      step_run_id: stepRunId,
      workflow_run_id: workflowRunId,
      data: {
        label: config.label ?? 'db_write_result',
        payload: previousOutput,
        written_at: new Date().toISOString(),
      },
    }
  );

  return {
    status: 'succeeded',
    output: {
      result_id: data.insert_workflow_results_one.id,
      rows_written: 1,
      label: config.label ?? 'db_write_result',
    },
  };
}
