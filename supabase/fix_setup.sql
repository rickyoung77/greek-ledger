-- ============================================================
-- Greek Ledger — Setup Fix Migration
-- Run this in the Supabase SQL editor if chapter creation is broken.
-- Mostly safe to re-run (schema + policy steps use IF NOT EXISTS / DROP IF EXISTS).
-- EXCEPTION: Step 4 hard-overwrites two specific rows on every run — see the note there.
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
create index if not exists idx_members_user_id   on members  (user_id);

-- join_code must be UNIQUE: the join flow looks a chapter up by code and takes the
-- first row, so two chapters sharing a code would silently route members to the
-- wrong chapter. Wrapped in a block so that if the live data already has duplicate
-- codes, the migration raises a NOTICE instead of aborting every step after it.
do $$
begin
  drop index if exists idx_chapters_join_code;
  create unique index idx_chapters_join_code on chapters (join_code) where join_code is not null;
exception when others then
  raise notice 'Skipped UNIQUE index on chapters.join_code — resolve duplicate join codes first, then re-run. Detail: %', sqlerrm;
end $$;


-- ── Step 3: Fix the members RLS policies ─────────────────────
--
-- The original members_insert policy only allowed chapter OWNERS to insert
-- member records. This blocks the join flow where a new user inserts
-- themselves into a chapter they don't own.
--
-- The original members_select policy only allowed chapter owners to see
-- members, creating a catch-22: you can't see your own member record until
-- you own a chapter.

-- Policies are inert unless RLS is actually enabled — ensure it (idempotent).
alter table chapters enable row level security;
alter table members  enable row level security;

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


-- ── Step 4: Backfill existing rows ────────────────────────────────
-- IMPORTANT: The user IDs below must match the EXACT uid shown on
-- the CompleteSetup screen (uid: xxxxx). If the app still shows
-- CompleteSetup after login, your logged-in user ID may be different
-- from what's stored — update these values to match the uid on screen.
--
-- The AND user_id IS NULL guard is removed so this overwrites any
-- wrong value that may have been set previously.
--
-- These two rows are now confirmed correct in the DB, so the UPDATEs below are
-- no-ops. Once you're past this bug, delete this entire Step 4 — leaving hard-coded
-- IDs in a re-runnable migration risks silently clobbering data later.

update chapters
  set user_id = '352f352b-e1f9-414e-b3f4-40a72fec6680'
  where id = 'faf704d9-a034-4d5d-9f0a-03d5f9039c76';

update members
  set user_id = '352f352b-e1f9-414e-b3f4-40a72fec6680'
  where id = 'ae25fc5b-71a7-46c0-a19c-54a08cdd09b8';


-- ── Verify ───────────────────────────────────────────────────
-- Run these after to confirm the fix worked:
--
-- select id, name, user_id from chapters where id = 'faf704d9-a034-4d5d-9f0a-03d5f9039c76';
-- select id, full_name, user_id from members where id = 'ae25fc5b-71a7-46c0-a19c-54a08cdd09b8';
--
-- Both user_id fields should show: 352f352b-e1f9-414e-b3f4-40a72fec6680
--
-- Also confirm columns and policies:
-- select column_name, data_type from information_schema.columns
--   where table_name in ('chapters','members') and table_schema = 'public'
--   order by table_name, ordinal_position;
--
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename in ('chapters','members')
--   order by tablename, cmd;
