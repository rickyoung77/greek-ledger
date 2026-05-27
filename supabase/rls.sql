-- ============================================================
-- Greek Ledger — Complete RLS Setup
-- Run this once in the Supabase SQL editor.
-- Safe to re-run: all DROP IF EXISTS before CREATE.
-- ============================================================


-- ── Step 1: Add user_id to chapters ──────────────────────────
alter table chapters
  add column if not exists user_id uuid references auth.users(id) on delete cascade;


-- ── Step 2: Enable RLS on all tables ─────────────────────────
alter table chapters        enable row level security;
alter table members         enable row level security;
alter table budget_accounts enable row level security;
alter table expenses        enable row level security;
alter table notifications   enable row level security;


-- ── Step 3: Drop existing policies ───────────────────────────

-- chapters
drop policy if exists "chapters_select" on chapters;
drop policy if exists "chapters_insert" on chapters;
drop policy if exists "chapters_update" on chapters;
drop policy if exists "chapters_delete" on chapters;

-- members
drop policy if exists "members_select" on members;
drop policy if exists "members_insert" on members;
drop policy if exists "members_update" on members;
drop policy if exists "members_delete" on members;

-- budget_accounts
drop policy if exists "budget_accounts_select" on budget_accounts;
drop policy if exists "budget_accounts_insert" on budget_accounts;
drop policy if exists "budget_accounts_update" on budget_accounts;
drop policy if exists "budget_accounts_delete" on budget_accounts;

-- expenses
drop policy if exists "expenses_select" on expenses;
drop policy if exists "expenses_insert" on expenses;
drop policy if exists "expenses_update" on expenses;
drop policy if exists "expenses_delete" on expenses;

-- notifications
drop policy if exists "notifications_select" on notifications;
drop policy if exists "notifications_insert" on notifications;
drop policy if exists "notifications_update" on notifications;
drop policy if exists "notifications_delete" on notifications;

-- legacy names from earlier attempts
drop policy if exists "anon read chapters"         on chapters;
drop policy if exists "anon write chapters"        on chapters;
drop policy if exists "anon read members"          on members;
drop policy if exists "anon write members"         on members;
drop policy if exists "anon read budget_accounts"  on budget_accounts;
drop policy if exists "anon write budget_accounts" on budget_accounts;
drop policy if exists "anon read expenses"         on expenses;
drop policy if exists "anon write expenses"        on expenses;
drop policy if exists "anon read notifications"    on notifications;
drop policy if exists "anon write notifications"   on notifications;


-- ── Step 4: Create RLS policies ──────────────────────────────

-- chapters — owned by the auth user who created them
create policy "chapters_select"
  on chapters for select
  using (user_id = auth.uid());

create policy "chapters_insert"
  on chapters for insert
  with check (user_id = auth.uid());

create policy "chapters_update"
  on chapters for update
  using (user_id = auth.uid());

create policy "chapters_delete"
  on chapters for delete
  using (user_id = auth.uid());


-- members
create policy "members_select"
  on members for select
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "members_insert"
  on members for insert
  with check (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "members_update"
  on members for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "members_delete"
  on members for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- budget_accounts
create policy "budget_accounts_select"
  on budget_accounts for select
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "budget_accounts_insert"
  on budget_accounts for insert
  with check (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "budget_accounts_update"
  on budget_accounts for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "budget_accounts_delete"
  on budget_accounts for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- expenses
create policy "expenses_select"
  on expenses for select
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "expenses_insert"
  on expenses for insert
  with check (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "expenses_update"
  on expenses for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "expenses_delete"
  on expenses for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- notifications
create policy "notifications_select"
  on notifications for select
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "notifications_insert"
  on notifications for insert
  with check (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "notifications_update"
  on notifications for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "notifications_delete"
  on notifications for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- ── Verify ───────────────────────────────────────────────────
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd;
