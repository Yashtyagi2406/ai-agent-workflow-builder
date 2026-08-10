-- workflow_runs table
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  status text not null check (status in (
    'pending', 'running', 'paused', 'completed', 'failed'
  )) default 'pending',
  started_by uuid references auth.users(id),
  trigger_type text not null check (trigger_type in (
    'manual', 'webhook', 'scheduled', 'database_event'
  )),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists workflow_runs_workflow_id_idx on public.workflow_runs(workflow_id);
create index if not exists workflow_runs_status_idx on public.workflow_runs(status);
