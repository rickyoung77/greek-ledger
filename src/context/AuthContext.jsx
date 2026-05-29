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
    // ── Step 1: find member by user_id ───────────────────────
    // Requires: members.user_id is populated AND members_select RLS can see it.
    // RLS note: members_select checks chapter ownership — if chapters.user_id is null
    // on this user's chapter row, this query returns empty even if user_id is set.
    // Run supabase/fix_setup.sql to repair both columns and the RLS policy.
    const { data: member, error: mErr } = await supabase
      .from('members')
      .select('id, chapter_id, full_name, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (mErr) console.warn('[loadProfile] Step 1 member query failed:', mErr.message)
    else console.log('[loadProfile] Step 1 member:', member ? member.id : 'not found')

    if (member) {
      // ── Step 2: load chapter from member.chapter_id ─────────
      // Use member.chapter_id directly — don't skip if chapter query is blocked by RLS,
      // because chapterId from the member row is what unlocks the app.
      const { data: chapter, error: cErr } = await supabase
        .from('chapters')
        .select('id, name, join_code, user_id, semester')
        .eq('id', member.chapter_id)
        .maybeSingle()

      if (cErr) console.warn('[loadProfile] Step 2 chapter query failed:', cErr.message)
      console.log('[loadProfile] Step 2 chapter:', chapter ? chapter.id : 'not found (using member.chapter_id anyway)')

      return {
        memberId:    member.id,
        chapterId:   member.chapter_id,           // from member row — reliable even if chapter RLS blocks
        fullName:    member.full_name,
        userRole:    member.role,
        chapterName: chapter?.name      ?? '',
        joinCode:    chapter?.join_code ?? '',
        isAdmin:     chapter?.user_id   === user.id,
        semester:    chapter?.semester  ?? '',
      }
    }

    // ── Step 3: legacy — chapter_id in JWT metadata (old Signup flow) ───
    const meta = user.user_metadata ?? {}
    console.log('[loadProfile] Step 3 metadata chapter_id:', meta.chapter_id ?? 'none')
    if (meta.chapter_id) {
      const { data: chapter, error: cErr } = await supabase
        .from('chapters')
        .select('id, name, join_code, user_id, semester')
        .eq('id', meta.chapter_id)
        .maybeSingle()

      if (cErr) console.warn('[loadProfile] Step 3 chapter query failed:', cErr.message)
      console.log('[loadProfile] Step 3 chapter:', chapter ? chapter.id : 'not found')

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

    // ── Step 4: ownership fallback — user owns a chapter but member.user_id is null ───
    // Works only if chapters.user_id is correctly set. If it's null, run fix_setup.sql.
    console.log('[loadProfile] Step 4 — checking owned chapter...')
    const { data: ownedChapter, error: ocErr } = await supabase
      .from('chapters')
      .select('id, name, join_code, user_id, semester')
      .eq('user_id', user.id)
      .maybeSingle()

    if (ocErr) console.warn('[loadProfile] Step 4 chapter query failed:', ocErr.message)
    console.log('[loadProfile] Step 4 owned chapter:', ownedChapter ? ownedChapter.id : 'not found')

    if (ownedChapter) {
      const { data: memberByEmail, error: mbErr } = await supabase
        .from('members')
        .select('id, chapter_id, full_name, role')
        .eq('chapter_id', ownedChapter.id)
        .eq('email', user.email)
        .maybeSingle()

      if (mbErr) console.warn('[loadProfile] Step 4 member-by-email failed:', mbErr.message)
      console.log('[loadProfile] Step 4 member by email:', memberByEmail ? memberByEmail.id : 'not found')

      // Backfill both tables in the background so Steps 1+2 work on next login
      if (memberByEmail) {
        supabase.from('members').update({ user_id: user.id }).eq('id', memberByEmail.id)
          .then(({ error: e }) => e
            ? console.warn('[loadProfile] member backfill failed:', e.message)
            : console.log('[loadProfile] backfilled members.user_id for', memberByEmail.id))
      }
      supabase.from('chapters').update({ user_id: user.id }).eq('id', ownedChapter.id).is('user_id', null)
        .then(({ error: e }) => e
          ? console.warn('[loadProfile] chapter backfill failed:', e.message)
          : console.log('[loadProfile] backfilled chapters.user_id for', ownedChapter.id))

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
