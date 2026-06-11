-- ============================================================
-- Greek Ledger — SCHEMA (single source of truth)
-- ============================================================
-- Run order (Supabase SQL editor):
--   1. reset.sql   (wipes the drifted DB — destructive, run once)
--   2. schema.sql  (THIS FILE — rebuilds tables, RLS, functions)
--
-- This file is idempotent: safe to re-run. It is the ONLY place
-- schema/RLS lives. Never edit policies ad-hoc in the dashboard —
-- that drift is what caused the auth hang. Change this file, re-run it.
--
-- KEY DESIGN: access is by CHAPTER MEMBERSHIP, not ownership.
-- A SECURITY DEFINER function `user_belongs_to_chapter()` checks
-- membership while BYPASSING RLS, so no policy ever queries its own
-- table — eliminating the infinite-recursion that hung every
-- authenticated query.
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- TABLES
-- ============================================================

-- ── chapters ────────────────────────────────────────────────
-- created_by = the auth user who created the chapter (the admin).
-- join_code  = 6-char code members enter to join. Generated server-side.
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  semester    text not null,
  join_code   text unique,
  created_by  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── members ─────────────────────────────────────────────────
-- This IS the access table: a row links an auth user to a chapter.
-- user_id is null for members an admin adds manually before they sign up.
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references chapters(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  full_name   text not null,
  role        text not null default 'Member',
  year        text,
  dues_status text not null default 'Pending' check (dues_status in ('Paid', 'Pending')),
  email       text,
  -- When true, a non-admin member may submit expenses (always forced to
  -- Pending). Admins (creator / Treasurer / President) can submit regardless.
  can_submit_expenses boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id)   -- one membership per signed-up user (multiple NULLs allowed)
);

-- Idempotent add for databases created before this column existed.
alter table members add column if not exists can_submit_expenses boolean not null default false;

-- ── budget_accounts ─────────────────────────────────────────
-- parent_id null => top-level account; set => sub-account.
create table if not exists budget_accounts (
  id            uuid primary key default gen_random_uuid(),
  chapter_id    uuid not null references chapters(id) on delete cascade,
  parent_id     uuid references budget_accounts(id) on delete cascade,
  name          text not null,
  total_budget  numeric(12,2) not null default 0,
  color         text not null default '#3b82f6',
  created_at    timestamptz not null default now()
);

-- ── expenses ────────────────────────────────────────────────
create table if not exists expenses (
  id                uuid primary key default gen_random_uuid(),
  chapter_id        uuid not null references chapters(id) on delete cascade,
  budget_account_id uuid references budget_accounts(id) on delete set null,
  description       text not null,
  amount            numeric(12,2) not null,
  category          text not null,
  submitted_by      text not null,
  status            text not null default 'Pending' check (status in ('Approved', 'Pending', 'Rejected')),
  date              date not null default current_date,
  -- Path in the private 'receipts' storage bucket of the attached invoice
  -- file (PDF/image). null = no receipt attached. Format: <chapter_id>/<expense_id>/<filename>
  receipt_path      text,
  created_at        timestamptz not null default now()
);
-- Idempotent add for databases created before this column existed.
alter table expenses add column if not exists receipt_path text;

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

-- ── dues_collections ─────────────────────────────────────────
create table if not exists dues_collections (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid not null references chapters(id) on delete cascade,
  name         text not null,
  due_date     date,
  payment_link text,
  status       text not null default 'active' check (status in ('active', 'closed')),
  created_at   timestamptz not null default now()
);

-- ── dues_tiers ───────────────────────────────────────────────
create table if not exists dues_tiers (
  id                  uuid primary key default gen_random_uuid(),
  dues_collection_id  uuid not null references dues_collections(id) on delete cascade,
  classification      text not null,   -- 'Freshman', 'Officer', etc.
  amount              numeric(12,2) not null default 0,
  created_at          timestamptz not null default now()
);

