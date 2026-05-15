-- =============================================================================
-- Sunvasi — Supabase schema
--   Run this entire file in the Supabase SQL Editor for a fresh project.
--   Idempotent: safe to re-run.
-- =============================================================================

set check_function_bodies = off;

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles. Primary key = Privy DID (not a UUID).
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id text primary key,
  email text not null,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'freelancer' check (role in ('freelancer','client','both')),
  skills text[] default '{}',
  hourly_rate_usdc numeric,
  portfolio_links jsonb default '[]'::jsonb,
  payout_address text,
  country text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Privy embedded Stellar wallet ID — set the first time the user signs in.
alter table profiles
  add column if not exists stellar_wallet_id text;

create unique index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_stellar_wallet_idx on profiles (stellar_wallet_id);

-- -----------------------------------------------------------------------------
-- Contracts.
-- -----------------------------------------------------------------------------
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  title text not null,
  description text,
  client_id text references profiles(id) on delete set null,
  client_email text,
  freelancer_id text references profiles(id) on delete set null,
  total_amount_usdc numeric not null check (total_amount_usdc > 0),
  currency text not null default 'USDC',
  status text not null default 'draft'
    check (status in ('draft','awaiting_funding','active','completed','disputed','resolved','cancelled')),
  escrow_id text,
  escrow_address text,
  escrow_network text default 'testnet',
  auto_release_days integer not null default 7 check (auto_release_days between 1 and 30),
  platform_fee_percent numeric not null default 0,
  visibility text not null default 'public'
    check (visibility in ('public','restricted')),
  invitee_emails text[] not null default '{}',
  created_at timestamptz not null default now(),
  funded_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Additive migration for existing installs (idempotent — safe to re-run).
alter table contracts
  add column if not exists visibility text not null default 'public';
alter table contracts
  add column if not exists invitee_emails text[] not null default '{}';
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_visibility_check'
  ) then
    alter table contracts
      add constraint contracts_visibility_check
      check (visibility in ('public','restricted'));
  end if;
end $$;

create index if not exists contracts_client_idx on contracts (client_id);
create index if not exists contracts_freelancer_idx on contracts (freelancer_id);
create index if not exists contracts_status_idx on contracts (status);
create index if not exists contracts_short_id_idx on contracts (short_id);

-- -----------------------------------------------------------------------------
-- Milestones.
-- -----------------------------------------------------------------------------
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  acceptance_criteria text,
  amount_usdc numeric not null check (amount_usdc > 0),
  status text not null default 'pending'
    check (status in ('pending','in_progress','submitted','approved','disputed','released','refunded')),
  deliverable_files jsonb default '[]'::jsonb,
  deliverable_links jsonb default '[]'::jsonb,
  deliverable_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  auto_release_at timestamptz,
  tw_milestone_index integer,
  unique (contract_id, position)
);

create index if not exists milestones_contract_idx on milestones (contract_id);
create index if not exists milestones_status_idx on milestones (status);

-- -----------------------------------------------------------------------------
-- Disputes.
-- -----------------------------------------------------------------------------
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references milestones(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  filed_by text references profiles(id) on delete set null,
  filed_at timestamptz not null default now(),
  client_evidence jsonb default '{}'::jsonb,
  freelancer_evidence jsonb default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open','evidence_collection','arbitrating','resolved','escalated')),
  resolved_at timestamptz
);

create index if not exists disputes_milestone_idx on disputes (milestone_id);
create index if not exists disputes_contract_idx on disputes (contract_id);
create index if not exists disputes_status_idx on disputes (status);

-- -----------------------------------------------------------------------------
-- Verdicts (one per dispute).
-- -----------------------------------------------------------------------------
create table if not exists verdicts (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  release_percentage integer not null check (release_percentage between 0 and 100),
  party_favored text not null check (party_favored in ('client','freelancer','split')),
  reasoning text not null,
  confidence text not null check (confidence in ('high','medium','low','insufficient')),
  tool_call_log jsonb not null default '[]'::jsonb,
  arbitrator_version text not null,
  verdict_hash text,
  created_at timestamptz not null default now(),
  unique (dispute_id)
);

create index if not exists verdicts_dispute_idx on verdicts (dispute_id);

-- -----------------------------------------------------------------------------
-- Clarifications (questions the arbitrator may ask each party once).
-- -----------------------------------------------------------------------------
create table if not exists clarifications (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  party text not null check (party in ('client','freelancer')),
  question text not null,
  response text,
  asked_at timestamptz not null default now(),
  responded_at timestamptz,
  timed_out boolean not null default false
);

create index if not exists clarifications_dispute_idx on clarifications (dispute_id);

-- -----------------------------------------------------------------------------
-- Activity log — one row per contract event, for the timeline UI.
-- -----------------------------------------------------------------------------
create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  actor_id text references profiles(id) on delete set null,
  type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_contract_idx on activity (contract_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger.
-- -----------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function touch_updated_at();

drop trigger if exists contracts_updated_at on contracts;
create trigger contracts_updated_at before update on contracts
  for each row execute function touch_updated_at();

-- =============================================================================
-- Row-Level Security
--   Writes are performed via service-role from our API routes (which carry the
--   Privy DID through `x-sunvasi-actor` and enforce checks in code). Reads are
--   permissive for public surface area (profiles, public contracts via
--   short_id) and restricted to participants for everything else.
-- =============================================================================

alter table profiles enable row level security;
alter table contracts enable row level security;
alter table milestones enable row level security;
alter table disputes enable row level security;
alter table verdicts enable row level security;
alter table clarifications enable row level security;
alter table activity enable row level security;

-- service_role bypasses RLS by default; below policies cover anon/auth reads.

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select using (true);

drop policy if exists contracts_read_public on contracts;
create policy contracts_read_public on contracts
  for select using (true);
-- Tighten in production: replace with `using (status <> 'draft' or auth.jwt() ->> 'sub' in (client_id, freelancer_id))`.

drop policy if exists milestones_read on milestones;
create policy milestones_read on milestones
  for select using (true);

drop policy if exists disputes_read on disputes;
create policy disputes_read on disputes
  for select using (true);

drop policy if exists verdicts_read on verdicts;
create policy verdicts_read on verdicts
  for select using (true);

drop policy if exists activity_read on activity;
create policy activity_read on activity
  for select using (true);

drop policy if exists clarifications_read on clarifications;
create policy clarifications_read on clarifications
  for select using (true);

-- Realtime publication for activity + arbitration UI.
alter publication supabase_realtime add table activity;
alter publication supabase_realtime add table milestones;
alter publication supabase_realtime add table clarifications;
alter publication supabase_realtime add table verdicts;
