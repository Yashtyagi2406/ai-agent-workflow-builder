/**
 * GraphQL client using admin secret — service-level writes
 * Used inside Action handlers AFTER auth checks have been performed
 */

const HASURA_GRAPHQL_URL =
  process.env.HASURA_GRAPHQL_URL ||
  `https://${process.env.NHOST_SUBDOMAIN}.hasura.${process.env.NHOST_REGION}.nhost.run/v1/graphql`;

const HASURA_ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';

export async function gqlAdmin<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(HASURA_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  return json.data as T;
}

// ─── Common queries/mutations ───────────────────────────────────────────────

export async function getWorkflowWithOrg(workflowId: string) {
  const data = await gqlAdmin<{
    workflows_by_pk: {
      id: string;
      org_id: string;
      name: string;
      workflow_steps: { id: string; step_order: number; type: string; config: Record<string, unknown> }[];
    } | null;
  }>(
    `query GetWorkflow($id: uuid!) {
      workflows_by_pk(id: $id) {
        id org_id name
        workflow_steps(order_by: { step_order: asc }) {
          id step_order type config
        }
      }
    }`,
    { id: workflowId }
  );
  return data.workflows_by_pk;
}

export async function getOrgMember(orgId: string, userId: string) {
  const data = await gqlAdmin<{
    org_members: { id: string; role: string }[];
  }>(
    `query GetOrgMember($org_id: uuid!, $user_id: uuid!) {
      org_members(where: { org_id: { _eq: $org_id }, user_id: { _eq: $user_id } }) {
        id role
      }
    }`,
    { org_id: orgId, user_id: userId }
  );
  return data.org_members[0] ?? null;
}

export async function getOrganization(orgId: string) {
  const data = await gqlAdmin<{
    organizations_by_pk: { id: string; calls_allowed: number; calls_used: number } | null;
  }>(
    `query GetOrg($id: uuid!) {
      organizations_by_pk(id: $id) { id calls_allowed calls_used }
    }`,
    { id: orgId }
  );
  return data.organizations_by_pk;
}

export async function createWorkflowRun(
  workflowId: string,
  startedBy: string | null,
  triggerType: string
) {
  const data = await gqlAdmin<{
    insert_workflow_runs_one: { id: string };
  }>(
    `mutation CreateRun($workflow_id: uuid!, $started_by: uuid, $trigger_type: String!) {
      insert_workflow_runs_one(object: {
        workflow_id: $workflow_id,
        started_by: $started_by,
        trigger_type: $trigger_type,
        status: "running"
      }) { id }
    }`,
    { workflow_id: workflowId, started_by: startedBy, trigger_type: triggerType }
  );
  return data.insert_workflow_runs_one.id;
}

export async function updateWorkflowRunStatus(
  runId: string,
  status: string,
  finishedAt?: string
) {
  await gqlAdmin(
    `mutation UpdateRunStatus($id: uuid!, $status: String!, $finished_at: timestamptz) {
      update_workflow_runs_by_pk(
        pk_columns: { id: $id },
        _set: { status: $status, finished_at: $finished_at }
      ) { id }
    }`,
    { id: runId, status, finished_at: finishedAt ?? null }
  );
}

export async function createStepRun(
  workflowRunId: string,
  workflowStepId: string,
  input: Record<string, unknown>
) {
  const data = await gqlAdmin<{
    insert_step_runs_one: { id: string };
  }>(
    `mutation CreateStepRun($workflow_run_id: uuid!, $workflow_step_id: uuid!, $input: jsonb!) {
      insert_step_runs_one(object: {
        workflow_run_id: $workflow_run_id,
        workflow_step_id: $workflow_step_id,
        input: $input,
        status: "running",
        started_at: "now()"
      }) { id }
    }`,
    { workflow_run_id: workflowRunId, workflow_step_id: workflowStepId, input }
  );
  return data.insert_step_runs_one.id;
}

export async function updateStepRun(
  stepRunId: string,
  fields: {
    status: string;
    output?: Record<string, unknown>;
    error?: string;
    attempt_count?: number;
    approved_by?: string;
    approved_at?: string;
  }
) {
  await gqlAdmin(
    `mutation UpdateStepRun(
      $id: uuid!,
      $status: String!,
      $output: jsonb,
      $error: String,
      $attempt_count: Int,
      $approved_by: uuid,
      $approved_at: timestamptz,
      $finished_at: timestamptz
    ) {
      update_step_runs_by_pk(
        pk_columns: { id: $id },
        _set: {
          status: $status,
          output: $output,
          error: $error,
          attempt_count: $attempt_count,
          approved_by: $approved_by,
          approved_at: $approved_at,
          finished_at: $finished_at
        }
      ) { id }
    }`,
    {
      id: stepRunId,
      status: fields.status,
      output: fields.output ?? null,
      error: fields.error ?? null,
      attempt_count: fields.attempt_count ?? null,
      approved_by: fields.approved_by ?? null,
      approved_at: fields.approved_at ?? null,
      finished_at:
        fields.status !== 'running' && fields.status !== 'paused_awaiting_approval'
          ? new Date().toISOString()
          : null,
    }
  );
}

export async function getStepRun(stepRunId: string) {
  const data = await gqlAdmin<{
    step_runs_by_pk: {
      id: string;
      workflow_run_id: string;
      workflow_step_id: string;
      status: string;
      output: Record<string, unknown> | null;
      workflow_run: {
        id: string;
        workflow_id: string;
        status: string;
        workflow: { org_id: string };
      };
      workflow_step: { step_order: number };
    } | null;
  }>(
    `query GetStepRun($id: uuid!) {
      step_runs_by_pk(id: $id) {
        id workflow_run_id workflow_step_id status output
        workflow_run {
          id workflow_id status
          workflow { org_id }
        }
        workflow_step { step_order }
      }
    }`,
    { id: stepRunId }
  );
  return data.step_runs_by_pk;
}

export async function incrementQuotaUsed(orgId: string) {
  await gqlAdmin(
    `mutation IncrementQuota($id: uuid!) {
      update_organizations_by_pk(
        pk_columns: { id: $id },
        _inc: { calls_used: 1 }
      ) { id calls_used }
    }`,
    { id: orgId }
  );
}