-- ── member_dues ──────────────────────────────────────────────
-- last_reminder_sent is read/written by the Dues page reminder flow.
create table if not exists member_dues (
  id                  uuid primary key default gen_random_uuid(),
  dues_collection_id  uuid not null references dues_collections(id) on delete cascade,
  member_id           uuid not null references members(id) on delete cascade,
  amount_owed         numeric(12,2) not null default 0,
  status              text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  last_reminder_sent  timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_members_chapter           on members          (chapter_id);
create index if not exists idx_members_user              on members          (user_id);
create index if not exists idx_budget_accounts_chapter   on budget_accounts  (chapter_id);
create index if not exists idx_budget_accounts_parent    on budget_accounts  (parent_id);
create index if not exists idx_expenses_chapter          on expenses         (chapter_id);
create index if not exists idx_expenses_account          on expenses         (budget_account_id);
create index if not exists idx_notifications_chapter     on notifications    (chapter_id);
create index if not exists idx_dues_collections_chapter  on dues_collections (chapter_id);
create index if not exists idx_dues_tiers_collection     on dues_tiers       (dues_collection_id);
create index if not exists idx_member_dues_collection    on member_dues      (dues_collection_id);
create index if not exists idx_member_dues_member        on member_dues      (member_id);


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- gen_join_code() — 6-char uppercase code, used as chapters.join_code default.
create or replace function public.gen_join_code()
returns text
language sql
volatile
as $$
  select upper(substring(md5(random()::text || clock_timestamp()::text) for 6));
$$;

alter table chapters
  alter column join_code set default public.gen_join_code();

-- user_belongs_to_chapter(cid) — TRUE if the current auth user is a member
-- of chapter cid. SECURITY DEFINER => runs as owner, BYPASSING RLS, so the
-- inner read of `members` does NOT re-trigger the members policy. This is the
-- single mechanism that breaks the RLS recursion cycle. Every chapter-scoped
-- policy calls this instead of sub-querying its own table.
create or replace function public.user_belongs_to_chapter(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where members.chapter_id = cid
      and members.user_id = auth.uid()
  );
$$;

-- user_is_chapter_admin(cid) — TRUE if the current user has full management
-- rights over chapter cid: they CREATED the chapter, OR their member role is
-- an admin role (Treasurer / President). SECURITY DEFINER to bypass RLS.
-- NOTE: the admin role list here must match src/lib/roles.js ADMIN_ROLES.
create or replace function public.user_is_chapter_admin(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.chapters c
      where c.id = cid and c.created_by = auth.uid()
    )
    or exists (
      select 1 from public.members m
      where m.chapter_id = cid
        and m.user_id = auth.uid()
        and m.role in ('Treasurer', 'President')
    );
$$;

-- user_can_submit_expenses(cid) — TRUE if the current user may create expenses
-- in chapter cid: either they are an admin, or an admin has granted them the
-- can_submit_expenses flag. Used by the expenses INSERT policy.
create or replace function public.user_can_submit_expenses(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.user_is_chapter_admin(cid)
    or exists (
      select 1 from public.members m
      where m.chapter_id = cid
        and m.user_id = auth.uid()
        and m.can_submit_expenses = true
    );
$$;

-- lookup_join_code(code) — resolve a join code to a chapter. SECURITY DEFINER
-- so a not-yet-member (even an anonymous signup form) can validate a code
-- without being able to read the chapters table directly.
create or replace function public.lookup_join_code(code text)
returns table (chapter_id uuid, chapter_name text)
language sql
security definer
stable
set search_path = public
as $$
  select id, name
  from public.chapters
  where join_code = upper(trim(code))
  limit 1;
$$;

-- regenerate_join_code(chapter_uuid) — admin-only rotate of the join code.
-- SECURITY DEFINER but gated: caller must be the chapter's creator.
create or replace function public.regenerate_join_code(chapter_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not exists (
    select 1 from public.chapters
    where id = chapter_uuid and created_by = auth.uid()
  ) then
    raise exception 'Not authorized to regenerate this join code';
  end if;

  new_code := public.gen_join_code();
  update public.chapters set join_code = new_code where id = chapter_uuid;
  return new_code;
end;
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table chapters         enable row level security;
alter table members          enable row level security;
alter table budget_accounts  enable row level security;
alter table expenses         enable row level security;
alter table notifications    enable row level security;
alter table dues_collections enable row level security;
alter table dues_tiers       enable row level security;
alter table member_dues      enable row level security;

-- Permission model:
--   SELECT  = any chapter member (everyone in the chapter can VIEW).
--   write   = chapter ADMIN only (creator / Treasurer / President),
--             via user_is_chapter_admin().
--   EXCEPTION: expenses INSERT is allowed for members granted
--   can_submit_expenses, but only as status='Pending' (no self-approval).

-- ── chapters ─────────────────────────────────────────────────
drop policy if exists chapters_select on chapters;
drop policy if exists chapters_insert on chapters;
drop policy if exists chapters_update on chapters;
drop policy if exists chapters_delete on chapters;

create policy chapters_select on chapters for select
  using (created_by = auth.uid() or public.user_belongs_to_chapter(id));
create policy chapters_insert on chapters for insert
  with check (created_by = auth.uid());
create policy chapters_update on chapters for update
  using (public.user_is_chapter_admin(id));
create policy chapters_delete on chapters for delete
  using (created_by = auth.uid());   -- only the creator may delete the chapter

-- ── members ──────────────────────────────────────────────────
drop policy if exists members_select on members;
drop policy if exists members_insert on members;
drop policy if exists members_update on members;
drop policy if exists members_delete on members;

create policy members_select on members for select
  using (public.user_belongs_to_chapter(chapter_id));
-- INSERT: self-join (user inserts own row during onboarding) OR an admin
-- adding someone. A brand-new chapter's first member is the creator joining.
create policy members_insert on members for insert
  with check (user_id = auth.uid() or public.user_is_chapter_admin(chapter_id));
create policy members_update on members for update
  using (public.user_is_chapter_admin(chapter_id));
create policy members_delete on members for delete
  using (public.user_is_chapter_admin(chapter_id));

-- ── budget_accounts ──────────────────────────────────────────
drop policy if exists budget_accounts_select on budget_accounts;
drop policy if exists budget_accounts_insert on budget_accounts;
drop policy if exists budget_accounts_update on budget_accounts;
drop policy if exists budget_accounts_delete on budget_accounts;

create policy budget_accounts_select on budget_accounts for select
  using (public.user_belongs_to_chapter(chapter_id));
create policy budget_accounts_insert on budget_accounts for insert
  with check (public.user_is_chapter_admin(chapter_id));
create policy budget_accounts_update on budget_accounts for update
  using (public.user_is_chapter_admin(chapter_id));
create policy budget_accounts_delete on budget_accounts for delete
  using (public.user_is_chapter_admin(chapter_id));

-- ── expenses ─────────────────────────────────────────────────
drop policy if exists expenses_select on expenses;
drop policy if exists expenses_insert on expenses;
drop policy if exists expenses_update on expenses;
drop policy if exists expenses_delete on expenses;

create policy expenses_select on expenses for select
  using (public.user_belongs_to_chapter(chapter_id));
-- INSERT: admins, or permitted members — but a non-admin can only create
-- Pending expenses (can_submit + status='Pending'). Admins may set any status.
create policy expenses_insert on expenses for insert
  with check (
    public.user_is_chapter_admin(chapter_id)
    or (public.user_can_submit_expenses(chapter_id) and status = 'Pending')
  );
-- UPDATE (approve / reject / edit) and DELETE: admins only.
create policy expenses_update on expenses for update
  using (public.user_is_chapter_admin(chapter_id));
create policy expenses_delete on expenses for delete
  using (public.user_is_chapter_admin(chapter_id));

-- ── notifications ────────────────────────────────────────────
drop policy if exists notifications_select on notifications;
drop policy if exists notifications_insert on notifications;
drop policy if exists notifications_update on notifications;
drop policy if exists notifications_delete on notifications;

create policy notifications_select on notifications for select
  using (public.user_belongs_to_chapter(chapter_id));
create policy notifications_insert on notifications for insert
  with check (public.user_is_chapter_admin(chapter_id));
-- UPDATE: any member may mark notifications read (read receipts are harmless).
create policy notifications_update on notifications for update
  using (public.user_belongs_to_chapter(chapter_id));
create policy notifications_delete on notifications for delete
  using (public.user_is_chapter_admin(chapter_id));

-- ── dues_collections ─────────────────────────────────────────
drop policy if exists dues_collections_select on dues_collections;
drop policy if exists dues_collections_insert on dues_collections;
drop policy if exists dues_collections_update on dues_collections;
drop policy if exists dues_collections_delete on dues_collections;

create policy dues_collections_select on dues_collections for select
  using (public.user_belongs_to_chapter(chapter_id));
create policy dues_collections_insert on dues_collections for insert
  with check (public.user_is_chapter_admin(chapter_id));
create policy dues_collections_update on dues_collections for update
  using (public.user_is_chapter_admin(chapter_id));
create policy dues_collections_delete on dues_collections for delete
  using (public.user_is_chapter_admin(chapter_id));

-- ── dues_tiers (scoped via parent dues_collection) ───────────
drop policy if exists dues_tiers_all on dues_tiers;
drop policy if exists dues_tiers_select on dues_tiers;
drop policy if exists dues_tiers_write  on dues_tiers;

create policy dues_tiers_select on dues_tiers for select
  using (
    dues_collection_id in (
      select id from dues_collections
      where public.user_belongs_to_chapter(chapter_id)
    )
  );
create policy dues_tiers_write on dues_tiers for all
  using (
    dues_collection_id in (
      select id from dues_collections
      where public.user_is_chapter_admin(chapter_id)
    )
  )
  with check (
    dues_collection_id in (
      select id from dues_collections
      where public.user_is_chapter_admin(chapter_id)
    )
  );

-- ── member_dues (admin manages; member sees own) ─────────────
drop policy if exists member_dues_select on member_dues;
drop policy if exists member_dues_write  on member_dues;

create policy member_dues_select on member_dues for select
  using (
    dues_collection_id in (
      select id from dues_collections
      where public.user_belongs_to_chapter(chapter_id)
    )
    or member_id in (select id from members where user_id = auth.uid())
  );
-- INSERT / UPDATE / DELETE: chapter admins only.
create policy member_dues_write on member_dues for all
  using (
    dues_collection_id in (
      select id from dues_collections
      where public.user_is_chapter_admin(chapter_id)
    )
  )
  with check (
    dues_collection_id in (
      select id from dues_collections
      where public.user_is_chapter_admin(chapter_id)
    )
  );


-- ============================================================
-- STORAGE — receipt archive (private 'receipts' bucket)
-- ============================================================
-- Uploaded invoice files (PDF/image) are stored at
--   receipts/<chapter_id>/<expense_id>/<filename>
-- The bucket is PRIVATE; the app serves files via short-lived signed URLs.
-- Access is gated by chapter membership: the first path segment is the
-- chapter_id, checked with user_belongs_to_chapter() — same model as tables.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- (storage.objects already has RLS enabled by Supabase.)
drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_update on storage.objects;
drop policy if exists receipts_delete on storage.objects;

-- View/download: any member of the chapter that owns the file.
create policy receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_belongs_to_chapter((storage.foldername(name))[1]::uuid)
  );

-- Upload: members permitted to submit expenses (admins always qualify).
create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.user_can_submit_expenses((storage.foldername(name))[1]::uuid)
  );

-- Replace an existing object: same as upload (e.g. re-attach a receipt).
create policy receipts_update on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_can_submit_expenses((storage.foldername(name))[1]::uuid)
  );

-- Delete: chapter admins only.
create policy receipts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.user_is_chapter_admin((storage.foldername(name))[1]::uuid)
  );


-- ============================================================
-- GRANTS (RLS still gates every row; these just expose the API)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

grant execute on function public.user_belongs_to_chapter(uuid) to anon, authenticated;
grant execute on function public.user_is_chapter_admin(uuid)   to anon, authenticated;
grant execute on function public.user_can_submit_expenses(uuid) to anon, authenticated;
grant execute on function public.lookup_join_code(text)        to anon, authenticated;
grant execute on function public.regenerate_join_code(uuid)    to authenticated;
grant execute on function public.gen_join_code()               to authenticated;


-- ============================================================
-- VERIFY (optional — run after to confirm there is no recursion)
-- ============================================================
-- Expect 0 rows (no policy should sub-query its own base table):
--   select tablename, policyname, qual from pg_policies
--   where schemaname = 'public' and qual like '%my_chapter_id%';
--
-- List all policies:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
