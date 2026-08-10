-- organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quota_period_start date not null default date_trunc('month', now())::date,
  calls_allowed int not null default 1000,
  calls_used int not null default 0,
  created_at timestamptz not null default now()
);
