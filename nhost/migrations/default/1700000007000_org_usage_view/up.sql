-- org_usage_this_month view (computed aggregation)
create or replace view public.org_usage_this_month as
select
  o.id as org_id,
  o.name as org_name,
  o.calls_allowed,
  o.calls_used,
  round(100.0 * o.calls_used / nullif(o.calls_allowed, 0), 1) as pct_used,
  (
    select avg(extract(epoch from (r.finished_at - r.started_at)))
    from public.workflow_runs r
    inner join public.workflows w on w.id = r.workflow_id
    where w.org_id = o.id
      and r.finished_at is not null
      and r.started_at >= date_trunc('month', now())
  ) as avg_run_duration_seconds,
  (
    select count(*)
    from public.workflow_runs r
    inner join public.workflows w on w.id = r.workflow_id
    where w.org_id = o.id
      and r.started_at >= date_trunc('month', now())
  ) as runs_this_month
from public.organizations o;

-- workflow_results table for db_write steps
create table if not exists public.workflow_results (
  id uuid primary key default gen_random_uuid(),
  step_run_id uuid not null references public.step_runs(id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
