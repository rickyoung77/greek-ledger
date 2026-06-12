import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SemesterProvider } from './context/SemesterContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import BudgetAccounts from './pages/BudgetAccounts'
import Expenses from './pages/Expenses'
import Members from './pages/Members'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Dues from './pages/Dues'
import CompleteSetup from './pages/CompleteSetup'

function AppRoutes() {
  const { user, loading, chapterId } = useAuth()
  // Independent fallback: if loading hangs past 7s, force past the spinner.
  // Must be less than AuthContext's 8s hardTimeout so this fires first.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) { setLoadingTimedOut(false); return }
    const t = setTimeout(() => setLoadingTimedOut(true), 7000)
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !loadingTimedOut) {
    return (
      <div className="gl-navy-panel h-screen flex flex-col items-center justify-center gap-6 relative">
        <div className="gl-pinstripe absolute inset-0 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div
            className="flex items-center justify-center rounded-lg gl-serif"
            style={{ width: 52, height: 52, border: '1px solid rgba(196,163,104,0.55)', background: 'linear-gradient(180deg, rgba(176,141,79,0.18), rgba(176,141,79,0.04))', color: '#b08d4f', fontSize: 26, fontWeight: 600 }}
          >
            GL
          </div>
          <span className="gl-serif" style={{ color: '#f3efe6', fontSize: '1.5rem', fontWeight: 600 }}>Greek Ledger</span>
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(196,163,104,0.2)', borderTopColor: '#b08d4f' }}
          />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*"       element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Logged in but no chapter — guide them to complete setup before any data page
  if (!chapterId) {
    return (
      <Routes>
        <Route path="/complete-setup" element={<CompleteSetup />} />
        <Route path="*"               element={<Navigate to="/complete-setup" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"                element={<Dashboard />} />
        <Route path="/budget-accounts" element={<BudgetAccounts />} />
        <Route path="/expenses"        element={<Expenses />} />
        <Route path="/members"         element={<Members />} />
        <Route path="/notifications"   element={<Notifications />} />
        <Route path="/dues"             element={<Dues />} />
        <Route path="/settings"        element={<Settings />} />
        <Route path="/login"           element={<Navigate to="/" replace />} />
        <Route path="/signup"          element={<Navigate to="/" replace />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SemesterProvider>
          <AppRoutes />
        </SemesterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
