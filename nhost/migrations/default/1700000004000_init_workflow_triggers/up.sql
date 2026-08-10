-- workflow_triggers table
create table if not exists public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  type text not null check (type in ('manual', 'webhook', 'scheduled', 'database_event')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists workflow_triggers_workflow_id_idx on public.workflow_triggers(workflow_id);

-- Layer 2: Only owners can add webhook or database_event triggers
create or replace function public.enforce_trigger_type_permission()
returns trigger as $$
declare
  v_org_id uuid;
  v_user_id text;
  v_role text;
begin
  v_user_id := current_setting('hasura.user.id', true);

  if v_user_id is null or v_user_id = '' then
    return NEW;
  end if;

  select org_id into v_org_id
  from public.workflows
  where id = NEW.workflow_id;

  if v_org_id is null then
    raise exception 'Workflow not found';
  end if;

  select role into v_role
  from public.org_members
  where org_id = v_org_id and user_id = v_user_id::uuid;

  if v_role is null then
    raise exception 'Not a member of this organization';
  end if;

  if NEW.type in ('webhook', 'database_event') and v_role != 'owner' then
    raise exception 'Only org owners can add % triggers', NEW.type
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger enforce_trigger_type_permission_trigger
  before insert or update on public.workflow_triggers
  for each row execute function public.enforce_trigger_type_permission();
