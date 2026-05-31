import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced loudly in dev; in prod this means the Vercel env vars are missing.
  console.error(
    '[supabase] Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in .env (local) and in the Vercel project settings (production).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Defensive wrapper: resolve a Supabase promise but never hang the UI.
// With the non-recursive RLS in schema.sql, queries return fast; this is a
// safety net so a flaky network can't leave a spinner stuck forever.
// Returns { data, error } shape on success, or { data: null, error } on timeout.
export function withTimeout(promise, ms = 6000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ data: null, error: new Error(`${label} timed out after ${ms}ms`) }),
        ms
      )
    ),
  ])
}
