import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#1e2a4a' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 px-12 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
            &#9730;
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: '#c9a84c' }}>Greek Ledger</span>
        </div>

        {/* Tagline */}
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Financial clarity<br />for your chapter.
          </h2>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Budget tracking, expense approvals, and dues management — all in one place built for fraternities.
          </p>
        </div>

        {/* Decorative stat pills */}
        <div className="space-y-3">
          {[
            { label: 'Budget Accounts', value: 'Track every dollar' },
            { label: 'Expense Approvals', value: 'Approve in one click' },
            { label: 'Dues Management', value: 'Never miss a payment' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#c9a84c' }} />
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
              &#9730;
            </div>
            <span className="text-xl font-bold" style={{ color: '#c9a84c' }}>Greek Ledger</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your chapter account</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="treasurer@chapter.org"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ '--tw-ring-color': '#1e2a4a' }}
                  onFocus={(e) => e.target.style.borderColor = '#1e2a4a'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <button type="button" className="text-xs font-medium hover:opacity-70 transition" style={{ color: '#1e2a4a' }}>
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition"
                  onFocus={(e) => e.target.style.borderColor = '#1e2a4a'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ backgroundColor: '#1e2a4a', color: '#fff' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold hover:opacity-80 transition" style={{ color: '#1e2a4a' }}>
                Create one →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
