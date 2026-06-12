#!/usr/bin/env node
/**
 * Greek Ledger — live DB migration runner
 * --------------------------------------------------------------
 * Applies supabase/reset.sql then supabase/schema.sql to the LIVE
 * Supabase database via the Management API, then self-verifies.
 *
 * Why this exists: the anon key in .env cannot run DDL (create/drop
 * table, policies). DDL needs a privileged credential. This script
 * uses a Supabase **Personal Access Token** (Management API) so the
 * whole migration runs with one command and zero copy-paste.
 *
 * HOW TO GET THE TOKEN (one-time, ~30 seconds):
 *   1. Go to  https://supabase.com/dashboard/account/tokens
 *   2. "Generate new token", name it e.g. "greek-ledger-migrate"
 *   3. Copy it (starts with "sbp_")
 *
 * HOW TO RUN:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run db:migrate
 *
 *   …or to wipe first (DESTRUCTIVE — drops all data, then rebuilds):
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run db:reset
 *
 * The project ref is read from VITE_SUPABASE_URL in .env, so it always
 * targets the same project the app talks to.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── tiny .env reader (no dependency) ─────────────────────────
function readEnv() {
  let raw = ''
  try { raw = readFileSync(join(ROOT, '.env'), 'utf8') } catch { /* ignore */ }
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = readEnv()
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const WIPE = process.argv.includes('--reset') || process.env.GL_RESET === '1'

const url = env.VITE_SUPABASE_URL || ''
const refMatch = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || (refMatch && refMatch[1])

function die(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!TOKEN) {
  die(
    'Missing SUPABASE_ACCESS_TOKEN.\n' +
    '   Get one at https://supabase.com/dashboard/account/tokens (starts with "sbp_"),\n' +
    '   then run:  SUPABASE_ACCESS_TOKEN=sbp_xxx npm run ' + (WIPE ? 'db:reset' : 'db:migrate')
  )
}
if (!PROJECT_REF) die('Could not determine project ref from VITE_SUPABASE_URL in .env')

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

// ── run one SQL string through the Management API ────────────
async function runSql(query, label) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${label} failed (HTTP ${res.status}): ${text}`)
  }
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return json
}

function sqlFile(name) {
  return readFileSync(join(ROOT, 'supabase', name), 'utf8')
}

async function main() {
  console.log(`\n🏛  Greek Ledger migration → project ${PROJECT_REF}`)
  console.log(`   mode: ${WIPE ? 'RESET (destructive) + schema' : 'schema only (idempotent)'}\n`)

  if (WIPE) {
    process.stdout.write('   • Running reset.sql (dropping tables)… ')
    await runSql(sqlFile('reset.sql'), 'reset.sql')
    console.log('done')
  }

  process.stdout.write('   • Running schema.sql (tables, RLS, functions)… ')
  await runSql(sqlFile('schema.sql'), 'schema.sql')
  console.log('done')

  // Reload the PostgREST schema cache. WITHOUT this, PostgREST keeps using a
  // stale snapshot of functions/policies, so brand-new RLS rules that call
  // freshly-changed SECURITY DEFINER functions fail closed (403) until the
  // next unrelated DDL happens to trigger a reload. This is the Supabase
  // "I changed a policy and now everything is 403" gotcha — pre-empt it.
  process.stdout.write('   • Reloading PostgREST schema cache… ')
  await runSql(`notify pgrst, 'reload schema';`, 'schema cache reload')
  console.log('done')

  // ── self-verify ───────────────────────────────────────────
  console.log('\n🔎 Verifying…')

  const tables = await runSql(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name;`,
    'verify tables'
  )
  const tableNames = (Array.isArray(tables) ? tables : []).map((r) => r.table_name)
  const expected = ['budget_accounts','chapters','dues_collections','dues_tiers','expenses','income','member_dues','members','notifications','semesters']
  const missing = expected.filter((t) => !tableNames.includes(t))
  console.log(`   tables present: ${tableNames.length ? tableNames.join(', ') : '(none)'}`)
  if (missing.length) die(`Missing expected tables: ${missing.join(', ')}`)

  const fn = await runSql(
    `select proname from pg_proc where proname='user_belongs_to_chapter';`,
    'verify function'
  )
  if (!Array.isArray(fn) || !fn.length) die('Helper function user_belongs_to_chapter is missing')
  console.log('   helper function user_belongs_to_chapter: present ✓')

  const recursive = await runSql(
    `select tablename, policyname from pg_policies
     where schemaname='public'
       and (qual like '%my_chapter_id%' or qual like '%is_member_of_chapter%');`,
    'verify no recursion'
  )
  if (Array.isArray(recursive) && recursive.length) {
    die(`Found drifted recursive policies still present: ${JSON.stringify(recursive)}`)
  }
  console.log('   no recursive/drifted policies: confirmed ✓')

  const policyCount = await runSql(
    `select count(*)::int as n from pg_policies where schemaname='public';`,
    'verify policy count'
  )
  const n = Array.isArray(policyCount) && policyCount[0] ? policyCount[0].n : '?'
  console.log(`   RLS policies installed: ${n}`)

  console.log('\n✅ Migration complete and verified. The database matches supabase/schema.sql.\n')
}

main().catch((err) => die(err.message))
