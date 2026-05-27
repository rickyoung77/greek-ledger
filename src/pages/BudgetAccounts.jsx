import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const COLOR_BG = {
  '#3b82f6': '#eff6ff',
  '#f97316': '#fff7ed',
  '#22c55e': '#f0fdf4',
  '#8b5cf6': '#f5f3ff',
}

function ProgressBar({ pct, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

export default function BudgetAccounts() {
  const { chapterId, loading: authLoading } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading])

  async function load() {
    setLoading(true)
    setError(null)
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please refresh.')), 5000)
    )
    try {
      const [
        { data: acctRows, error: e1 },
        { data: expRows,  error: e2 },
      ] = await Promise.race([
        Promise.all([
          supabase.from('budget_accounts').select('*').eq('chapter_id', chapterId).order('created_at'),
          supabase.from('expenses').select('id, budget_account_id, amount, status').eq('chapter_id', chapterId),
        ]),
        timeout,
      ])
      if (e1 || e2) throw e1 || e2

      const spentMap = {}
      ;(expRows ?? []).filter((e) => e.status !== 'Rejected').forEach((e) => {
        if (e.budget_account_id) {
          spentMap[e.budget_account_id] = (spentMap[e.budget_account_id] || 0) + Number(e.amount)
        }
      })

      const topLevel = (acctRows ?? []).filter((a) => !a.parent_id)
      const subLevel = (acctRows ?? []).filter((a) => a.parent_id)

      const structured = topLevel.map((top) => ({
        ...top,
        bg: COLOR_BG[top.color] ?? '#f8f9fa',
        subAccounts: subLevel
          .filter((s) => s.parent_id === top.id)
          .map((s) => ({ ...s, spent: spentMap[s.id] || 0 })),
      }))

      setAccounts(structured)
      const init = {}
      structured.forEach((a) => { init[a.id] = true })
      setExpanded(init)
    } catch (err) {
      setError(err?.message ?? 'Failed to load budget accounts.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Manage chapter budget accounts and sub-categories</p>
        <button className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
          + Create Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">No budget accounts yet. Create your first one to get started.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {accounts.map((acc) => {
              const spent = acc.subAccounts.reduce((s, a) => s + a.spent, 0)
              const pct   = acc.total_budget > 0 ? Math.min(Math.round((spent / acc.total_budget) * 100), 100) : 0
              return (
                <div key={acc.id} className="bg-white rounded-xl shadow-sm p-4" style={{ borderLeft: `4px solid ${acc.color}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: acc.color }}>{acc.name}</p>
                  <p className="text-2xl font-bold text-gray-900">${spent.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mb-2">of ${Number(acc.total_budget).toLocaleString()}</p>
                  <ProgressBar pct={pct} color={acc.color} />
                  <p className="text-xs text-gray-400 mt-1">{pct}% used</p>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            {accounts.map((acc) => {
              const totalSpent = acc.subAccounts.reduce((s, a) => s + a.spent, 0)
              const remaining  = Number(acc.total_budget) - totalSpent
              const pct        = acc.total_budget > 0 ? Math.min(Math.round((totalSpent / acc.total_budget) * 100), 100) : 0
              const isOpen     = expanded[acc.id]

              return (
                <div key={acc.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button onClick={() => toggle(acc.id)} className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition text-left">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold" style={{ backgroundColor: acc.bg, color: acc.color }}>
                        {acc.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-900">{acc.name}</p>
                        <p className="text-sm text-gray-500">${totalSpent.toLocaleString()} spent · ${remaining.toLocaleString()} remaining</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0 ml-6">
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{pct}%</span>
                          <span>${Number(acc.total_budget).toLocaleString()}</span>
                        </div>
                        <ProgressBar pct={pct} color={acc.color} />
                      </div>
                      <svg className="w-5 h-5 text-gray-400 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      <div className="px-6 py-2 grid grid-cols-3 gap-x-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <span>Sub-Account</span>
                        <span className="text-right">Spent / Budget</span>
                        <span className="text-right">Progress</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {acc.subAccounts.map((sub) => {
                          const subPct = sub.total_budget > 0 ? Math.min(Math.round((sub.spent / sub.total_budget) * 100), 100) : 0
                          return (
                            <div key={sub.id} className="px-6 py-3 grid grid-cols-3 gap-x-4 items-center hover:bg-gray-50 transition">
                              <span className="text-sm font-medium text-gray-700">{sub.name}</span>
                              <span className="text-sm text-gray-500 text-right">
                                ${sub.spent.toLocaleString()}<span className="text-gray-300"> / </span>${Number(sub.total_budget).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-3 justify-end">
                                <div className="w-24"><ProgressBar pct={subPct} color={acc.color} /></div>
                                <span className="text-xs font-semibold w-8 text-right" style={{ color: acc.color }}>{subPct}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                        <button className="text-sm font-semibold transition hover:opacity-80" style={{ color: acc.color }}>+ Add Sub-Account</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
