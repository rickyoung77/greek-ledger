import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_DEFAULTS = {
  memberId: null, chapterId: null, fullName: '', userRole: '',
  chapterName: '', joinCode: '', isAdmin: false, semester: '',
}

async function loadProfile(user) {
  try {
    // Primary path: member record with user_id (new flow)
    const { data: memberRow } = await supabase
      .from('members')
      .select('id, chapter_id, full_name, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberRow) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('id, name, join_code, user_id, semester')
        .eq('id', memberRow.chapter_id)
        .maybeSingle()

      return {
        memberId:    memberRow.id,
        chapterId:   memberRow.chapter_id,
        fullName:    memberRow.full_name,
        userRole:    memberRow.role,
        chapterName: chapter?.name     ?? '',
        joinCode:    chapter?.join_code ?? '',
        isAdmin:     chapter?.user_id  === user.id,
        semester:    chapter?.semester ?? '',
      }
    }

    // Fallback: pre-join-code users whose chapter_id is in JWT metadata
    const meta = user.user_metadata ?? {}
    if (meta.chapter_id) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('id, name, join_code, user_id, semester')
        .eq('id', meta.chapter_id)
        .maybeSingle()

      return {
        memberId:    null,
        chapterId:   meta.chapter_id,
        fullName:    meta.full_name    ?? user.email ?? '',
        userRole:    meta.role         ?? 'Treasurer',
        chapterName: chapter?.name     ?? meta.chapter_name ?? '',
        joinCode:    chapter?.join_code ?? '',
        isAdmin:     chapter?.user_id  === user.id,
        semester:    chapter?.semester ?? meta.semester ?? '',
      }
    }
  } catch (_) {
    // Non-fatal
  }
  return null
}

async function ensureChapterExists(user) {
  const meta = user.user_metadata ?? {}
  const flow = meta.flow

  try {
    if (flow === 'join') {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (count === 0) {
        const { data: rows } = await supabase
          .rpc('lookup_join_code', { code: meta.join_code ?? '' })

        if (rows?.[0]) {
          await supabase.from('members').insert({
            chapter_id:  rows[0].chapter_id,
            full_name:   meta.full_name || user.email,
            role:        'Member',
            year:        meta.year || 'Freshman',
            dues_status: 'Pending',
            email:       user.email,
            user_id:     user.id,
          })
        }
      }
    } else if (flow === 'create' || (meta.chapter_id && !flow)) {
      const chapterId = meta.chapter_id
      if (!chapterId || !meta.chapter_name) return

      const { count } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('id', chapterId)

      if (count === 0) {
        const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        await supabase.from('chapters').insert({
          id:        chapterId,
          name:      meta.chapter_name,
          semester:  meta.semester || 'Fall 2026',
          user_id:   user.id,
          join_code: joinCode,
        })
        await supabase.from('members').insert({
          chapter_id:  chapterId,
          full_name:   meta.full_name || user.email,
          role:        meta.role || 'Treasurer',
          year:        'Senior',
          dues_status: 'Paid',
          email:       user.email,
          user_id:     user.id,
        })
      } else {
        // Backfill user_id for existing member records (pre-join-code migration)
        await supabase
          .from('members')
          .update({ user_id: user.id })
          .eq('chapter_id', chapterId)
          .is('user_id', null)
          .eq('email', user.email)
      }
    }
  } catch (_) {
    // Non-fatal
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
    if (p) setProfile(p)
  }, [])

  useEffect(() => {
    let mounted = true

    // Absolute ceiling: loading must resolve within 3 seconds no matter what
    const hardTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 3000)

    const resolve = () => {
      if (mounted) {
        clearTimeout(hardTimeout)
        setLoading(false)
      }
    }

    // Race getSession() itself against 2.5s — expired tokens trigger a network refresh that can hang
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ])
      .then(async ({ data }) => {
        if (!mounted) return
        const s = data?.session ?? null
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await Promise.race([
            refreshProfile(s.user),
            new Promise((r) => setTimeout(r, 1500)),
          ])
        }
      })
      .catch(() => {})
      .finally(resolve)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)

      if (event === 'SIGNED_IN' && s?.user) {
        await ensureChapterExists(s.user)
        await refreshProfile(s.user)
        resolve()
      } else if (event === 'SIGNED_OUT') {
        setProfile(PROFILE_DEFAULTS)
        resolve()
      } else if (event === 'INITIAL_SESSION') {
        // Always resolve — with user, load profile first; without user, resolve immediately
        if (s?.user) {
          await Promise.race([
            (async () => { await ensureChapterExists(s.user); await refreshProfile(s.user) })(),
            new Promise((r) => setTimeout(r, 2000)),
          ])
        }
        resolve()
      } else if (event === 'TOKEN_REFRESHED' && s?.user) {
        refreshProfile(s.user)
      } else {
        // PASSWORD_RECOVERY, USER_UPDATED, or any future event — always unblock loading
        resolve()
      }
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

  async function signUp({ email, password, fullName, chapterName, semester, role }) {
    const chapterId = crypto.randomUUID()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          flow: 'create',
          chapter_id: chapterId, chapter_name: chapterName,
          semester, role, full_name: fullName,
        },
      },
    })
    if (error) return { error }
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function joinChapter({ email, password, fullName, joinCode, year }) {
    const { data: rows, error: lookupErr } = await supabase
      .rpc('lookup_join_code', { code: joinCode.toUpperCase().trim() })

    if (lookupErr || !rows?.length) {
      return { error: { message: 'Invalid join code. Please check with your treasurer and try again.' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          flow: 'join',
          join_code: joinCode.toUpperCase().trim(),
          full_name: fullName,
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
        refreshProfile: () => user && refreshProfile(user),
        signIn,
        signUp,
        joinChapter,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
