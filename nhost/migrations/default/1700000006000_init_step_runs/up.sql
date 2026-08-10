-- step_runs table
create table if not exists public.step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id),
  status text not null check (status in (
    'pending', 'running', 'succeeded', 'failed', 'paused_awaiting_approval', 'skipped'
  )) default 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt_count int not null default 0,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists step_runs_workflow_run_id_idx on public.step_runs(workflow_run_id);
create index if not exists step_runs_status_idx on public.step_runs(status);
