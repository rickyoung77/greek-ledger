# Greek Ledger — finish the rebuild (2 steps)

The whole rebuild is committed to `main`. Two things remain. The first needs
**one click from you** (a token only you can generate); after that I/the script
does everything.

---

## Step 1 — Migrate the live database (one command)

The app's `anon` key cannot create/drop tables, so the migration needs a
**Supabase Personal Access Token** (a Management-API token — not a DB password,
not the service-role key).

1. Open <https://supabase.com/dashboard/account/tokens>
2. Click **Generate new token**, name it `greek-ledger-migrate`, copy it
   (it starts with `sbp_`).
3. In a terminal:

   ```bash
   cd /Users/rickyoung/greek-ledger
   SUPABASE_ACCESS_TOKEN=sbp_PASTE_YOURS npm run db:reset
   ```

`db:reset` wipes the drifted tables, rebuilds from `supabase/schema.sql`, then
**self-verifies** (tables exist, the non-recursive helper function is present,
no recursive policies remain). You'll see `✅ Migration complete and verified.`

> Re-running later without wiping data: use `npm run db:migrate` (idempotent —
> applies `schema.sql` only). Use `db:reset` only when you want a clean slate.

The token is read from the environment for that one command and never written
to disk or committed.

---

## Step 2 — Run the app and test

```bash
cd /Users/rickyoung/greek-ledger
npm run dev
```

Open the printed URL, then:

1. **Sign up → Create a Chapter** → lands on the dashboard, no spinner hang.
2. Add a budget account + sub-account, submit an expense, approve it.
3. **Settings** → copy the join code.
4. New incognito window → **Sign up → Join a Chapter** with that code → same chapter, same data.
5. Create a dues collection (by class year), send a reminder, check Notifications.

If anything errors, open the browser console — messages are now specific and I
can fix from there.

---

## What changed (reference)

- `supabase/schema.sql` — single source of truth. Access is by chapter
  **membership** via a `SECURITY DEFINER` `user_belongs_to_chapter()` that
  bypasses RLS → no policy queries its own table → the recursion that hung
  every authenticated query is gone.
- `supabase/reset.sql` — destructive wipe (run once via `db:reset`).
- `scripts/migrate.mjs` — the runner behind `npm run db:migrate` / `db:reset`.
- `src/context/AuthContext.jsx`, `src/pages/CompleteSetup.jsx`,
  `src/pages/Signup.jsx`, `src/lib/supabase.js` — single-path auth; signup
  stashes intent in metadata; CompleteSetup is the only place chapters/members
  are created.
- Old code is preserved on branch `archive/pre-rebuild-20260531`.

Nothing has been pushed to GitHub or deployed to Vercel yet — this is all local
on `main`. Tell me to push when you're ready.
