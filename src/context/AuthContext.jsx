import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_DEFAULTS = {
  memberId: null, chapterId: null, fullName: '', userRole: '',
  chapterName: '', joinCode: '', isAdmin: false, semester: '',
}

// Load the signed-in user's profile in ONE query.
// members.user_id -> the single membership row; the embedded `chapters(...)`
// comes back via the members.chapter_id foreign key. With the non-recursive
// RLS in schema.sql this resolves in a single round-trip and cannot hang the
// auth lock. Returns null if the user has no chapter yet (-> CompleteSetup).
async function loadProfile(user) {
  try {
    const { data: member, error } = await withTimeout(
      supabase
        .from('members')
        .select('id, chapter_id, full_name, role, chapters ( name, join_code, semester, created_by )')
        .eq('user_id', user.id)
        .maybeSingle(),
      6000,
      'profile load'
    )

    if (error) {
      console.warn('[auth] loadProfile error:', error.message)
      return null
    }
    if (!member) return null

    const chapter = member.chapters ?? {}
    return {
      memberId:    member.id,
      chapterId:   member.chapter_id,
      fullName:    member.full_name ?? '',
      userRole:    member.role ?? 'Member',
      chapterName: chapter.name ?? '',
      joinCode:    chapter.join_code ?? '',
      semester:    chapter.semester ?? '',
      isAdmin:     chapter.created_by === user.id,
    }
  } catch (err) {
    console.warn('[auth] loadProfile threw:', err?.message ?? err)
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(PROFILE_DEFAULTS)

  const refreshProfile = useCallback(async (u) => {
    if (!u) { setProfile(PROFILE_DEFAULTS); return }
    const p = await loadProfile(u)
    setProfile(p ?? PROFILE_DEFAULTS)
  }, [])

  useEffect(() => {
    let mounted = true

    // Safety net: never let the initial spinner outlive the auth check.
    const hardTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    // onAuthStateChange is the single source of truth. It fires INITIAL_SESSION
    // synchronously on subscribe with the cached session, so no separate
    // getSession() call (and no competing load path) is needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return

      // Only synchronous state here. NEVER await a Supabase data call directly
      // inside this callback — auth-js holds an internal lock while it runs, and
      // a query issued here would queue behind the lock and deadlock. Defer all
      // data work with setTimeout(0) so the callback returns and the lock frees.
      setSession(s)
      setUser(s?.user ?? null)

      if (!s?.user) {
        setProfile(PROFILE_DEFAULTS)
        setLoading(false)
        return
      }

      setTimeout(async () => {
        if (!mounted) return
        await refreshProfile(s.user)
        if (mounted) {
          clearTimeout(hardTimeout)
          setLoading(false)
        }
      }, 0)
    })

    return () => {
      mounted = false
      clearTimeout(hardTimeout)
      subscription.unsubscribe()
    }
  }, [refreshProfile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // Sign up creates the AUTH account only. Chapter create/join details are
  // stashed in user_metadata so CompleteSetup can pre-fill and the user
  // finishes with one click against a guaranteed session. No DB writes happen
  // here — that keeps signup from racing email confirmation or the auth lock.
  async function signUp({ email, password, fullName, chapterName, semester, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          flow: 'create',
          full_name: fullName,
          chapter_name: chapterName,
          semester,
          role,
        },
      },
    })
    if (error) return { error }
    return { error: null, needsEmailConfirmation: !data.session }
  }

  // Validate the join code up front (so a bad code fails before account
  // creation), then sign up with the join details in metadata.
  async function signUpJoin({ email, password, fullName, joinCode, year }) {
    const code = joinCode.toUpperCase().trim()
    const { data: rows, error: lookupErr } = await supabase
      .rpc('lookup_join_code', { code })
    if (lookupErr || !rows?.length) {
      return { error: { message: 'Invalid join code. Please check with your treasurer and try again.' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          flow: 'join',
          full_name: fullName,
          join_code: code,
          year: year || 'Freshman',
        },
      },
    })
    if (error) return { error }
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        ...profile,
        refreshProfile: () => refreshProfile(user),
        signIn,
        signUp,
        signUpJoin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
