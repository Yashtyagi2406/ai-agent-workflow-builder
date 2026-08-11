import fs from 'fs';
import path from 'path';

const HASURA_BASE = process.env.HASURA_GRAPHQL_URL
  ? process.env.HASURA_GRAPHQL_URL.replace('/v1/graphql', '')
  : 'http://localhost:8080';

const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? 'nhost-admin-secret';

async function queryEndpoint(endpoint: string, type: string, args: Record<string, unknown>) {
  const res = await fetch(`${HASURA_BASE}/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ type, args }),
  });
  return res.json();
}

async function initHasura() {
  console.log('⚡ Initializing Hasura & Postgres schema…');

  // 1. Create auth schema and mock auth.users table if not present
  const initAuthSql = `
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      created_at timestamptz default now()
    );
  `;
  await queryEndpoint('query', 'run_sql', { source: 'default', sql: initAuthSql, cascade: true });

  // 2. Read and apply all up.sql migrations in order
  const migDir = path.join(process.cwd(), 'nhost/migrations/default');
  const folders = fs.readdirSync(migDir).sort();
  for (const folder of folders) {
    const upPath = path.join(migDir, folder, 'up.sql');
    if (fs.existsSync(upPath)) {
      const sql = fs.readFileSync(upPath, 'utf8');
      console.log(`  Applying migration: ${folder}…`);
      const result = await queryEndpoint('query', 'run_sql', { source: 'default', sql, cascade: true });
      if (result?.error) {
        console.warn(`  Warning in ${folder}:`, result.error.message || result.error);
      }
    }
  }

  // 3. Track all tables and views in Hasura
  await queryEndpoint('v2/query', 'run_sql', {
    source: 'default',
    sql: `
      ALTER TABLE public.workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_workflow_id_fkey;
      ALTER TABLE public.workflow_steps ADD CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

      ALTER TABLE public.workflow_triggers DROP CONSTRAINT IF EXISTS workflow_triggers_workflow_id_fkey;
      ALTER TABLE public.workflow_triggers ADD CONSTRAINT workflow_triggers_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

      ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_workflow_id_fkey;
      ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

      ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_workflow_run_id_fkey;
      ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE CASCADE;

      ALTER TABLE public.step_runs DROP CONSTRAINT IF EXISTS step_runs_workflow_step_id_fkey;
      ALTER TABLE public.step_runs ADD CONSTRAINT step_runs_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.workflow_steps(id) ON DELETE CASCADE;
    `,
  }).catch(() => {});

  const tables = [
    { schema: 'auth', name: 'users' },
    { schema: 'public', name: 'organizations' },
    { schema: 'public', name: 'org_members' },
    { schema: 'public', name: 'workflows' },
    { schema: 'public', name: 'workflow_steps' },
    { schema: 'public', name: 'workflow_triggers' },
    { schema: 'public', name: 'workflow_runs' },
    { schema: 'public', name: 'step_runs' },
    { schema: 'public', name: 'org_usage_this_month' },
    { schema: 'public', name: 'workflow_results' },
  ];

  for (const table of tables) {
    await queryEndpoint('metadata', 'pg_track_table', {
      source: 'default',
      table,
    }).catch(() => {});
  }

  // 4. Track relationships
  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'organizations' },
    name: 'org_members',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'org_members' }, column: 'org_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'organizations' },
    name: 'workflows',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'workflows' }, column: 'org_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_object_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflows' },
    name: 'organization',
    using: { foreign_key_constraint_on: 'org_id' },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_object_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'org_members' },
    name: 'organization',
    using: { foreign_key_constraint_on: 'org_id' },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflows' },
    name: 'workflow_steps',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'workflow_steps' }, column: 'workflow_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflows' },
    name: 'workflow_triggers',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'workflow_triggers' }, column: 'workflow_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflows' },
    name: 'workflow_runs',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'workflow_runs' }, column: 'workflow_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_object_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflow_runs' },
    name: 'workflow',
    using: { foreign_key_constraint_on: 'workflow_id' },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_array_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'workflow_runs' },
    name: 'step_runs',
    using: { foreign_key_constraint_on: { table: { schema: 'public', name: 'step_runs' }, column: 'workflow_run_id' } },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_object_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'step_runs' },
    name: 'workflow_run',
    using: { foreign_key_constraint_on: 'workflow_run_id' },
  }).catch(() => {});

  await queryEndpoint('metadata', 'pg_create_object_relationship', {
    source: 'default',
    table: { schema: 'public', name: 'step_runs' },
    name: 'workflow_step',
    using: { foreign_key_constraint_on: 'workflow_step_id' },
  }).catch(() => {});

  // 5. Apply Layer 1 permissions (select for owner, editor, viewer on workflows & org_members)
  const roles = ['owner', 'editor', 'viewer'];
  for (const role of roles) {
    // workflows select permission
    await queryEndpoint('metadata', 'pg_create_select_permission', {
      source: 'default',
      table: { schema: 'public', name: 'workflows' },
      role,
      permission: {
        columns: '*',
        filter: {
          organization: {
            org_members: {
              user_id: { _eq: 'X-Hasura-User-Id' },
            },
          },
        },
      },
    }).catch(() => {});

    // organizations select permission
    await queryEndpoint('metadata', 'pg_create_select_permission', {
      source: 'default',
      table: { schema: 'public', name: 'organizations' },
      role,
      permission: {
        columns: '*',
        filter: {
          org_members: {
            user_id: { _eq: 'X-Hasura-User-Id' },
          },
        },
      },
    }).catch(() => {});

    // org_members select permission
    await queryEndpoint('metadata', 'pg_create_select_permission', {
      source: 'default',
      table: { schema: 'public', name: 'org_members' },
      role,
      permission: {
        columns: '*',
        filter: {
          organization: {
            org_members: {
              user_id: { _eq: 'X-Hasura-User-Id' },
            },
          },
        },
      },
    }).catch(() => {});

    // step_runs select permission
    await queryEndpoint('metadata', 'pg_create_select_permission', {
      source: 'default',
      table: { schema: 'public', name: 'step_runs' },
      role,
      permission: {
        columns: '*',
        filter: {
          workflow_run: {
            workflow: {
              organization: {
                org_members: {
                  user_id: { _eq: 'X-Hasura-User-Id' },
                },
              },
            },
          },
        },
      },
    }).catch(() => {});

    // workflow_runs select permission
    await queryEndpoint('metadata', 'pg_create_select_permission', {
      source: 'default',
      table: { schema: 'public', name: 'workflow_runs' },
      role,
      permission: {
        columns: '*',
        filter: {
          workflow: {
            organization: {
              org_members: {
                user_id: { _eq: 'X-Hasura-User-Id' },
              },
            },
          },
        },
      },
    }).catch(() => {});
  }

  // Insert permissions for owner and editor
  for (const role of ['owner', 'editor']) {
    await queryEndpoint('metadata', 'pg_create_insert_permission', {
      source: 'default',
      table: { schema: 'public', name: 'workflows' },
      role,
      permission: {
        check: {},
        columns: '*',
      },
    }).catch(() => {});

    await queryEndpoint('metadata', 'pg_create_insert_permission', {
      source: 'default',
      table: { schema: 'public', name: 'workflow_steps' },
      role,
      permission: {
        check: {},
        columns: '*',
      },
    }).catch(() => {});

    await queryEndpoint('metadata', 'pg_create_insert_permission', {
      source: 'default',
      table: { schema: 'public', name: 'workflow_triggers' },
      role,
      permission: {
        check: {},
        columns: '*',
      },
    }).catch(() => {});
  }

  // Delete permission for owner role
  await queryEndpoint('metadata', 'pg_create_delete_permission', {
    source: 'default',
    table: { schema: 'public', name: 'workflows' },
    role: 'owner',
    permission: {
      filter: {},
    },
  }).catch(() => {});

  // 6. Register Hasura Actions in metadata
  await queryEndpoint('metadata', 'set_custom_types', {
    scalars: [],
    enums: [],
    input_objects: [
      {
        name: 'TriggerWorkflowRunInput',
        fields: [{ name: 'workflow_id', type: 'uuid!' }],
      },
      {
        name: 'ApproveStepInput',
        fields: [{ name: 'step_run_id', type: 'uuid!' }],
      },
    ],
    objects: [
      {
        name: 'WorkflowRunResult',
        fields: [
          { name: 'workflow_run_id', type: 'uuid!' },
          { name: 'status', type: 'String!' },
          { name: 'message', type: 'String!' },
        ],
      },
      {
        name: 'ApproveStepResult',
        fields: [
          { name: 'step_run_id', type: 'uuid!' },
          { name: 'status', type: 'String!' },
          { name: 'message', type: 'String!' },
        ],
      },
    ],
  }).catch(() => {});

  const functionsUrl = process.env.NHOST_FUNCTIONS_URL || process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://host.docker.internal:5005';

  await queryEndpoint('metadata', 'create_action', {
    name: 'triggerWorkflowRun',
    definition: {
      kind: 'synchronous',
      handler: `${functionsUrl}/triggerWorkflowRun`,
      arguments: [{ name: 'input', type: 'TriggerWorkflowRunInput!' }],
      output_type: 'WorkflowRunResult',
      forward_client_headers: true,
    },
  }).catch(() => {});

  await queryEndpoint('metadata', 'create_action', {
    name: 'approveStep',
    definition: {
      kind: 'synchronous',
      handler: `${functionsUrl}/approveStep`,
      arguments: [{ name: 'input', type: 'ApproveStepInput!' }],
      output_type: 'ApproveStepResult',
      forward_client_headers: true,
    },
  }).catch(() => {});

  // Reload metadata
  await queryEndpoint('metadata', 'reload_metadata', {});

  console.log('✅ Hasura schema initialization complete!\n');
}

initHasura().catch((err) => {
  console.error('❌ Hasura initialization failed:', err);
  process.exit(1);
});
