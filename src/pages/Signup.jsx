import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLES = ['Treasurer', 'President', 'Vice President', 'Officer', 'Member']

const SEMESTERS = [
  'Spring 2025', 'Fall 2025', 'Spring 2026', 'Fall 2026', 'Spring 2027',
]

export default function Signup() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', chapterName: '',
    semester: 'Fall 2026', role: 'Treasurer',
  })
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(false)
  const [emailSent, setEmailSent]       = useState(false)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error, needsEmailConfirmation } = await signUp(form)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (needsEmailConfirmation) {
      setEmailSent(true)
    }
    // If no email confirmation required, onAuthStateChange fires and
    // AppRoutes re-renders the authenticated view automatically.
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
            We sent a confirmation link to <span className="font-semibold text-gray-800">{form.email}</span>. Click it to activate your account and access Greek Ledger.
          </p>
          <Link to="/login" className="text-sm font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>
            Back to Sign In →
          </Link>
        </div>
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition'
  const focusStyle = {
    onFocus: (e) => e.target.style.borderColor = '#1e2a4a',
    onBlur:  (e) => e.target.style.borderColor = '#e5e7eb',
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#1e2a4a' }}>
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] flex-shrink-0 px-12 py-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
            &#9730;
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: '#c9a84c' }}>Greek Ledger</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Set up your chapter<br />in minutes.
          </h2>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
            One account gets your entire chapter set up with budget tracking, expense management, and member dues.
          </p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Your data is private and scoped to your chapter only.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
              &#9730;
            </div>
            <span className="text-xl font-bold" style={{ color: '#c9a84c' }}>Greek Ledger</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl px-8 py-10">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="text-sm text-gray-500 mt-1">Set up Greek Ledger for your chapter</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Personal info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Your Info</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={set('fullName')}
                      placeholder="Jake Davis"
                      className={inputClass}
                      {...focusStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="jake@chapter.org"
                      className={inputClass}
                      {...focusStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={6}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="Min. 6 characters"
                      className={inputClass}
                      {...focusStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Chapter info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Chapter Info</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Chapter Name</label>
                    <input
                      type="text"
                      required
                      value={form.chapterName}
                      onChange={set('chapterName')}
                      placeholder="Alpha Beta Chapter"
                      className={inputClass}
                      {...focusStyle}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester</label>
                      <select
                        value={form.semester}
                        onChange={set('semester')}
                        className={inputClass}
                        style={{ backgroundColor: 'white' }}
                      >
                        {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Role</label>
                      <select
                        value={form.role}
                        onChange={set('role')}
                        className={inputClass}
                        style={{ backgroundColor: 'white' }}
                      >
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
