import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)

const SEMESTERS = ['Spring 2026', 'Fall 2026', 'Spring 2027', 'Fall 2027']
const ROLES     = ['Treasurer', 'President', 'VP Finance', 'Secretary', 'Social Chair', 'Member']
const YEARS     = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function CompleteSetup() {
  const navigate = useNavigate()
  const { user, fullName, refreshProfile, signOut } = useAuth()

  const [mode, setMode]       = useState(null) // 'create' | 'join'
  const [saving, setSaving]   = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError]     = useState(null)

  // If the user already has a chapter in the DB but loadProfile failed,
  // this lets them retry without signing out.
  async function handleRetry() {
    setRetrying(true)
    setError(null)
    try {
      await Promise.race([
        refreshProfile(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ])
      // If loadProfile found the chapter, chapterId in context is now set and
      // AppRoutes will automatically redirect to the dashboard.
    } catch {
      setError('Could not reach the database. Check your connection and the browser console for details.')
    } finally {
      setRetrying(false)
    }
  }

  const [createForm, setCreateForm] = useState({ chapterName: '', semester: 'Fall 2026', role: 'Treasurer' })
  const [joinForm, setJoinForm]     = useState({ joinCode: '', year: 'Freshman' })

  function setC(k, v) { setCreateForm((f) => ({ ...f, [k]: v })); setError(null) }
  function setJ(k, v) { setJoinForm((f) => ({ ...f, [k]: v }));   setError(null) }

  async function handleCreate() {
    if (!createForm.chapterName.trim()) { setError('Chapter name is required.'); return }
    setSaving(true)
    setError(null)

    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      setSaving(false)
      setError('Something went wrong — it took too long. Please try again.')
    }, 8000)

    try {
      console.log('Starting chapter creation')

      // Pull directly from session — never rely on context user, which can lag after signup
      const { data: { session: sess }, error: sessErr } = await supabase.auth.getSession()
      if (sessErr || !sess?.user) throw new Error(sessErr?.message ?? 'Not authenticated. Please sign in again.')
      const userId = sess.user.id
      console.log('Auth confirmed, user_id:', userId)

      const chapterId = crypto.randomUUID()
      const joinCode  = Math.random().toString(36).substring(2, 8).toUpperCase()

      console.log('Inserting chapter:', { id: chapterId, name: createForm.chapterName.trim(), user_id: userId })
      const { data: chapter, error: chapErr } = await supabase
        .from('chapters')
        .insert({
          id:        chapterId,
          name:      createForm.chapterName.trim(),
          semester:  createForm.semester,
          user_id:   userId,
          join_code: joinCode,
        })
        .select()
        .single()
      if (chapErr) throw new Error(`Chapter insert failed: ${chapErr.message}`)
      console.log('Chapter created:', chapter)

      console.log('Creating member record:', { chapter_id: chapterId, user_id: userId, role: createForm.role })
      const { data: member, error: memErr } = await supabase
        .from('members')
        .insert({
          chapter_id:  chapterId,
          user_id:     userId,
          full_name:   fullName || sess.user.email,
          role:        createForm.role,
          year:        'Senior',
          dues_status: 'Paid',
          email:       sess.user.email,
        })
        .select()
        .single()
      if (memErr) throw new Error(`Member insert failed: ${memErr.message}`)
      console.log('Member created:', member)

      clearTimeout(timeoutId)
      console.log('Setup complete — refreshing profile')

      // Cap refreshProfile at 4s — it must never block navigation
      await Promise.race([
        refreshProfile(),
        new Promise((r) => setTimeout(r, 4000)),
      ])

      if (!timedOut) {
        console.log('Navigating to dashboard')
        navigate('/', { replace: true })
      }
    } catch (err) {
      clearTimeout(timeoutId)
      console.error('Chapter creation failed:', err)
      if (!timedOut) setError(err?.message ?? 'Failed to create chapter. Please try again.')
    } finally {
      clearTimeout(timeoutId)
      if (!timedOut) setSaving(false)
    }
  }

  async function handleJoin() {
    if (joinForm.joinCode.length !== 6) { setError('Enter a valid 6-character join code.'); return }
    setSaving(true)
    setError(null)

    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      setSaving(false)
      setError('Something went wrong — it took too long. Please try again.')
    }, 8000)

    try {
      console.log('Starting join flow')

      const { data: { session: sess }, error: sessErr } = await supabase.auth.getSession()
      if (sessErr || !sess?.user) throw new Error(sessErr?.message ?? 'Not authenticated. Please sign in again.')
      const userId = sess.user.id
      console.log('Auth confirmed, user_id:', userId)

      const { data: rows, error: lookupErr } = await supabase
        .rpc('lookup_join_code', { code: joinForm.joinCode.toUpperCase() })
      if (lookupErr) throw new Error(`Join code lookup failed: ${lookupErr.message}`)
      if (!rows?.length) throw new Error('Invalid join code. Check with your treasurer and try again.')
      console.log('Join code valid, chapter_id:', rows[0].chapter_id)

      console.log('Creating member record:', { chapter_id: rows[0].chapter_id, user_id: userId })
      const { data: member, error: memErr } = await supabase
        .from('members')
        .insert({
          chapter_id:  rows[0].chapter_id,
          user_id:     userId,
          full_name:   fullName || sess.user.email,
          role:        'Member',
          year:        joinForm.year,
          dues_status: 'Pending',
          email:       sess.user.email,
        })
        .select()
        .single()
      if (memErr) throw new Error(`Member insert failed: ${memErr.message}`)
      console.log('Member created:', member)

      clearTimeout(timeoutId)
      console.log('Join complete — refreshing profile')

      await Promise.race([
        refreshProfile(),
        new Promise((r) => setTimeout(r, 4000)),
      ])

      if (!timedOut) {
        console.log('Navigating to dashboard')
        navigate('/', { replace: true })
      }
    } catch (err) {
      clearTimeout(timeoutId)
      console.error('Join failed:', err)
      if (!timedOut) setError(err?.message ?? 'Failed to join chapter. Please try again.')
    } finally {
      clearTimeout(timeoutId)
      if (!timedOut) setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#1e2a4a', color: '#c9a84c' }}
        >
          &#9730;
        </div>
        <span className="text-xl font-bold tracking-tight" style={{ color: '#1e2a4a' }}>Greek Ledger</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Complete Your Setup</h1>
          <p className="text-sm text-gray-500">
            Your account isn't linked to a chapter yet. Create a new chapter or join one with a code.
          </p>
          {user?.email && (
            <p className="text-xs text-gray-400 mt-3">Signed in as {user.email}</p>
          )}
          {user?.id && (
            <p className="text-xs mt-1" style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
              uid: {user.id}
            </p>
          )}
        </div>

        <div className="px-8 py-6 space-y-4">
          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
              {error}
            </p>
          )}

          {/* Mode selector */}
          {!mode && (
            <div className="space-y-3">
              {/* Retry — for users whose chapter exists but loadProfile failed */}
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
              >
                {retrying ? 'Checking…' : 'Already set up a chapter? Try loading it →'}
              </button>
              <button
                onClick={() => { setMode('create'); setError(null) }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition hover:border-blue-400"
                style={{ borderColor: '#e5e7eb' }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#eff6ff' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Create a Chapter</p>
                  <p className="text-xs text-gray-500 mt-0.5">I'm a treasurer or officer setting up our chapter for the first time.</p>
                </div>
              </button>

              <button
                onClick={() => { setMode('join'); setError(null) }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition hover:border-blue-400"
                style={{ borderColor: '#e5e7eb' }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Join a Chapter</p>
                  <p className="text-xs text-gray-500 mt-0.5">I have a 6-character join code from my chapter's treasurer.</p>
                </div>
              </button>
            </div>
          )}

          {/* Create Chapter form */}
          {mode === 'create' && (
            <div className="space-y-4">
              <Field label={<>Chapter / Organization Name <span className="text-red-400">*</span></>}>
                <input
                  type="text"
                  placeholder="Alpha Beta Gamma — Epsilon Chapter"
                  value={createForm.chapterName}
                  onChange={(e) => setC('chapterName', e.target.value)}
                  className={inputCls}
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Semester">
                  <select value={createForm.semester} onChange={(e) => setC('semester', e.target.value)} className={inputCls}>
                    {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Your Role">
                  <select value={createForm.role} onChange={(e) => setC('role', e.target.value)} className={inputCls}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setMode(null); setError(null) }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !createForm.chapterName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1e2a4a', color: '#fff' }}
                >
                  {saving && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                  {saving ? 'Creating…' : 'Create Chapter'}
                </button>
              </div>
            </div>
          )}

          {/* Join Chapter form */}
          {mode === 'join' && (
            <div className="space-y-4">
              <Field label={<>Join Code <span className="text-red-400">*</span></>}>
                <input
                  type="text"
                  placeholder="ABC123"
                  maxLength={6}
                  value={joinForm.joinCode}
                  onChange={(e) => setJ('joinCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className={`${inputCls} font-mono text-center text-lg tracking-widest`}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1 text-center">{joinForm.joinCode.length}/6 characters</p>
              </Field>

              <Field label="Your Year">
                <select value={joinForm.year} onChange={(e) => setJ('year', e.target.value)} className={inputCls}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </Field>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setMode(null); setError(null) }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={saving || joinForm.joinCode.length !== 6}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1e2a4a', color: '#fff' }}
                >
                  {saving && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                  {saving ? 'Joining…' : 'Join Chapter'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 text-center">
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  )
}
