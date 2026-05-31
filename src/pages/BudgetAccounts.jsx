import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const COLOR_OPTIONS = [
  { hex: '#3b82f6', bg: '#eff6ff', label: 'Blue'   },
  { hex: '#f97316', bg: '#fff7ed', label: 'Orange' },
  { hex: '#22c55e', bg: '#f0fdf4', label: 'Green'  },
  { hex: '#8b5cf6', bg: '#f5f3ff', label: 'Purple' },
  { hex: '#ec4899', bg: '#fdf2f8', label: 'Pink'   },
  { hex: '#14b8a6', bg: '#f0fdfa', label: 'Teal'   },
]

const COLOR_BG = Object.fromEntries(COLOR_OPTIONS.map((c) => [c.hex, c.bg]))

function ProgressBar({ pct, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

function ModalShell({ title, onClose, onSave, saving, error, disabled, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>{error}</p>
          )}
          {children}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving || disabled}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: '#1e2a4a', color: '#fff' }}
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BudgetAccounts() {
  const { chapterId, loading: authLoading } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [showCreate, setShowCreate]     = useState(false)
  const [createForm, setCreateForm]     = useState({ name: '', total_budget: '', color: '#3b82f6' })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError]   = useState(null)

  const [showSub, setShowSub]           = useState(false)
  const [subParent, setSubParent]       = useState(null)
  const [subForm, setSubForm]           = useState({ name: '', total_budget: '' })
  const [subSaving, setSubSaving]       = useState(false)
  const [subError, setSubError]         = useState(null)

  const [showEdit, setShowEdit]         = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [editForm, setEditForm]         = useState({ name: '', total_budget: '' })
  const [editSaving, setEditSaving]     = useState(false)
  const [editError, setEditError]       = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  const activeRef = useRef(true)

  // Safety valve: clear loading after 8s to prevent infinite spinner
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeRef.current) {
        setLoading(false)
        setError((prev) => prev ?? 'Loading timed out. Please refresh the page.')
      }
    }, 3000)
    return () => { activeRef.current = false; clearTimeout(timer) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: acctRows, error: e1 },
        { data: expRows,  error: e2 },
      ] = await Promise.all([
        supabase.from('budget_accounts').select('*').eq('chapter_id', chapterId).order('created_at'),
        supabase.from('expenses').select('id, budget_account_id, amount, status').eq('chapter_id', chapterId),
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
      setExpanded((prev) => {
        const next = { ...prev }
        structured.forEach((a) => { if (!(a.id in next)) next[a.id] = true })
        return next
      })
    } catch (err) {
      setError(err?.message ?? 'Failed to load budget accounts.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  function openCreate() {
    setCreateForm({ name: '', total_budget: '', color: '#3b82f6' })
    setCreateError(null)
    setShowCreate(true)
  }

  async function createAccount() {
    if (!createForm.name.trim()) { setCreateError('Account name is required.'); return }
    if (!createForm.total_budget || isNaN(Number(createForm.total_budget))) { setCreateError('Enter a valid budget amount.'); return }
    setCreateSaving(true)
    setCreateError(null)
    try {
      const { error: err } = await supabase.from('budget_accounts').insert({
        chapter_id:   chapterId,
        name:         createForm.name.trim(),
        total_budget: parseFloat(createForm.total_budget),
        color:        createForm.color,
        parent_id:    null,
      })
      if (err) throw err
      setShowCreate(false)
      await load()
    } catch (err) {
      setCreateError(err?.message ?? 'Failed to create account.')
    } finally {
      setCreateSaving(false)
    }
  }

  function openSub(parent) {
    setSubParent(parent)
    setSubForm({ name: '', total_budget: '' })
    setSubError(null)
    setShowSub(true)
  }

  async function addSubAccount() {
    if (!subForm.name.trim()) { setSubError('Sub-account name is required.'); return }
    if (!subForm.total_budget || isNaN(Number(subForm.total_budget))) { setSubError('Enter a valid budget amount.'); return }
    setSubSaving(true)
    setSubError(null)
    try {
      const { error: err } = await supabase.from('budget_accounts').insert({
        chapter_id:   chapterId,
        name:         subForm.name.trim(),
        total_budget: parseFloat(subForm.total_budget),
        color:        subParent.color,
        parent_id:    subParent.id,
      })
      if (err) throw err
      setShowSub(false)
      await load()
    } catch (err) {
      setSubError(err?.message ?? 'Failed to add sub-account.')
    } finally {
      setSubSaving(false)
    }
  }

  function openEdit(sub) {
    setEditTarget(sub)
    setEditForm({ name: sub.name, total_budget: String(sub.total_budget) })
    setEditError(null)
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) { setEditError('Name is required.'); return }
    if (!editForm.total_budget || isNaN(Number(editForm.total_budget))) { setEditError('Enter a valid budget amount.'); return }
    setEditSaving(true)
    setEditError(null)
    try {
      const { error: err } = await supabase.from('budget_accounts').update({
        name:         editForm.name.trim(),
        total_budget: parseFloat(editForm.total_budget),
      }).eq('id', editTarget.id)
      if (err) throw err
      setShowEdit(false)
      await load()
    } catch (err) {
      setEditError(err?.message ?? 'Failed to update sub-account.')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteSubAccount(id) {
    if (!window.confirm('Delete this sub-account? Linked expenses will be unlinked.')) return
    setDeletingId(id)
    const { error: err } = await supabase.from('budget_accounts').delete().eq('id', id)
    if (!err) {
      setAccounts((prev) => prev.map((a) => ({ ...a, subAccounts: a.subAccounts.filter((s) => s.id !== id) })))
    }
    setDeletingId(null)
  }

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Manage chapter budget accounts and sub-categories</p>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
          + Create Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">No budget accounts yet. Create your first one above.</p>
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
                      <div className="px-6 py-2 grid grid-cols-4 gap-x-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <span className="col-span-2">Sub-Account</span>
                        <span className="text-right">Spent / Budget</span>
                        <span className="text-right">Actions</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {acc.subAccounts.length === 0 && (
                          <p className="px-6 py-4 text-sm text-gray-400">No sub-accounts yet.</p>
                        )}
                        {acc.subAccounts.map((sub) => {
                          const subPct = sub.total_budget > 0 ? Math.min(Math.round((sub.spent / sub.total_budget) * 100), 100) : 0
                          return (
                            <div key={sub.id} className="px-6 py-3 grid grid-cols-4 gap-x-4 items-center hover:bg-gray-50 transition">
                              <div className="col-span-2">
                                <p className="text-sm font-medium text-gray-700">{sub.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-24"><ProgressBar pct={subPct} color={acc.color} /></div>
                                  <span className="text-xs font-semibold" style={{ color: acc.color }}>{subPct}%</span>
                                </div>
                              </div>
                              <span className="text-sm text-gray-500 text-right">
                                ${sub.spent.toLocaleString()}<span className="text-gray-300"> / </span>${Number(sub.total_budget).toLocaleString()}
                              </span>
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => openEdit(sub)} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                                  Edit
                                </button>
                                <button onClick={() => deleteSubAccount(sub.id)} disabled={deletingId === sub.id} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                                  {deletingId === sub.id ? '…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                        <button onClick={() => openSub(acc)} className="text-sm font-semibold transition hover:opacity-80" style={{ color: acc.color }}>
                          + Add Sub-Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {showCreate && (
        <ModalShell title="Create Budget Account" onClose={() => setShowCreate(false)} onSave={createAccount} saving={createSaving} error={createError} disabled={!createForm.name.trim() || !createForm.total_budget}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Social Events" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Budget <span className="text-red-400">*</span></label>
            <input type="number" placeholder="5000" min="0" step="0.01" value={createForm.total_budget} onChange={(e) => setCreateForm({ ...createForm, total_budget: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c.hex} type="button" onClick={() => setCreateForm({ ...createForm, color: c.hex })} className="w-8 h-8 rounded-full transition-transform hover:scale-110" style={{ backgroundColor: c.hex, boxShadow: createForm.color === c.hex ? `0 0 0 3px white, 0 0 0 5px ${c.hex}` : 'none' }} title={c.label} />
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {showSub && subParent && (
        <ModalShell title={`Add Sub-Account to ${subParent.name}`} onClose={() => setShowSub(false)} onSave={addSubAccount} saving={subSaving} error={subError} disabled={!subForm.name.trim() || !subForm.total_budget}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Account Name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Mixers" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget <span className="text-red-400">*</span></label>
            <input type="number" placeholder="1000" min="0" step="0.01" value={subForm.total_budget} onChange={(e) => setSubForm({ ...subForm, total_budget: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </ModalShell>
      )}

      {showEdit && editTarget && (
        <ModalShell title="Edit Sub-Account" onClose={() => setShowEdit(false)} onSave={saveEdit} saving={editSaving} error={editError} disabled={!editForm.name.trim() || !editForm.total_budget}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Account Name <span className="text-red-400">*</span></label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget <span className="text-red-400">*</span></label>
            <input type="number" min="0" step="0.01" value={editForm.total_budget} onChange={(e) => setEditForm({ ...editForm, total_budget: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </ModalShell>
      )}
    </div>
  )
}
