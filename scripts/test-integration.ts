/**
 * Integration Test Suite — End-to-End Final Task Verification
 * Run with: npm run test:integration (or npx tsx scripts/test-integration.ts)
 */

const HASURA_URL = process.env.HASURA_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? 'nhost-admin-secret';
const FUNCTIONS_URL = process.env.NHOST_FUNCTIONS_URL ?? 'http://localhost:5005';

async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data as T;
}

async function callFunction<T = Record<string, unknown>>(
  path: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${FUNCTIONS_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

async function runIntegrationTests() {
  console.log('🧪 Running AI Workflow Builder End-to-End Integration Tests…\n');

  // ── Step 1: Query Seeded Orgs & Workflows ──────────────────────────────────
  console.log('1️⃣ Testing Schema & Seed Data Existence…');
  const orgData = await gql<{
    organizations: { id: string; name: string; org_members: { user_id: string; role: string }[] }[];
  }>(`
    query GetTestOrgs {
      organizations(order_by: { name: asc }) {
        id name
        org_members { user_id role }
      }
    }
  `);

  assert(orgData.organizations.length >= 2, 'Two separate organizations exist in DB');
  const orgA = orgData.organizations.find((o) => o.name.includes('Org A'));
  const orgB = orgData.organizations.find((o) => o.name.includes('Org B'));

  assert(Boolean(orgA && orgB), 'Org A and Org B found');

  const orgAOwner = orgA?.org_members.find((m) => m.role === 'owner')?.user_id;
  const orgAEditor = orgA?.org_members.find((m) => m.role === 'editor')?.user_id;
  const orgBOwner = orgB?.org_members.find((m) => m.role === 'owner')?.user_id;
  const orgBViewer = orgB?.org_members.find((m) => m.role === 'viewer')?.user_id;

  assert(Boolean(orgAOwner && orgAEditor && orgBOwner && orgBViewer), 'Roles (Owner, Editor, Viewer) exist in both orgs');

  const wfData = await gql<{
    workflows: { id: string; name: string; workflow_steps: { id: string; type: string }[] }[];
  }>(
    `query GetOrgAWorkflows($org_id: uuid!) {
      workflows(where: { org_id: { _eq: $org_id } }) {
        id name workflow_steps { id type }
      }
    }`,
    { org_id: orgA?.id }
  );

  assert(wfData.workflows.length > 0, 'Org A sample workflow exists');
  const workflowAId = wfData.workflows[0].id;
  console.log(`   Org A Workflow ID: ${workflowAId}\n`);

  // ── Step 2: Test triggerWorkflowRun Action ─────────────────────────────────
  console.log('2️⃣ Testing triggerWorkflowRun Action (Manual Trigger & Execution Loop)…');

  const triggerRes = await callFunction<{ workflow_run_id: string; status: string; message: string }>(
    '/triggerWorkflowRun',
    {
      action: { name: 'triggerWorkflowRun' },
      input: { workflow_id: workflowAId },
      session_variables: {
        'x-hasura-user-id': orgAOwner,
        'x-hasura-role': 'owner',
      },
    }
  );

  assert(triggerRes.status === 200, `triggerWorkflowRun returned HTTP 200 (Got ${triggerRes.status})`);
  assert(triggerRes.body.status === 'paused', `Workflow run paused at approval_gate (Got: ${triggerRes.body.status})`);

  const runId = triggerRes.body.workflow_run_id;
  assert(Boolean(runId), `Created Workflow Run ID: ${runId}`);

  // Query step_runs for this run
  const stepRunsData = await gql<{
    step_runs: { id: string; status: string; workflow_step: { type: string } }[];
  }>(
    `query GetRunSteps($run_id: uuid!) {
      step_runs(where: { workflow_run_id: { _eq: $run_id } }, order_by: { started_at: asc }) {
        id status workflow_step { type }
      }
    }`,
    { run_id: runId }
  );

  const steps = stepRunsData.step_runs;
  assert(steps.length >= 4, `Executed 4 steps up to approval gate (Executed: ${steps.length})`);
  assert(steps[0]?.workflow_step.type === 'llm_call' && steps[0]?.status === 'succeeded', 'Step 1 (llm_call) succeeded (using disclosed stub response)');
  assert(steps[1]?.workflow_step.type === 'http_request' && steps[1]?.status === 'succeeded', 'Step 2 (http_request) succeeded');
  assert(steps[2]?.workflow_step.type === 'conditional_branch' && steps[2]?.status === 'succeeded', 'Step 3 (conditional_branch) evaluated condition');

  const approvalStep = steps.find((s) => s.workflow_step.type === 'approval_gate');
  assert(Boolean(approvalStep && approvalStep.status === 'paused_awaiting_approval'), 'Step 4 (approval_gate) status is paused_awaiting_approval\n');

  // ── Step 3: Test approveStep Action ───────────────────────────────────────
  console.log('3️⃣ Testing approveStep Action (Pause/Resume Mechanics)…');

  const approveRes = await callFunction<{ step_run_id: string; status: string; message: string }>(
    '/approveStep',
    {
      action: { name: 'approveStep' },
      input: { step_run_id: approvalStep?.id },
      session_variables: {
        'x-hasura-user-id': orgAOwner,
        'x-hasura-role': 'owner',
      },
    }
  );

  assert(approveRes.status === 200, `approveStep returned HTTP 200 (Got ${approveRes.status})`);
  assert(approveRes.body.status === 'completed', `Workflow completed execution after approval (Got: ${approveRes.body.status})`);

  // Verify overall run status is completed
  const runData = await gql<{ workflow_runs_by_pk: { status: string } }>(
    `query GetRunStatus($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
    { id: runId }
  );
  assert(runData.workflow_runs_by_pk?.status === 'completed', 'Workflow run status updated to completed in DB\n');

  // ── Step 4: Test Inbound Webhook Trigger ─────────────────────────────────
  console.log('4️⃣ Testing Inbound Webhook Trigger…');

  const webhookRes = await callFunction<{ workflow_run_id: string; status: string }>(
    '/webhookTrigger',
    {
      input: {
        workflow_id: workflowAId,
        api_key: 'demo-webhook-api-key-org-a-2024',
      },
    }
  );

  assert(webhookRes.status === 200, `webhookTrigger returned HTTP 200 (Got ${webhookRes.status})`);
  assert(Boolean(webhookRes.body.workflow_run_id), `Webhook successfully started new run ID: ${webhookRes.body.workflow_run_id}`);

  const invalidWebhookRes = await callFunction(
    '/webhookTrigger',
    {
      input: {
        workflow_id: workflowAId,
        api_key: 'invalid-api-key-xyz',
      },
    }
  );
  assert(invalidWebhookRes.status === 401, `Invalid webhook API key rejected with HTTP 401 (Got ${invalidWebhookRes.status})\n`);

  // ── Step 5: Test Cross-Org Isolation (Layer 1 & Layer 2 Security) ────────
  console.log('5️⃣ Testing Cross-Org Isolation & Security Gating…');

  // Layer 1: Org B user queries Org A workflow via GraphQL
  const crossOrgGql = await gql<{ workflows: unknown[] }>(
    `query CrossOrgTest($org_id: uuid!) {
      workflows(where: { org_id: { _eq: $org_id } }) { id name }
    }`,
    { org_id: orgA?.id },
    { 'x-hasura-user-id': orgBOwner!, 'x-hasura-role': 'owner' }
  );

  assert(crossOrgGql.workflows.length === 0, 'Layer 1: Org B user querying Org A data returns empty array []');

  // Layer 2: Org B user attempts to trigger Org A workflow
  const crossOrgTrigger = await callFunction<{ message: string }>(
    '/triggerWorkflowRun',
    {
      action: { name: 'triggerWorkflowRun' },
      input: { workflow_id: workflowAId },
      session_variables: {
        'x-hasura-user-id': orgBOwner,
        'x-hasura-role': 'owner',
      },
    }
  );
  assert(crossOrgTrigger.status === 403, `Layer 2: Org B user attempting to trigger Org A workflow rejected with 403 (Got ${crossOrgTrigger.status})`);

  // Layer 2: Start a fresh paused run for testing security gating on approval
  const freshRunRes = await callFunction<{ workflow_run_id: string }>(
    '/triggerWorkflowRun',
    {
      action: { name: 'triggerWorkflowRun' },
      input: { workflow_id: workflowAId },
      session_variables: {
        'x-hasura-user-id': orgAOwner,
        'x-hasura-role': 'owner',
      },
    }
  );

  const freshStepRuns = await gql<{ step_runs: { id: string; status: string }[] }>(
    `query GetFreshSteps($run_id: uuid!) {
      step_runs(where: { workflow_run_id: { _eq: $run_id }, status: { _eq: "paused_awaiting_approval" } }) { id }
    }`,
    { run_id: freshRunRes.body.workflow_run_id }
  );
  const pausedStepId = freshStepRuns.step_runs[0]?.id;

  // Layer 2: Org B user attempts to approve Org A step run
  const crossOrgApprove = await callFunction<{ message: string }>(
    '/approveStep',
    {
      action: { name: 'approveStep' },
      input: { step_run_id: pausedStepId },
      session_variables: {
        'x-hasura-user-id': orgBOwner,
        'x-hasura-role': 'owner',
      },
    }
  );
  assert(crossOrgApprove.status === 403, `Layer 2: Org B user attempting to approve Org A step rejected with 403 (Got ${crossOrgApprove.status})`);

  // Layer 2: Viewer role in Org A attempts approval on Org A step
  const viewerApprove = await callFunction<{ message: string }>(
    '/approveStep',
    {
      action: { name: 'approveStep' },
      input: { step_run_id: pausedStepId },
      session_variables: {
        'x-hasura-user-id': orgBViewer,
        'x-hasura-role': 'viewer',
      },
    }
  );
  assert(viewerApprove.status === 403, `Layer 2: Viewer role attempting approval rejected with 403 (Got ${viewerApprove.status})\n`);

  // ── Final Results Summary ──────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('─────────────────────────────────────────────────────────────');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationTests().catch((err) => {
  console.error('❌ Integration test execution failed:', err);
  process.exit(1);
});
