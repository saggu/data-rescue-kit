-- CRM Import Rescue customer portal schema.
--
-- Run this in the Supabase SQL editor after creating a project.
-- The app stores workflow contracts and run metadata, not raw CSV rows.

create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  workflow_contract_id text not null,
  workflow_name text not null,
  version text not null,
  crm_target text not null,
  crm_preset text not null default 'hubspot',
  source_format text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'retired', 'demo')),
  expected_columns text[] not null default '{}',
  required_columns text[] not null default '{}',
  cleanup_rules jsonb not null default '{}'::jsonb,
  included_fixes_until date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  workflow_id uuid references workflows (id) on delete set null,
  workflow_contract_id text not null,
  workflow_name text,
  workflow_version text,
  run_status text not null check (run_status in ('matched', 'needs_update', 'blocked', 'invalid', 'unscoped')),
  file_name text,
  row_count integer not null default 0,
  column_count integer not null default 0,
  column_names text[] not null default '{}',
  missing_expected_columns text[] not null default '{}',
  missing_required_columns text[] not null default '{}',
  extra_columns text[] not null default '{}',
  issue_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  workflow_contract_id text not null,
  title text not null,
  notes text,
  status text not null default 'requested' check (status in ('requested', 'quoted', 'approved', 'done', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  workflow_contract_id text,
  provider text not null default 'stripe',
  provider_payment_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table workflows enable row level security;
alter table workflow_runs enable row level security;
alter table change_requests enable row level security;
alter table payments enable row level security;

create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create policy "members can read organizations"
  on organizations for select
  using (is_org_member(id));

create policy "members can read memberships"
  on organization_members for select
  using (is_org_member(organization_id));

create policy "members can read workflows"
  on workflows for select
  using (organization_id is null or is_org_member(organization_id));

create policy "members can read workflow runs"
  on workflow_runs for select
  using (
    user_id = auth.uid()
    or organization_id is null
    or is_org_member(organization_id)
  );

create policy "signed in users can insert their workflow runs"
  on workflow_runs for insert
  with check (user_id = auth.uid());

create policy "members can read change requests"
  on change_requests for select
  using (
    user_id = auth.uid()
    or organization_id is null
    or is_org_member(organization_id)
  );

create policy "signed in users can insert change requests"
  on change_requests for insert
  with check (user_id = auth.uid());

create policy "members can read payments"
  on payments for select
  using (organization_id is null or is_org_member(organization_id));

create index if not exists workflow_runs_user_created_idx on workflow_runs (user_id, created_at desc);
create index if not exists workflow_runs_contract_idx on workflow_runs (workflow_contract_id, created_at desc);
create index if not exists change_requests_user_created_idx on change_requests (user_id, created_at desc);
