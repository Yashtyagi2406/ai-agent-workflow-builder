-- org_members table
create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_members_user_id_idx on public.org_members(user_id);
create index if not exists org_members_org_id_idx on public.org_members(org_id);
