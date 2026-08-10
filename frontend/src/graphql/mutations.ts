import { gql } from '@apollo/client';

export const UPSERT_WORKFLOW = gql`
  mutation UpsertWorkflow(
    $workflow: workflows_insert_input!
  ) {
    insert_workflows_one(
      object: $workflow
      on_conflict: {
        constraint: workflows_pkey
        update_columns: [name, description, updated_at]
      }
    ) {
      id
      name
    }
  }
`;

export const CREATE_WORKFLOW_WITH_STEPS = gql`
  mutation CreateWorkflowWithSteps(
    $org_id: uuid!
    $name: String!
    $description: String
    $created_by: uuid!
    $steps: [workflow_steps_insert_input!]!
    $triggers: [workflow_triggers_insert_input!]!
  ) {
    insert_workflows_one(
      object: {
        org_id: $org_id
        name: $name
        description: $description
        created_by: $created_by
        workflow_steps: { data: $steps }
        workflow_triggers: { data: $triggers }
      }
    ) {
      id
      name
      workflow_steps { id step_order type config }
      workflow_triggers { id type config }
    }
  }
`;

export const UPDATE_WORKFLOW_STEPS = gql`
  mutation UpdateWorkflowSteps(
    $workflow_id: uuid!
    $steps: [workflow_steps_insert_input!]!
  ) {
    delete_workflow_steps(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
    insert_workflow_steps(objects: $steps) {
      returning { id step_order type config }
    }
  }
`;

export const UPDATE_WORKFLOW_TRIGGERS = gql`
  mutation UpdateWorkflowTriggers(
    $workflow_id: uuid!
    $triggers: [workflow_triggers_insert_input!]!
  ) {
    delete_workflow_triggers(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
    insert_workflow_triggers(objects: $triggers) {
      returning { id type config }
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      workflow_run_id
      status
      message
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: uuid!) {
    approveStep(step_run_id: $step_run_id) {
      step_run_id
      status
      message
    }
  }
`;
