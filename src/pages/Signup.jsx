import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLES      = ['Treasurer', 'President', 'Vice President', 'Officer', 'Member']
const SEMESTERS  = ['Spring 2025', 'Fall 2025', 'Spring 2026', 'Fall 2026', 'Spring 2027']
const JOIN_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']

const inputClass = 'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition'
const focusHandlers = {
  onFocus: (e) => { e.target.style.borderColor = '#1e2a4a' },
  onBlur:  (e) => { e.target.style.borderColor = '#e5e7eb' },
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
        &#9730;
      </div>
      <span className="text-xl font-bold tracking-tight" style={{ color: '#c9a84c' }}>Greek Ledger</span>
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function Signup() {
  const { signUp, joinChapter } = useAuth()

  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [createForm, setCreateForm] = useState({
    fullName: '', email: '', password: '', chapterName: '',
    semester: 'Fall 2026', role: 'Treasurer',
  })
  const [joinForm, setJoinForm] = useState({
    fullName: '', email: '', password: '', joinCode: '', year: 'Freshman',
  })
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const setC = (k) => (e) => setCreateForm((p) => ({ ...p, [k]: e.target.value }))
  const setJ = (k) => (e) => setJoinForm((p) => ({ ...p, [k]: e.target.value }))

  async function handleCreate(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error: err, needsEmailConfirmation } = await signUp(createForm)
    if (err) { setError(err.message); setLoading(false); return }
    if (needsEmailConfirmation) { setSentEmail(createForm.email); setEmailSent(true) }
    setLoading(false)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error: err, needsEmailConfirmation } = await joinChapter(joinForm)
    if (err) { setError(err.message); setLoading(false); return }
    if (needsEmailConfirmation) { setSentEmail(joinForm.email); setEmailSent(true) }
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#1e2a4a' }}>
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#eff6ff' }}>
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-6">
            We sent a confirmation link to <span className="font-semibold text-gray-800">{sentEmail}</span>. Click it to activate your account and access Greek Ledger.
          </p>
          <Link to="/login" className="text-sm font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>
            Back to Sign In →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#1e2a4a' }}>
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] flex-shrink-0 px-12 py-12">
        <Logo />
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            {mode === 'join'
              ? 'Join your\nchapter today.'
              : 'Set up your chapter\nin minutes.'}
          </h2>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {mode === 'join'
              ? 'Enter the 6-character join code your treasurer shared with you to get started.'
              : 'One account gets your entire chapter set up with budget tracking, expense management, and member dues.'}
          </p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Your data is private and scoped to your chapter only.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="flex lg:hidden justify-center mb-8">
            <Logo />
          </div>

          <div className="bg-white rounded-2xl shadow-2xl px-8 py-10">
            {!mode ? (
              /* ── Mode selector ── */
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-gray-900">Get started</h1>
                  <p className="text-sm text-gray-500 mt-1">How do you want to use Greek Ledger?</p>
                </div>
                <div className="space-y-4">
                  <button
                    onClick={() => setMode('create')}
                    className="w-full text-left px-5 py-4 rounded-xl border-2 transition"
                    style={{ borderColor: '#1e2a4a' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1e2a4a' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Create a Chapter</p>
                        <p className="text-xs text-gray-500 mt-0.5">Set up Greek Ledger for your fraternity — you're the treasurer or admin</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('join')}
                    className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 transition hover:border-gray-400"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f3f4f6' }}>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Join a Chapter</p>
                        <p className="text-xs text-gray-500 mt-0.5">Your treasurer gave you a 6-character join code — enter it to get access</p>
                      </div>
                    </div>
                  </button>
                </div>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>
                    Sign in →
                  </Link>
                </p>
              </>
            ) : mode === 'create' ? (
              /* ── Create chapter form ── */
              <>
                <div className="flex items-center gap-3 mb-7">
                  <button onClick={() => { setMode(null); setError(null) }} className="text-gray-400 hover:text-gray-600 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Set up Greek Ledger for your chapter</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Your Info</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                        <input type="text" required value={createForm.fullName} onChange={setC('fullName')} placeholder="Jake Davis" className={inputClass} {...focusHandlers} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                        <input type="email" required autoComplete="email" value={createForm.email} onChange={setC('email')} placeholder="jake@chapter.org" className={inputClass} {...focusHandlers} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                        <input type="password" required autoComplete="new-password" minLength={6} value={createForm.password} onChange={setC('password')} placeholder="Min. 6 characters" className={inputClass} {...focusHandlers} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Chapter Info</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Chapter Name</label>
                        <input type="text" required value={createForm.chapterName} onChange={setC('chapterName')} placeholder="Alpha Beta Chapter" className={inputClass} {...focusHandlers} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester</label>
                          <select value={createForm.semester} onChange={setC('semester')} className={inputClass} style={{ backgroundColor: 'white' }}>
                            {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Role</label>
                          <select value={createForm.role} onChange={setC('role')} className={inputClass} style={{ backgroundColor: 'white' }}>
                            {ROLES.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-60 mt-2"
                    style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}
                  >
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> Creating account…</span>
                      : 'Create Account & Chapter'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>Sign in →</Link>
                </p>
              </>
            ) : (
              /* ── Join chapter form ── */
              <>
                <div className="flex items-center gap-3 mb-7">
                  <button onClick={() => { setMode(null); setError(null) }} className="text-gray-400 hover:text-gray-600 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Join a Chapter</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Enter the code your treasurer shared with you</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleJoin} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Join Code</label>
                    <input
                      type="text"
                      required
                      value={joinForm.joinCode}
                      onChange={(e) => setJoinForm((p) => ({ ...p, joinCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                      placeholder="e.g. PIKE42"
                      maxLength={6}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center font-mono font-bold text-xl text-gray-900 placeholder-gray-300 focus:outline-none transition tracking-widest"
                      {...focusHandlers}
                    />
                    <p className="text-xs text-gray-400 mt-1.5 text-center">6-character code from your chapter's treasurer</p>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                      <input type="text" required value={joinForm.fullName} onChange={setJ('fullName')} placeholder="Jake Davis" className={inputClass} {...focusHandlers} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                      <input type="email" required autoComplete="email" value={joinForm.email} onChange={setJ('email')} placeholder="jake@chapter.org" className={inputClass} {...focusHandlers} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                      <input type="password" required autoComplete="new-password" minLength={6} value={joinForm.password} onChange={setJ('password')} placeholder="Min. 6 characters" className={inputClass} {...focusHandlers} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Class Year</label>
                      <select value={joinForm.year} onChange={setJ('year')} className={inputClass} style={{ backgroundColor: 'white' }}>
                        {JOIN_YEARS.map((y) => <option key={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || joinForm.joinCode.length !== 6}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-60 mt-2"
                    style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}
                  >
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> Joining chapter…</span>
                      : 'Join Chapter'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>Sign in →</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
