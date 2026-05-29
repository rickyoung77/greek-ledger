import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_DEFAULTS = {
  memberId: null, chapterId: null, fullName: '', userRole: '',
  chapterName: '', joinCode: '', isAdmin: false, semester: '',
}

async function loadProfile(user) {
  console.log('[loadProfile] start — user:', user.id)
  try {
    // ── Step 1: member by user_id + chapter in one embedded request ──
    // Single query for the happy path. chapter_id from the member row is always
    // used for chapterId — it's reliable even if the chapter RLS blocks the embed.
    const { data: member, error: mErr } = await supabase
      .from('members')
      .select('id, chapter_id, full_name, role, chapters(id, name, join_code, user_id, semester)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (mErr) console.warn('[loadProfile] Step 1 failed:', mErr.message)
    console.log('[loadProfile] Step 1 member:', member ? member.id : 'not found')

    if (member) {
      const ch = member.chapters
      console.log('[loadProfile] Step 1 chapter:', ch ? ch.id : 'RLS blocked — using member.chapter_id')
      return {
        memberId:    member.id,
        chapterId:   member.chapter_id,
        fullName:    member.full_name,
        userRole:    member.role,
        chapterName: ch?.name      ?? '',
        joinCode:    ch?.join_code ?? '',
        isAdmin:     ch?.user_id   === user.id,
        semester:    ch?.semester  ?? '',
      }
    }

    // ── Step 2: legacy — chapter_id stored in JWT metadata (old Signup flow) ──
    const meta = user.user_metadata ?? {}
    console.log('[loadProfile] Step 2 metadata chapter_id:', meta.chapter_id ?? 'none')
    if (meta.chapter_id) {
      const { data: chapter, error: cErr } = await supabase
        .from('chapters')
        .select('id, name, join_code, user_id, semester')
        .eq('id', meta.chapter_id)
        .maybeSingle()

      if (cErr) console.warn('[loadProfile] Step 2 failed:', cErr.message)
      console.log('[loadProfile] Step 2 chapter:', chapter ? chapter.id : 'not found')

      if (chapter) {
        return {
          memberId:    null,
          chapterId:   chapter.id,
          fullName:    meta.full_name ?? user.email ?? '',
          userRole:    meta.role      ?? 'Treasurer',
          chapterName: chapter.name,
          joinCode:    chapter.join_code ?? '',
          isAdmin:     chapter.user_id === user.id,
          semester:    chapter.semester ?? '',
        }
      }
    }

    // ── Step 3: ownership fallback — member.user_id is null (pre-migration row) ──
    // Requires chapters.user_id to be set. If this also returns nothing, run fix_setup.sql.
    console.log('[loadProfile] Step 3 — checking owned chapter...')
    const { data: ownedChapter, error: ocErr } = await supabase
      .from('chapters')
      .select('id, name, join_code, user_id, semester')
      .eq('user_id', user.id)
      .maybeSingle()

    if (ocErr) console.warn('[loadProfile] Step 3 chapter failed:', ocErr.message)
    console.log('[loadProfile] Step 3 owned chapter:', ownedChapter ? ownedChapter.id : 'not found')

    if (ownedChapter) {
      const { data: memberByEmail, error: mbErr } = await supabase
        .from('members')
        .select('id, chapter_id, full_name, role')
        .eq('chapter_id', ownedChapter.id)
        .eq('email', user.email)
        .maybeSingle()

      if (mbErr) console.warn('[loadProfile] Step 3 member-by-email failed:', mbErr.message)
      console.log('[loadProfile] Step 3 member by email:', memberByEmail ? memberByEmail.id : 'not found')

      // Backfill in background so Step 1 works on next login
      if (memberByEmail) {
        supabase.from('members').update({ user_id: user.id }).eq('id', memberByEmail.id)
          .then(({ error: e }) => e
            ? console.warn('[loadProfile] member backfill failed:', e.message)
            : console.log('[loadProfile] backfilled members.user_id'))
      }
      supabase.from('chapters').update({ user_id: user.id }).eq('id', ownedChapter.id).is('user_id', null)
        .then(({ error: e }) => e
          ? console.warn('[loadProfile] chapter backfill failed:', e.message)
          : console.log('[loadProfile] backfilled chapters.user_id'))

      return {
        memberId:    memberByEmail?.id       ?? null,
        chapterId:   ownedChapter.id,
        fullName:    memberByEmail?.full_name ?? meta.full_name ?? user.email ?? '',
        userRole:    memberByEmail?.role      ?? meta.role ?? 'Treasurer',
        chapterName: ownedChapter.name,
        joinCode:    ownedChapter.join_code ?? '',
        isAdmin:     true,
        semester:    ownedChapter.semester  ?? '',
      }
    }

    console.log('[loadProfile] all steps exhausted — user needs CompleteSetup')
  } catch (err) {
    console.error('[loadProfile] unexpected error:', err)
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

    // Absolute ceiling — if INITIAL_SESSION never fires, unblock after 8s
    const hardTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[auth] hard timeout — forcing loading=false')
        setLoading(false)
      }
    }, 8000)

    function unblock() {
      if (mounted) {
        clearTimeout(hardTimeout)
        setLoading(false)
      }
    }

    // onAuthStateChange is the single source of truth.
    // INITIAL_SESSION fires synchronously on subscribe with the current cached session —
    // no separate getSession() call needed. That call was creating a competing path
    // with a shorter 1500ms race that cut off loadProfile before it finished,
    // causing chapterId to be null when loading resolved (→ flash of CompleteSetup).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return
      console.log('[auth] event:', event, '| user:', s?.user?.id ?? 'none')

      setSession(s)
      setUser(s?.user ?? null)

      if (event === 'INITIAL_SESSION') {
        if (s?.user) {
          // Give profile load up to 6s — enough for 3 sequential DB queries on a slow connection
          await Promise.race([
            (async () => { await ensureChapterExists(s.user); await refreshProfile(s.user) })(),
            new Promise((r) => setTimeout(r, 6000)),
          ])
        }
        unblock()
      } else if (event === 'SIGNED_IN' && s?.user) {
        await ensureChapterExists(s.user)
        await refreshProfile(s.user)
        unblock()
      } else if (event === 'SIGNED_OUT') {
        setProfile(PROFILE_DEFAULTS)
        unblock()
      } else if (event === 'TOKEN_REFRESHED' && s?.user) {
        refreshProfile(s.user) // background — don't block or re-trigger loading
      } else {
        unblock() // PASSWORD_RECOVERY, USER_UPDATED, etc.
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
