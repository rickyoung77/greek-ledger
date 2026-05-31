-- ============================================================
-- Greek Ledger — DESTRUCTIVE RESET
-- ============================================================
-- Run this ONCE in the Supabase SQL editor to wipe the drifted
-- database, then run schema.sql to rebuild it cleanly.
--
-- ⚠️  THIS DELETES ALL DATA in the public tables below.
--     Only run it while the project is pre-launch / test data.
--
-- It also drops the recursive helper functions that were created
-- ad-hoc in the dashboard and caused the auth hang.
-- ============================================================

-- Tables (CASCADE drops their RLS policies, indexes, and FKs too)
drop table if exists member_dues       cascade;
drop table if exists dues_tiers        cascade;
drop table if exists dues_collections  cascade;
drop table if exists notifications     cascade;
drop table if exists expenses          cascade;
drop table if exists budget_accounts   cascade;
drop table if exists members           cascade;
drop table if exists chapters          cascade;

-- Functions defined by the clean schema
drop function if exists public.user_belongs_to_chapter(uuid) cascade;
drop function if exists public.lookup_join_code(text)        cascade;
drop function if exists public.regenerate_join_code(uuid)    cascade;
drop function if exists public.gen_join_code()               cascade;

-- Drifted helper functions from earlier attempts (the recursion culprits).
-- Safe no-ops if they don't exist.
drop function if exists public.my_chapter_id()            cascade;
drop function if exists public.is_member_of_chapter(uuid) cascade;
