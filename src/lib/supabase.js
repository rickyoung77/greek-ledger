import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[supabase] URL:', supabaseUrl)
console.log('[supabase] Key exists:', !!supabaseAnonKey, '| Starts with:', supabaseAnonKey?.slice(0, 20))

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] MISSING env vars — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is undefined. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
