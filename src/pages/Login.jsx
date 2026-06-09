import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AnimatedBackground from '../components/AnimatedBackground'
import BrandMark from '../components/BrandMark'

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
    <div className="min-h-screen flex" style={{ backgroundColor: '#f3efe6' }}>
      {/* Left — navy showpiece panel */}
      <div className="relative hidden lg:flex flex-col justify-between w-[46%] max-w-[620px] flex-shrink-0 px-14 py-14 overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 gl-rise">
          <BrandMark variant="light" size="md" />
        </div>

        <div className="relative z-10 gl-rise" style={{ animationDelay: '0.08s' }}>
          <p className="gl-eyebrow mb-5" style={{ color: '#c4a368' }}>Chapter Financial Management</p>
          <h2 className="gl-serif text-white leading-[1.08] mb-6" style={{ fontSize: '3.25rem', fontWeight: 500 }}>
            Order and clarity<br />for the chapter purse.
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(243,239,230,0.62)', maxWidth: 420 }}>
            Budgets, expense approvals, and dues — kept with the discipline your
            chapter&apos;s finances deserve, and handed cleanly to the next treasurer.
          </p>
        </div>

        <div className="relative z-10 gl-rise space-y-4" style={{ animationDelay: '0.16s' }}>
          <div className="gl-rule" style={{ maxWidth: 420 }} />
          {[
            ['Modular budgets', 'Every account and sub-account, your way'],
            ['One-click approvals', 'Officers submit, the treasurer approves'],
            ['Dues, tracked', 'By class year or member — never chased twice'],
          ].map(([t, d]) => (
            <div key={t} className="flex items-baseline gap-4">
              <span className="gl-serif flex-shrink-0" style={{ color: '#c4a368', fontSize: '1.05rem', width: 14 }}>·</span>
              <div>
                <p className="text-[13.5px] font-semibold" style={{ color: '#f3efe6' }}>{t}</p>
                <p className="text-[12.5px]" style={{ color: 'rgba(243,239,230,0.45)' }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — sign-in */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] gl-rise" style={{ animationDelay: '0.1s' }}>
          <div className="flex lg:hidden justify-center mb-10">
            <BrandMark variant="dark" size="md" />
          </div>

          <div className="mb-9">
            <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Welcome back</p>
            <h1 className="gl-serif gl-underline" style={{ fontSize: '2.25rem', fontWeight: 600, color: '#1b2640', lineHeight: 1.1 }}>
              Sign in
            </h1>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#fbeaea', color: '#9b2c2c', border: '1px solid #f0d2d2' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#5b677f' }}>Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="treasurer@chapter.org"
                className="gl-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium" style={{ color: '#5b677f' }}>Password</label>
                <button type="button" className="text-[12px] font-medium hover:opacity-70 transition" style={{ color: '#b08d4f' }}>
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
                className="gl-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gl-btn-navy w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 mt-1"
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

          <div className="gl-rule my-8" />

          <p className="text-center text-sm" style={{ color: '#5b677f' }}>
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold hover:opacity-80 transition" style={{ color: '#b08d4f' }}>
              Create one →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
