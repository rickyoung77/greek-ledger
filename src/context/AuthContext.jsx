import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function ensureChapterExists(user) {
  const meta = user.user_metadata
  if (!meta?.chapter_id || !meta?.chapter_name) return

  const { count } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true })
    .eq('id', meta.chapter_id)

  if (count === 0) {
    await supabase.from('chapters').insert({
      id:       meta.chapter_id,
      name:     meta.chapter_name,
      semester: meta.semester || 'Spring 2026',
      user_id:  user.id,
    })
    await supabase.from('members').insert({
      chapter_id: meta.chapter_id,
      full_name: meta.full_name || user.email,
      role: meta.role || 'Member',
      year: 'Senior',
      dues_status: 'Paid',
      email: user.email,
    })
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureChapterExists(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp({ email, password, fullName, chapterName, semester, role }) {
    const chapterId = crypto.randomUUID()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { chapter_id: chapterId, chapter_name: chapterName, semester, role, full_name: fullName },
      },
    })

    if (error) return { error }
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const meta = user?.user_metadata ?? {}

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        chapterId:   meta.chapter_id   ?? null,
        chapterName: meta.chapter_name ?? '',
        userRole:    meta.role         ?? '',
        semester:    meta.semester     ?? '',
        fullName:    meta.full_name    ?? user?.email ?? '',
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
