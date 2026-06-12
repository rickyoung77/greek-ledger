import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSemester } from '../context/SemesterContext'
import Spinner from '../components/Spinner'

const CARD_META = [
  {
    label: 'Total Income', key: 'totalIncome', fmt: 'money',
    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  },
  {
    label: 'Total Spent', key: 'totalSpent', fmt: 'money',
    color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
  },
  {
    label: 'Net Cash Flow', key: 'netCashFlow', fmt: 'money',
    color: '#1b2640', bg: '#eef1f6', border: '#cbd3e0',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  },
  {
    label: 'Total Budget', key: 'totalBudget', fmt: 'money',
    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    label: 'Remaining Balance', key: 'remaining', fmt: 'money',
    color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    label: 'Active Members', key: 'memberCount', fmt: 'number',
    color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
]

const INCOME_CATEGORIES = ['Tailgate', 'Door Fees', 'Fundraiser', 'Dues', 'Other']

const statusStyles = {
  Approved: { bg: '#dcfce7', text: '#15803d' },
  Pending:  { bg: '#fef9c3', text: '#a16207' },
  Rejected: { bg: '#fee2e2', text: '#b91c1c' },
}
const fmt     = (n) => `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Dashboard() {
  const navigate = useNavigate()
  const { chapterId, fullName, isAdmin, canSubmitExpenses, loading: authLoading } = useAuth()
  const { viewingSemesterId, isViewingActive } = useSemester()

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [stats, setStats]         = useState({ totalBudget: 0, totalSpent: 0, remaining: 0, memberCount: 0, totalIncome: 0, netCashFlow: 0 })
  const [overview, setOverview]   = useState([])
  const [expenses, setExpenses]   = useState([])
  const [income, setIncome]       = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ amount: '', category: 'Social', description: '', date: '' })
  // Income modal
  const [showIncome, setShowIncome]   = useState(false)
  const [incForm, setIncForm]         = useState({ amount: '', category: 'Tailgate', description: '', date: '' })
  const [incSaving, setIncSaving]     = useState(false)
  const [incError, setIncError]       = useState(null)

  // Safety valve: only fire if a load is GENUINELY still pending after 12s.
  // Tied to `loading` so a successful (even slow) load clears it. The old
  // version checked "is mounted" instead, so it showed "timed out" on every
  // page ~3s after load even on success (masked locally by dev StrictMode).
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError((prev) => prev ?? 'Loading timed out. Please refresh the page.')
    }, 12000)
    return () => clearTimeout(timer)
  }, [loading])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const bySem = (q) => (viewingSemesterId ? q.eq('semester_id', viewingSemesterId) : q)
      const [
        { data: topAccounts, error: e1 },
        { data: allAccounts, error: e2 },
        { data: expenseRows, error: e3 },
        { count: memberCount, error: e4 },
        { data: incomeRows, error: e5 },
      ] = await Promise.all([
        bySem(supabase.from('budget_accounts').select('*').eq('chapter_id', chapterId).is('parent_id', null)),
        bySem(supabase.from('budget_accounts').select('*').eq('chapter_id', chapterId)),
        bySem(supabase.from('expenses').select('*').eq('chapter_id', chapterId).order('date', { ascending: false })),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('chapter_id', chapterId),
        bySem(supabase.from('income').select('*').eq('chapter_id', chapterId).order('date', { ascending: false })),
      ])
      if (e1 || e2 || e3 || e4 || e5) throw e1 || e2 || e3 || e4 || e5

      const totalBudget = (topAccounts ?? []).reduce((s, a) => s + Number(a.total_budget), 0)
      const approved    = (expenseRows  ?? []).filter((e) => e.status === 'Approved')
      const totalSpent  = approved.reduce((s, e) => s + Number(e.amount), 0)
      const totalIncome = (incomeRows ?? []).reduce((s, i) => s + Number(i.amount), 0)

      const accountMap = {}
      ;(allAccounts ?? []).forEach((a) => { accountMap[a.id] = a })

      const spentByTop = {}
      ;(expenseRows ?? []).filter((e) => e.status !== 'Rejected').forEach((e) => {
        if (!e.budget_account_id) return
        const acct = accountMap[e.budget_account_id]
        if (!acct) return
        const topId = acct.parent_id ?? acct.id
        spentByTop[topId] = (spentByTop[topId] || 0) + Number(e.amount)
      })

      setStats({
        totalBudget, totalSpent, remaining: totalBudget - totalSpent,
        memberCount: memberCount ?? 0,
        totalIncome, netCashFlow: totalIncome - totalSpent,
      })
      setIncome((incomeRows ?? []).slice(0, 6))
      setOverview(
        (topAccounts ?? []).map((a) => ({
          id:    a.id,
          name:  a.name === 'Social Chair' ? 'Social' : a.name,
          total: Number(a.total_budget),
          spent: spentByTop[a.id] || 0,
          color: a.color,
        }))
      )
      setExpenses((expenseRows ?? []).slice(0, 6))
    } catch (err) {
      setError(err?.message ?? 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, viewingSemesterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  async function handleSubmit() {
    const { error } = await supabase.from('expenses').insert({
      chapter_id:   chapterId,
      description:  form.description,
      amount:       parseFloat(form.amount) || 0,
      category:     form.category,
      submitted_by: fullName || 'Unknown',
      status:       'Pending',
      date:         form.date || new Date().toISOString().slice(0, 10),
    })
    if (!error) {
      setShowModal(false)
      setForm({ amount: '', category: 'Social', description: '', date: '' })
      load()
    }
  }

  async function handleIncomeSubmit() {
    if (!incForm.amount || !incForm.description.trim()) {
      setIncError('Amount and description are required.')
      return
    }
    setIncSaving(true); setIncError(null)
    const { error } = await supabase.from('income').insert({
      chapter_id:  chapterId,
      description: incForm.description.trim(),
      amount:      parseFloat(incForm.amount) || 0,
      category:    incForm.category,
      recorded_by: fullName || 'Unknown',
      date:        incForm.date || new Date().toISOString().slice(0, 10),
    })
    setIncSaving(false)
    if (error) { setIncError(error.message ?? 'Failed to record income.'); return }
    setShowIncome(false)
    setIncForm({ amount: '', category: 'Tailgate', description: '', date: '' })
    load()
  }

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  const displayValue = (card) => {
    const v = stats[card.key]
    return card.fmt === 'money' ? fmt(v) : v.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5">
        {CARD_META.map((card) => {
          // Net Cash Flow turns red when negative (spending exceeds income).
          const negative = card.key === 'netCashFlow' && stats.netCashFlow < 0
          const valueColor = negative ? '#b91c1c' : '#111827'
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between" style={{ borderBottom: `3px solid ${card.border}` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="gl-serif text-4xl font-semibold mt-1" style={{ color: valueColor }}>{displayValue(card)}</p>
                </div>
                <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: card.bg, color: card.color }}>
                  {card.icon}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="gl-serif text-lg font-semibold text-gray-900 mb-5">Budget Overview</h2>
        {overview.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No budget accounts yet. Create one in Budget Accounts.</p>
        ) : (
          <div className="space-y-4">
            {overview.map((cat) => {
              const pct = cat.total > 0 ? Math.min(Math.round((cat.spent / cat.total) * 100), 100) : 0
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    <span className="text-sm text-gray-500">
                      {fmt(cat.spent)} <span className="text-gray-400">/ {fmt(cat.total)}</span>
                      <span className="ml-2 font-semibold" style={{ color: cat.color }}>{pct}%</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions + Recent Expenses */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="gl-serif text-lg font-semibold text-gray-900">Recent Expenses</h2>
          <div className="flex items-center gap-2">
            {canSubmitExpenses && isViewingActive && (
              <>
                <button onClick={() => { setIncForm({ amount: '', category: 'Tailgate', description: '', date: '' }); setIncError(null); setShowIncome(true) }} className="px-4 py-2 rounded-lg text-sm font-semibold border transition hover:bg-gray-50" style={{ borderColor: '#22c55e', color: '#15803d' }}>
                  + Record Income
                </button>
                <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#b08d4f', color: '#fff' }}>
                  + Add Expense
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button className="px-4 py-2 rounded-lg text-sm font-semibold border transition hover:bg-gray-50" style={{ borderColor: '#1b2640', color: '#1b2640' }}>
                  Send Dues Reminder
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-semibold border transition hover:bg-gray-50" style={{ borderColor: '#1b2640', color: '#1b2640' }}>
                  Generate Report
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#faf8f3' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Submitted By', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No expenses yet.</td></tr>
              )}
              {expenses.map((exp, i) => (
                <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(exp.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{exp.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.description}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{fmt(exp.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.submitted_by}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: statusStyles[exp.status]?.bg, color: statusStyles[exp.status]?.text }}>
                      {exp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 flex justify-end border-t border-gray-100">
          <button onClick={() => navigate('/expenses')} className="text-sm font-semibold transition hover:opacity-80" style={{ color: '#1b2640' }}>
            View All Expenses →
          </button>
        </div>
      </div>

      {/* Recent Income */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="gl-serif text-lg font-semibold text-gray-900">Recent Income</h2>
          <span className="text-sm text-gray-500">{fmt(stats.totalIncome)} collected{isViewingActive ? ' this semester' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#faf8f3' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Recorded By'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {income.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No income recorded yet.</td></tr>
              )}
              {income.map((inc, i) => (
                <tr key={inc.id} className="border-b border-gray-50 hover:bg-gray-50 transition" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(inc.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{inc.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inc.description}</td>
                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: '#15803d' }}>+{fmt(inc.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inc.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Income Modal */}
      {showIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="gl-serif text-xl font-semibold text-gray-900">Record Income</h3>
              <button onClick={() => setShowIncome(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {incError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fbeaea', color: '#9b2c2c' }}>{incError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-400">*</span></label>
                  <input type="number" placeholder="0.00" min="0" step="0.01" value={incForm.amount} onChange={(e) => setIncForm({ ...incForm, amount: e.target.value })} className="gl-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={incForm.date} onChange={(e) => setIncForm({ ...incForm, date: e.target.value })} className="gl-input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={incForm.category} onChange={(e) => setIncForm({ ...incForm, category: e.target.value })} className="gl-input">
                  {INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-400">*</span></label>
                <input type="text" placeholder="e.g. Homecoming tailgate door fees" value={incForm.description} onChange={(e) => setIncForm({ ...incForm, description: e.target.value })} className="gl-input" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowIncome(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
              <button onClick={handleIncomeSubmit} disabled={incSaving || !incForm.amount || !incForm.description.trim()} className="gl-btn-brass px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {incSaving && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                )}
                {incSaving ? 'Recording…' : 'Record Income'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="gl-serif text-xl font-semibold text-gray-900">Submit New Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['Social', 'Operations', 'Philanthropy', 'Housing'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
              <button onClick={handleSubmit} className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#1b2640', color: '#fff' }}>Submit Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
