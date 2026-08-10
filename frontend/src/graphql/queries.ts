import { gql } from '@apollo/client';

export const GET_USER_ORGS = gql`
  query GetUserOrgs {
    org_members(order_by: { created_at: asc }) {
      id
      role
      organization {
        id
        name
        calls_allowed
        calls_used
      }
    }
  }
`;

export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: desc }
    ) {
      id
      name
      description
      created_at
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        config
      }
      workflow_triggers {
        id
        type
        config
      }
      workflow_runs(order_by: { started_at: desc }, limit: 1) {
        id
        status
        trigger_type
        started_at
        finished_at
      }
    }
  }
`;

export const GET_WORKFLOW_DETAIL = gql`
  query GetWorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description
      org_id
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        config
      }
      workflow_triggers {
        id
        type
        config
      }
      workflow_runs(order_by: { started_at: desc }, limit: 10) {
        id
        status
        trigger_type
        started_at
        finished_at
      }
    }
  }
`;

export const GET_ORG_USAGE = gql`
  query GetOrgUsage($org_id: uuid!) {
    org_usage_this_month(where: { org_id: { _eq: $org_id } }) {
      org_id
      org_name
      calls_allowed
      calls_used
      pct_used
      avg_run_duration_seconds
      runs_this_month
    }
  }
`;

export const GET_WORKFLOW_RUN = gql`
  query GetWorkflowRun($id: uuid!) {
    workflow_runs_by_pk(id: $id) {
      id
      status
      trigger_type
      started_at
      finished_at
      step_runs(order_by: { started_at: asc }) {
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
  }
`;
