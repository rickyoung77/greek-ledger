-- ============================================================
-- Greek Ledger — Dues Tables Migration
-- Run this in the Supabase SQL editor.
-- Safe to re-run: all CREATE use IF NOT EXISTS.
-- ============================================================


-- ── Tables ───────────────────────────────────────────────────

create table if not exists dues_collections (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid not null references chapters(id) on delete cascade,
  name         text not null,
  due_date     date,
  payment_link text,
  status       text not null default 'active' check (status in ('active', 'closed')),
  created_at   timestamptz not null default now()
);

create table if not exists dues_tiers (
  id                  uuid primary key default gen_random_uuid(),
  dues_collection_id  uuid not null references dues_collections(id) on delete cascade,
  classification      text not null,  -- e.g. 'Freshman', 'Officer'
  amount              numeric(10,2) not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists member_dues (
  id                  uuid primary key default gen_random_uuid(),
  dues_collection_id  uuid not null references dues_collections(id) on delete cascade,
  member_id           uuid not null references members(id) on delete cascade,
  amount_owed         numeric(10,2) not null default 0,
  status              text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);


-- ── Indexes ──────────────────────────────────────────────────

create index if not exists idx_dues_collections_chapter on dues_collections (chapter_id);
create index if not exists idx_dues_tiers_collection    on dues_tiers        (dues_collection_id);
create index if not exists idx_member_dues_collection   on member_dues       (dues_collection_id);
create index if not exists idx_member_dues_member       on member_dues       (member_id);


-- ── RLS ──────────────────────────────────────────────────────

alter table dues_collections enable row level security;
alter table dues_tiers       enable row level security;
alter table member_dues      enable row level security;

-- dues_collections: scoped to chapter owner
drop policy if exists "dues_collections_select" on dues_collections;
drop policy if exists "dues_collections_insert" on dues_collections;
drop policy if exists "dues_collections_update" on dues_collections;
drop policy if exists "dues_collections_delete" on dues_collections;

create policy "dues_collections_select" on dues_collections for select
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "dues_collections_insert" on dues_collections for insert
  with check (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "dues_collections_update" on dues_collections for update
  using (chapter_id in (select id from chapters where user_id = auth.uid()));

create policy "dues_collections_delete" on dues_collections for delete
  using (chapter_id in (select id from chapters where user_id = auth.uid()));


-- dues_tiers: scoped through dues_collection → chapter
drop policy if exists "dues_tiers_select" on dues_tiers;
drop policy if exists "dues_tiers_insert" on dues_tiers;
drop policy if exists "dues_tiers_update" on dues_tiers;
drop policy if exists "dues_tiers_delete" on dues_tiers;

create policy "dues_tiers_select" on dues_tiers for select
  using (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));

create policy "dues_tiers_insert" on dues_tiers for insert
  with check (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));

create policy "dues_tiers_update" on dues_tiers for update
  using (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));

create policy "dues_tiers_delete" on dues_tiers for delete
  using (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));


-- member_dues: chapter owner sees all; members see their own
drop policy if exists "member_dues_select" on member_dues;
drop policy if exists "member_dues_insert" on member_dues;
drop policy if exists "member_dues_update" on member_dues;
drop policy if exists "member_dues_delete" on member_dues;

create policy "member_dues_select" on member_dues for select
  using (
    dues_collection_id in (
      select id from dues_collections
      where chapter_id in (select id from chapters where user_id = auth.uid())
    )
    or member_id in (select id from members where user_id = auth.uid())
  );

create policy "member_dues_insert" on member_dues for insert
  with check (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));

create policy "member_dues_update" on member_dues for update
  using (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));

create policy "member_dues_delete" on member_dues for delete
  using (dues_collection_id in (
    select id from dues_collections
    where chapter_id in (select id from chapters where user_id = auth.uid())
  ));
