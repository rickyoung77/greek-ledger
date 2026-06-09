import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AnimatedBackground from '../components/AnimatedBackground'
import BrandMark from '../components/BrandMark'

const ROLES      = ['Treasurer', 'President', 'Vice President', 'Officer', 'Member']
const SEMESTERS  = ['Spring 2025', 'Fall 2025', 'Spring 2026', 'Fall 2026', 'Spring 2027']
const JOIN_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const Label = ({ children }) => (
  <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#5b677f' }}>{children}</label>
)

export default function Signup() {
  const { signUp, signUpJoin } = useAuth()

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
    const { error: err, needsEmailConfirmation } = await signUpJoin(joinForm)
    if (err) { setError(err.message); setLoading(false); return }
    if (needsEmailConfirmation) { setSentEmail(joinForm.email); setEmailSent(true) }
    setLoading(false)
  }

  // ── Email-confirmation screen ────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#f3efe6' }}>
        <div className="gl-card rounded-2xl px-10 py-12 w-full max-w-md text-center gl-rise">
          <div className="flex justify-center mb-8"><BrandMark variant="dark" size="sm" /></div>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#f6efe0', border: '1px solid #e7dcc4' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="#b08d4f" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="gl-serif mb-3" style={{ fontSize: '1.85rem', fontWeight: 600, color: '#1b2640' }}>Check your email</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#5b677f' }}>
            We sent a confirmation link to <span className="font-semibold" style={{ color: '#1b2640' }}>{sentEmail}</span>.
            Click it to activate your account and access Greek Ledger.
          </p>
          <Link to="/login" className="text-sm font-semibold hover:opacity-80 transition" style={{ color: '#b08d4f' }}>
            Back to Sign In →
          </Link>
        </div>
      </div>
    )
  }

  const tagline = mode === 'join'
    ? { eyebrow: 'Join your chapter', head: 'A seat at\nthe table.', body: 'Enter the six-character code your treasurer shared, and your chapter is at your fingertips.' }
    : { eyebrow: 'Establish your chapter', head: 'Founded on\ngood order.', body: 'One account sets your entire chapter up with budgets, expense approvals, and member dues.' }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f3efe6' }}>
      {/* Left — navy showpiece panel */}
      <div className="relative hidden lg:flex flex-col justify-between w-[44%] max-w-[560px] flex-shrink-0 px-14 py-14 overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 gl-rise"><BrandMark variant="light" size="md" /></div>

        <div className="relative z-10 gl-rise" style={{ animationDelay: '0.08s' }}>
          <p className="gl-eyebrow mb-5" style={{ color: '#c4a368' }}>{tagline.eyebrow}</p>
          <h2 className="gl-serif text-white leading-[1.08] mb-6" style={{ fontSize: '3rem', fontWeight: 500, whiteSpace: 'pre-line' }}>
            {tagline.head}
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(243,239,230,0.62)', maxWidth: 400 }}>
            {tagline.body}
          </p>
        </div>

        <p className="relative z-10 text-[12.5px] gl-rise" style={{ color: 'rgba(243,239,230,0.4)', animationDelay: '0.16s' }}>
          Your data is private and scoped to your chapter alone.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] gl-rise" style={{ animationDelay: '0.1s' }}>
          <div className="flex lg:hidden justify-center mb-10"><BrandMark variant="dark" size="md" /></div>

          {!mode ? (
            /* ── Mode selector ── */
            <>
              <div className="mb-8">
                <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Get started</p>
                <h1 className="gl-serif gl-underline" style={{ fontSize: '2.25rem', fontWeight: 600, color: '#1b2640', lineHeight: 1.1 }}>
                  How will you<br />use Greek Ledger?
                </h1>
              </div>

              <div className="space-y-3.5">
                <button
                  onClick={() => setMode('create')}
                  className="group w-full text-left px-6 py-5 rounded-xl transition gl-card hover:-translate-y-0.5"
                  style={{ borderColor: '#e3dccd' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1b2640' }}>
                      <svg className="w-5 h-5" fill="none" stroke="#c4a368" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="gl-serif" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1b2640' }}>Create a Chapter</p>
                      <p className="text-[12.5px] mt-0.5" style={{ color: '#5b677f' }}>You&apos;re the treasurer or officer setting things up.</p>
                    </div>
                    <span className="transition group-hover:translate-x-0.5" style={{ color: '#b08d4f' }}>→</span>
                  </div>
                </button>

                <button
                  onClick={() => setMode('join')}
                  className="group w-full text-left px-6 py-5 rounded-xl transition gl-card hover:-translate-y-0.5"
                  style={{ borderColor: '#e3dccd' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f6efe0', border: '1px solid #e7dcc4' }}>
                      <svg className="w-5 h-5" fill="none" stroke="#b08d4f" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="gl-serif" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1b2640' }}>Join a Chapter</p>
                      <p className="text-[12.5px] mt-0.5" style={{ color: '#5b677f' }}>You have a six-character code from your treasurer.</p>
                    </div>
                    <span className="transition group-hover:translate-x-0.5" style={{ color: '#b08d4f' }}>→</span>
                  </div>
                </button>
              </div>

              <div className="gl-rule my-8" />
              <p className="text-center text-sm" style={{ color: '#5b677f' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#b08d4f' }}>Sign in →</Link>
              </p>
            </>
          ) : mode === 'create' ? (
            /* ── Create chapter form ── */
            <>
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => { setMode(null); setError(null) }} className="hover:opacity-60 transition" style={{ color: '#b08d4f' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <p className="gl-eyebrow mb-1" style={{ color: '#b08d4f' }}>New chapter</p>
                  <h1 className="gl-serif" style={{ fontSize: '1.9rem', fontWeight: 600, color: '#1b2640', lineHeight: 1.1 }}>Create your account</h1>
                </div>
              </div>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#fbeaea', color: '#9b2c2c', border: '1px solid #f0d2d2' }}>{error}</div>
              )}

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <p className="gl-eyebrow mb-3" style={{ color: '#a99f8b' }}>Your Information</p>
                  <div className="space-y-4">
                    <div>
                      <Label>Full Name</Label>
                      <input type="text" required value={createForm.fullName} onChange={setC('fullName')} placeholder="Jake Davis" className="gl-input" />
                    </div>
                    <div>
                      <Label>Email Address</Label>
                      <input type="email" required autoComplete="email" value={createForm.email} onChange={setC('email')} placeholder="jake@chapter.org" className="gl-input" />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <input type="password" required autoComplete="new-password" minLength={6} value={createForm.password} onChange={setC('password')} placeholder="Min. 6 characters" className="gl-input" />
                    </div>
                  </div>
                </div>

                <div className="gl-rule" />

                <div>
                  <p className="gl-eyebrow mb-3" style={{ color: '#a99f8b' }}>Chapter Details</p>
                  <div className="space-y-4">
                    <div>
                      <Label>Chapter Name</Label>
                      <input type="text" required value={createForm.chapterName} onChange={setC('chapterName')} placeholder="Alpha Beta — Epsilon Chapter" className="gl-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Semester</Label>
                        <select value={createForm.semester} onChange={setC('semester')} className="gl-input">
                          {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Your Role</Label>
                        <select value={createForm.role} onChange={setC('role')} className="gl-input">
                          {ROLES.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="gl-btn-brass w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 mt-1">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> Creating account…</span>
                    : 'Create Account & Chapter'}
                </button>
              </form>

              <p className="mt-7 text-center text-sm" style={{ color: '#5b677f' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#b08d4f' }}>Sign in →</Link>
              </p>
            </>
          ) : (
            /* ── Join chapter form ── */
            <>
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => { setMode(null); setError(null) }} className="hover:opacity-60 transition" style={{ color: '#b08d4f' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <p className="gl-eyebrow mb-1" style={{ color: '#b08d4f' }}>Join a chapter</p>
                  <h1 className="gl-serif" style={{ fontSize: '1.9rem', fontWeight: 600, color: '#1b2640', lineHeight: 1.1 }}>Enter your code</h1>
                </div>
              </div>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#fbeaea', color: '#9b2c2c', border: '1px solid #f0d2d2' }}>{error}</div>
              )}

              <form onSubmit={handleJoin} className="space-y-5">
                <div>
                  <Label>Join Code</Label>
                  <input
                    type="text"
                    required
                    value={joinForm.joinCode}
                    onChange={(e) => setJoinForm((p) => ({ ...p, joinCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                    placeholder="ABC123"
                    maxLength={6}
                    className="gl-input gl-serif text-center"
                    style={{ fontSize: '1.6rem', fontWeight: 600, letterSpacing: '0.4em', paddingLeft: '0.4em' }}
                  />
                  <p className="text-[12px] mt-2 text-center" style={{ color: '#a99f8b' }}>Six-character code from your chapter&apos;s treasurer</p>
                </div>

                <div className="gl-rule" />

                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <input type="text" required value={joinForm.fullName} onChange={setJ('fullName')} placeholder="Jake Davis" className="gl-input" />
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <input type="email" required autoComplete="email" value={joinForm.email} onChange={setJ('email')} placeholder="jake@chapter.org" className="gl-input" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <input type="password" required autoComplete="new-password" minLength={6} value={joinForm.password} onChange={setJ('password')} placeholder="Min. 6 characters" className="gl-input" />
                  </div>
                  <div>
                    <Label>Class Year</Label>
                    <select value={joinForm.year} onChange={setJ('year')} className="gl-input">
                      {JOIN_YEARS.map((y) => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={loading || joinForm.joinCode.length !== 6} className="gl-btn-brass w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 mt-1">
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><SpinnerIcon /> Joining chapter…</span>
                    : 'Join Chapter'}
                </button>
              </form>

              <p className="mt-7 text-center text-sm" style={{ color: '#5b677f' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#b08d4f' }}>Sign in →</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
