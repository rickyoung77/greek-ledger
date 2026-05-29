-- ============================================================
-- Greek Ledger — Setup Fix Migration
-- Run this in the Supabase SQL editor if chapter creation is broken.
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================


-- ── Step 1: Ensure all required columns exist ─────────────────

-- chapters needs user_id and join_code
alter table chapters
  add column if not exists user_id   uuid references auth.users(id) on delete cascade;
alter table chapters
  add column if not exists join_code text;

-- members needs user_id
alter table members
  add column if not exists user_id uuid references auth.users(id) on delete set null;


-- ── Step 2: Indexes ───────────────────────────────────────────

create index if not exists idx_chapters_user_id  on chapters (user_id);
create index if not exists idx_chapters_join_code on chapters (join_code);
create index if not exists idx_members_user_id   on members  (user_id);


-- ── Step 3: Fix the members RLS policies ─────────────────────
--
-- The original members_insert policy only allowed chapter OWNERS to insert
-- member records. This blocks the join flow where a new user inserts
-- themselves into a chapter they don't own.
--
-- The original members_select policy only allowed chapter owners to see
-- members, creating a catch-22: you can't see your own member record until
-- you own a chapter.

drop policy if exists "members_insert" on members;
drop policy if exists "members_select" on members;
drop policy if exists "members_update" on members;
drop policy if exists "members_delete" on members;

-- SELECT: chapter owner sees all members; any member sees their own record
create policy "members_select"
  on members for select
  using (
    chapter_id in (select id from chapters where user_id = auth.uid())
    or user_id = auth.uid()
  );

-- INSERT: chapter owner inserts any member (create flow) OR user inserts themselves (join flow)
create policy "members_insert"
  on members for insert
  with check (
    chapter_id in (select id from chapters where user_id = auth.uid())
    or user_id = auth.uid()
  );

-- UPDATE / DELETE: chapter owner only
create policy "members_update"
  on members for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "members_delete"
  on members for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- ── Verify ───────────────────────────────────────────────────
-- Run this query after to confirm columns and policies look right:
--
-- select column_name, data_type
-- from information_schema.columns
-- where table_name in ('chapters','members') and table_schema = 'public'
-- order by table_name, ordinal_position;
--
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'public' and tablename in ('chapters','members')
-- order by tablename, cmd;
