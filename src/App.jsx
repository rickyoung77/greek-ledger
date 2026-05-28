import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
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

function AppRoutes() {
  const { user, loading } = useAuth()
  // Independent fallback: if loading hangs past 3s, show login regardless
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) { setLoadingTimedOut(false); return }
    const t = setTimeout(() => setLoadingTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !loadingTimedOut) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-5" style={{ backgroundColor: '#1e2a4a' }}>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold"
            style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}
          >
            &#9730;
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: '#c9a84c' }}>Greek Ledger</span>
        </div>
        <div
          className="w-7 h-7 rounded-full border-4 animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#c9a84c' }}
        />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
