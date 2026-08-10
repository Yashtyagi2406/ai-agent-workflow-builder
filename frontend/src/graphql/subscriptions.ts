import { gql } from '@apollo/client';

export const SUB_STEP_RUNS = gql`
  subscription StepProgress($run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $run_id } }
      order_by: { started_at: asc }
    ) {
      id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      finished_at
      workflow_step {
        id
        step_order
        type
        config
      }
    }
  }
`;

export const SUB_WORKFLOW_RUN = gql`
  subscription WorkflowRunStatus($id: uuid!) {
    workflow_runs_by_pk(id: $id) {
      id
      status
      started_at
      finished_at
    }
  }
`;
