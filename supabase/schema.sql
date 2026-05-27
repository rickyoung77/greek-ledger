-- ============================================================
-- Greek Ledger — Schema
-- Run this first in the Supabase SQL editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── chapters ────────────────────────────────────────────────
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  semester    text not null,           -- e.g. 'Spring 2026'
  created_at  timestamptz not null default now()
);

-- ── members ─────────────────────────────────────────────────
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references chapters(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'Member',
  year        text not null,           -- Freshman / Sophomore / Junior / Senior
  dues_status text not null default 'Pending' check (dues_status in ('Paid', 'Pending')),
  email       text,
  created_at  timestamptz not null default now()
);

-- ── budget_accounts ─────────────────────────────────────────
-- parent_id is null for top-level accounts; set to another row's id for sub-accounts
create table if not exists budget_accounts (
  id            uuid primary key default gen_random_uuid(),
  chapter_id    uuid not null references chapters(id) on delete cascade,
  parent_id     uuid references budget_accounts(id) on delete cascade,
  name          text not null,
  total_budget  numeric(10,2) not null default 0,
  color         text not null default '#3b82f6',  -- hex color for UI
  created_at    timestamptz not null default now()
);

-- ── expenses ────────────────────────────────────────────────
create table if not exists expenses (
  id                uuid primary key default gen_random_uuid(),
  chapter_id        uuid not null references chapters(id) on delete cascade,
  budget_account_id uuid references budget_accounts(id) on delete set null,
  description       text not null,
  amount            numeric(10,2) not null,
  category          text not null,
  submitted_by      text not null,
  status            text not null default 'Pending' check (status in ('Approved', 'Pending', 'Rejected')),
  date              date not null default current_date,
  created_at        timestamptz not null default now()
);

-- ── notifications ────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references chapters(id) on delete cascade,
  title       text not null,
  message     text not null,
  type        text not null check (type in ('approval', 'pending', 'dues', 'budget', 'rejection', 'report')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Row Level Security (enable but open for now — tighten when auth is added) ──
alter table chapters       enable row level security;
alter table members        enable row level security;
alter table budget_accounts enable row level security;
alter table expenses       enable row level security;
alter table notifications  enable row level security;

-- Temporary open policies (replace with user-scoped policies once auth is wired up)
create policy "anon read chapters"        on chapters        for select using (true);
create policy "anon read members"         on members         for select using (true);
create policy "anon read budget_accounts" on budget_accounts for select using (true);
create policy "anon read expenses"        on expenses        for select using (true);
create policy "anon read notifications"   on notifications   for select using (true);

create policy "anon write chapters"        on chapters        for all using (true);
create policy "anon write members"         on members         for all using (true);
create policy "anon write budget_accounts" on budget_accounts for all using (true);
create policy "anon write expenses"        on expenses        for all using (true);
create policy "anon write notifications"   on notifications   for all using (true);

-- ── Helpful indexes ──────────────────────────────────────────
create index if not exists idx_members_chapter        on members        (chapter_id);
create index if not exists idx_budget_accounts_chapter on budget_accounts (chapter_id);
create index if not exists idx_budget_accounts_parent  on budget_accounts (parent_id);
create index if not exists idx_expenses_chapter        on expenses        (chapter_id);
create index if not exists idx_expenses_account        on expenses        (budget_account_id);
create index if not exists idx_expenses_status         on expenses        (status);
create index if not exists idx_notifications_chapter   on notifications   (chapter_id);
