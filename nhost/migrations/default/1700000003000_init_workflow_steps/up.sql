-- workflow_steps table
create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  step_order int not null,
  type text not null check (type in (
    'llm_call', 'http_request', 'db_write', 'notify',
    'conditional_branch', 'approval_gate'
  )),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

create index if not exists workflow_steps_workflow_id_idx on public.workflow_steps(workflow_id);

-- Layer 2: Step-level permission gating at DB level
-- Only org owners can create db_write, notify, or approval_gate steps
-- This catches any attempt that bypasses the API layer

create or replace function public.enforce_step_type_permission()
returns trigger as $$
declare
  v_org_id uuid;
  v_user_id text;
  v_role text;
begin
  -- Get the caller's user id from Hasura session variable
  v_user_id := current_setting('hasura.user.id', true);

  -- If no session var (e.g. admin/service role call), allow
  if v_user_id is null or v_user_id = '' then
    return NEW;
  end if;

  -- Get the org for this workflow
  select org_id into v_org_id
  from public.workflows
  where id = NEW.workflow_id;

  if v_org_id is null then
    raise exception 'Workflow not found';
  end if;

  -- Get the caller's role in this org
  select role into v_role
  from public.org_members
  where org_id = v_org_id and user_id = v_user_id::uuid;

  if v_role is null then
    raise exception 'Not a member of this organization';
  end if;

  -- Only owners can add restricted step types
  if NEW.type in ('db_write', 'notify', 'approval_gate') and v_role != 'owner' then
    raise exception 'Only org owners can add % steps', NEW.type
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger enforce_step_type_permission_trigger
  before insert or update on public.workflow_steps
  for each row execute function public.enforce_step_type_permission();
