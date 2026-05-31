# Greek Ledger — Project Context

## What We're Building
Greek Ledger is a SaaS budgeting and financial management web app built specifically
for fraternity and sorority chapters. Live at greekledger.com. It is **not** a payment
processor — it organizes and tracks chapter finances on top of whatever payment method
a chapter already uses (Venmo, Zelle, etc.). It never touches chapter money.

## Tech Stack
- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (Postgres + Auth)
- **Hosting:** Vercel
- **Routing:** React Router DOM

## Project Structure
- [src/lib/supabase.js](src/lib/supabase.js) — Supabase client + `withTimeout` helper
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx) — auth state, profile (chapterId, role, isAdmin)
- [src/pages/Signup.jsx](src/pages/Signup.jsx) — create-chapter / join-chapter signup (writes NO data; stashes intent in user_metadata)
- [src/pages/CompleteSetup.jsx](src/pages/CompleteSetup.jsx) — the ONLY place chapters/members get created
- [src/components/Layout.jsx](src/components/Layout.jsx) — sidebar + header shell
- [src/pages/](src/pages/) — Dashboard, BudgetAccounts, Expenses, Members, Dues, Notifications, Settings, Login
- [supabase/](supabase/) — `reset.sql` then `schema.sql` (see below)

## Database — single source of truth
ALL schema and RLS lives in **[supabase/schema.sql](supabase/schema.sql)** and nowhere else.
- **Never** create or edit tables/policies/functions ad-hoc in the Supabase dashboard.
  The live DB previously drifted from the repo (recursive helper policies created in the
  editor) and hung every authenticated query. That class of bug is why this rule exists.
- To change the DB: edit `schema.sql`, then re-run it in the Supabase SQL editor. It is
  idempotent (drop-policy-if-exists, create-if-not-exists, create-or-replace).
- `supabase/reset.sql` is a destructive wipe — run it once before `schema.sql` to clear
  a drifted database. It deletes all data.

### Access model (important — this is what fixed the hang)
Access is by **chapter membership, not ownership**.
- `members` is the access table: a row links an `auth.users` id to a `chapter_id`.
- `chapters.created_by` marks the admin (used for `isAdmin` + join-code regeneration).
- RLS uses a **SECURITY DEFINER** function `user_belongs_to_chapter(chapter_id)` that
  checks membership while **bypassing RLS**. Because it bypasses RLS, no policy ever
  sub-queries its own table → **no infinite recursion**. Every chapter-scoped table uses
  the same one-line policy: `using (user_belongs_to_chapter(chapter_id))`.
- Join codes: `lookup_join_code(code)` (SECURITY DEFINER, callable pre-membership) and
  `regenerate_join_code(chapter_uuid)` (admin-gated).

## Database Tables
- **chapters** — id, name, semester, join_code (unique, DB-generated), created_by, created_at
- **members** — id, chapter_id, user_id (nullable; unique), full_name, role, year, dues_status, email
- **budget_accounts** — id, chapter_id, parent_id (nullable → sub-accounts), name, total_budget, color
- **expenses** — id, chapter_id, budget_account_id, description, amount, category, submitted_by, status, date
- **notifications** — id, chapter_id, title, message, type, read
- **dues_collections** — id, chapter_id, name, due_date, payment_link, status
- **dues_tiers** — id, dues_collection_id, classification, amount
- **member_dues** — id, dues_collection_id, member_id, amount_owed, status, last_reminder_sent, paid_at

## Auth flow (single path — do not reintroduce background inserts)
1. **Signup** creates the auth account only. Create/join details go into `user_metadata`.
2. First authenticated load → `loadProfile` finds no member row → app routes to **CompleteSetup**.
3. **CompleteSetup** (pre-filled from metadata) does the actual `chapters`/`members`
   inserts from a guaranteed `getSession()` session, one click, then navigates to the dashboard.
- `onAuthStateChange` is the single source of truth. NEVER `await` a Supabase data call
  directly inside that callback — defer with `setTimeout(0)` (auth-js holds a lock during it).

## Design System
- **Primary navy:** `#1e2a4a` · **Gold accent:** `#c9a84c` · **Background:** `#f8f9fa`
- **Success:** `#22c55e` · **Warning:** `#eab308` · **Danger:** `#ef4444`
- Clean modern SaaS aesthetic (Linear / Notion / Stripe quality).

## Key Rules
- Never run a Supabase query when `chapterId` is null/undefined.
- Every data load uses try/catch/finally; `finally` always clears loading.
- Never show a loading spinner longer than ~4s (timeouts/safety valves exist).
- All data is scoped to the logged-in user's `chapterId`.

## Features Built
Dashboard · Budget accounts + sub-accounts · Expense submit/approve · Member management ·
Dues collections (by class year or manual) + reminders · Join-code onboarding · Settings · Auth.

## Features Planned
- AI invoice parsing (upload PDF → Claude auto-fills the expense form + permanent receipt archive) — flagship
- Income/collections tracking · SMS via Twilio · Stripe subscriptions · Event sub-budgets · Semester rollover
