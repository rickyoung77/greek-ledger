# Greek Ledger — Project Context

## What We're Building
Greek Ledger is a SaaS budgeting and financial management web app built specifically for fraternity and sorority chapters. Live at greekledger.com.

## Tech Stack

- **Frontend:** React + Vite
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase
- **Hosting:** Vercel
- **Routing:** React Router DOM

## Project Structure

- [src/context/AuthContext.jsx](src/context/AuthContext.jsx) — auth state, chapter_id, user profile
- [src/components/Layout.jsx](src/components/Layout.jsx) — sidebar navigation
- [src/pages/](src/pages/) — Dashboard, BudgetAccounts, Expenses, Members, Dues, Notifications, Settings, Login, Signup, CompleteSetup
- [src/lib/supabase.js](src/lib/supabase.js) — Supabase client
- [supabase/](supabase/) — schema.sql, seed.sql, rls.sql migration files

## Database Tables

- **chapters** — id, name, semester, user_id, join_code
- **members** — id, chapter_id, user_id, full_name, role, year, dues_status, email
- **budget_accounts** — id, chapter_id, parent_id (nullable), name, total_budget, color
- **expenses** — id, chapter_id, budget_account_id, description, amount, category, submitted_by, status, date
- **notifications** — id, chapter_id, title, message, type, read
- **dues_collections** — id, chapter_id, name, due_date, payment_link, status
- **dues_tiers** — id, dues_collection_id, classification, amount
- **member_dues** — id, dues_collection_id, member_id, amount_owed, status

## Design System

- **Primary navy:** `#1e2a4a`
- **Gold accent:** `#c9a84c`
- **Background:** `#f8f9fa`
- **Success green:** `#22c55e`
- **Warning yellow:** `#eab308`
- **Danger red:** `#ef4444`

## Key Rules

- NEVER run a Supabase query if `chapter_id` is null or undefined
- Every query must have `try/catch/finally` — `finally` ALWAYS sets loading to false
- Never show a loading spinner for more than 4 seconds
- All data must be scoped to the logged in user's `chapter_id`
- Design must match navy and gold theme throughout

## Current Known Issues

- Chapter creation on CompleteSetup page gets stuck on "Creating..." — the INSERT into chapters may not be setting `user_id` correctly
- Session timeout after 24 hours needs graceful redirect to login

## Features Built

- Dashboard with summary cards, budget overview, recent expenses
- Budget accounts with sub-accounts and progress bars
- Expense submission and approval flow
- Member management with roles and dues status
- Dues management with class year classification
- Join code system for chapter onboarding
- Auth with signup/login/signout
- Settings page

## Features Planned

- AI invoice parsing (upload PDF, Claude reads it, auto-fills expense form)
- Income/collections tracking
- SMS notifications via Twilio
- Stripe subscriptions
- Event sub-budgets
- Semester rollover
