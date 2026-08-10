/**
 * Seed script — creates two orgs with users for the Final Task demo
 * Usage: HASURA_GRAPHQL_URL=... HASURA_GRAPHQL_ADMIN_SECRET=... npx ts-node scripts/seed.ts
 */

const HASURA_URL =
  process.env.HASURA_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? 'nhost-admin-secret';
const AUTH_URL =
  process.env.NHOST_AUTH_URL ?? 'http://localhost:4000/v1';

async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data as T;
}

async function signUpUser(email: string, password: string, displayName: string): Promise<string> {
  try {
    const res = await fetch(`${AUTH_URL}/signup/email-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, options: { displayName } }),
    });
    if (res.ok) {
      const json = (await res.json()) as { session?: { user?: { id: string } }; error?: { message: string } };
      if (json.session?.user?.id) return json.session.user.id;
    }
  } catch {
    // Fallback to direct DB insert via Hasura for standalone Docker dev
  }

  const data = await gql<{ insert_auth_users_one: { id: string } }>(
    `mutation InsertUser($email: String!) {
      insert_auth_users_one(object: { email: $email }, on_conflict: { constraint: users_email_key, update_columns: [] }) { id }
    }`,
    { email }
  );
  return data.insert_auth_users_one.id;
}

async function createOrg(name: string): Promise<string> {
  const data = await gql<{ insert_organizations_one: { id: string } }>(
    `mutation CreateOrg($name: String!) {
      insert_organizations_one(object: { name: $name, calls_allowed: 1000 }) { id }
    }`,
    { name }
  );
  return data.insert_organizations_one.id;
}

async function addMember(orgId: string, userId: string, role: string): Promise<void> {
  await gql(
    `mutation AddMember($org_id: uuid!, $user_id: uuid!, $role: String!) {
      insert_org_members_one(object: { org_id: $org_id, user_id: $user_id, role: $role }) { id }
    }`,
    { org_id: orgId, user_id: userId, role }
  );
}

async function createSampleWorkflow(
  orgId: string,
  ownerId: string,
  name: string
): Promise<string> {
  const data = await gql<{ insert_workflows_one: { id: string } }>(
    `mutation CreateWorkflow(
      $org_id: uuid!, $name: String!, $created_by: uuid!,
      $steps: [workflow_steps_insert_input!]!,
      $triggers: [workflow_triggers_insert_input!]!
    ) {
      insert_workflows_one(object: {
        org_id: $org_id, name: $name, created_by: $created_by,
        description: "Demo workflow with LLM, HTTP, conditional branch, and approval gate",
        workflow_steps: { data: $steps },
        workflow_triggers: { data: $triggers }
      }) { id }
    }`,
    {
      org_id: orgId,
      name,
      created_by: ownerId,
      steps: [
        {
          step_order: 0,
          type: 'llm_call',
          config: {
            prompt: 'Analyze this topic and respond with a single word: "positive" or "negative". Topic: AI agent automation.',
            model: 'llama3-8b-8192',
            temperature: 0.3,
          },
        },
        {
          step_order: 1,
          type: 'http_request',
          config: {
            url: 'https://httpbin.org/post',
            method: 'POST',
            body: { llm_result: '{{previousOutput.text}}', sentiment: '{{previousOutput.sentiment}}' },
          },
        },
        {
          step_order: 2,
          type: 'conditional_branch',
          config: {
            condition: "previousOutput.data && previousOutput.data.json && previousOutput.data.json.llm_result !== undefined",
            truthy_skip_next: false,
          },
        },
        {
          step_order: 3,
          type: 'approval_gate',
          config: { message: 'Please review the LLM output before continuing.' },
        },
        {
          step_order: 4,
          type: 'db_write',
          config: { label: 'final_result' },
        },
      ],
      triggers: [
        { type: 'manual', config: {} },
        {
          type: 'webhook',
          config: { api_key: 'demo-webhook-api-key-org-a-2024' },
        },
      ],
    }
  );
  return data.insert_workflows_one.id;
}

async function main() {
  console.log('🌱 Seeding AI Workflow Builder demo data…\n');

  // ── Org A ─────────────────────────────────────────────────────────────────
  console.log('Creating Org A…');
  const orgAId = await createOrg('Org A — AI Research');
  console.log(`  ✓ Org A: ${orgAId}`);

  console.log('Creating Org A users…');
  const orgAOwnerId = await signUpUser('owner-orga@example.com', 'Password123!', 'Alice (Org A Owner)');
  const orgAEditorId = await signUpUser('editor-orga@example.com', 'Password123!', 'Bob (Org A Editor)');
  console.log(`  ✓ Owner: ${orgAOwnerId}`);
  console.log(`  ✓ Editor: ${orgAEditorId}`);

  await addMember(orgAId, orgAOwnerId, 'owner');
  await addMember(orgAId, orgAEditorId, 'editor');
  console.log('  ✓ Members added');

  const wfId = await createSampleWorkflow(orgAId, orgAOwnerId, 'Demo: LLM → HTTP → Branch → Approval → DB');
  console.log(`  ✓ Sample workflow: ${wfId}`);

  // ── Org B ─────────────────────────────────────────────────────────────────
  console.log('\nCreating Org B…');
  const orgBId = await createOrg('Org B — Data Team');
  console.log(`  ✓ Org B: ${orgBId}`);

  console.log('Creating Org B users…');
  const orgBOwnerId = await signUpUser('owner-orgb@example.com', 'Password123!', 'Carol (Org B Owner)');
  const orgBViewerId = await signUpUser('viewer-orgb@example.com', 'Password123!', 'Dave (Org B Viewer)');
  console.log(`  ✓ Owner: ${orgBOwnerId}`);
  console.log(`  ✓ Viewer: ${orgBViewerId}`);

  await addMember(orgBId, orgBOwnerId, 'owner');
  await addMember(orgBId, orgBViewerId, 'viewer');
  console.log('  ✓ Members added');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Org A accounts:');
  console.log('  owner-orga@example.com  / Password123!  (role: owner)');
  console.log('  editor-orga@example.com / Password123!  (role: editor)');
  console.log(`\nOrg A workflow ID: ${wfId}`);
  console.log(`Webhook API key: demo-webhook-api-key-org-a-2024`);
  console.log('\nOrg B accounts:');
  console.log('  owner-orgb@example.com  / Password123!  (role: owner)');
  console.log('  viewer-orgb@example.com / Password123!  (role: viewer)');
  console.log('\nCross-org isolation test:');
  console.log(`  Login as owner-orgb@example.com and try to query workflow ${wfId}`);
  console.log('  Expected: empty result / 403, not the workflow data');
  console.log('─────────────────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
