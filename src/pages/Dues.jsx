import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSemester } from '../context/SemesterContext'
import Spinner from '../components/Spinner'

// ─── Constants ──────────────────────────────────────────────────────────────
const YEAR_TIERS    = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year', 'Officer']
const YEAR_OPTIONS  = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']
const OFFICER_ROLES = new Set(['President', 'VP Finance', 'Treasurer', 'Secretary', 'Social Chair'])
const BLANK_AMOUNTS = { Freshman: '', Sophomore: '', Junior: '', Senior: '', '5th Year': '', Officer: '' }

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtMoney(n) { return '$' + (n ?? 0).toFixed(2) }
function fmtAgo(ts) {
  if (!ts) return '—'
  const days = Math.floor((Date.now() - new Date(ts)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}
function statusBadge(s) {
  if (s === 'paid')    return { bg: '#dcfce7', text: '#15803d', label: 'Paid' }
  if (s === 'partial') return { bg: '#fef9c3', text: '#a16207', label: 'Partial' }
  return { bg: '#fee2e2', text: '#b91c1c', label: 'Pending' }
}
function getAmountForMember(member, form) {
  if (form.mode === 'manual') return parseFloat(form.memberAmounts[member.id] || 0)
  if (OFFICER_ROLES.has(member.role) && parseFloat(form.yearAmounts['Officer'] || 0) > 0)
    return parseFloat(form.yearAmounts['Officer'])
  return parseFloat(form.yearAmounts[member.year] || 0)
}
function statsFor(colId, allDues) {
  const dues      = allDues.filter(d => d.dues_collection_id === colId)
  const total     = dues.reduce((s, d) => s + (d.amount_owed || 0), 0)
  const collected = dues.filter(d => d.status === 'paid').reduce((s, d) => s + (d.amount_owed || 0), 0)
  const paidCount = dues.filter(d => d.status === 'paid').length
  return { total, collected, paidCount, totalCount: dues.length, pct: total > 0 ? Math.round(collected / total * 100) : 0 }
}

// ─── CollectionCard ──────────────────────────────────────────────────────────
function CollectionCard({ col, stats, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(col.id)}
      className="w-full text-left bg-white rounded-xl shadow-sm p-5 transition hover:shadow-md"
      style={{ border: `2px solid ${selected ? '#b08d4f' : '#e5e7eb'}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{col.name}</p>
        {col.status === 'closed'
          ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>Closed</span>
          : <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">Due {fmtDate(col.due_date)}</span>}
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{fmtMoney(stats.collected)} collected</span>
          <span>{fmtMoney(stats.total)} expected</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.pct, 100)}%`, backgroundColor: '#22c55e' }} />
        </div>
      </div>
      <p className="text-xs text-gray-500">{stats.paidCount} / {stats.totalCount} paid · {stats.pct}%</p>
    </button>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Dues() {
  const { chapterId, isAdmin, loading: authLoading } = useAuth()
  const { viewingSemesterId, isViewingActive } = useSemester()

  // Data
  const [collections, setCollections] = useState([])
  const [allDues, setAllDues]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [selectedId, setSelectedId]   = useState(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterYear, setFilterYear]     = useState('all')

  // Row action states
  const [markingId, setMarkingId]     = useState(null)
  const [remindingId, setRemindingId] = useState(null)
  const [sendingAll, setSendingAll]   = useState(false)
  const [closingId, setClosingId]     = useState(null)

  // Create modal
  const [showCreate, setShowCreate]         = useState(false)
  const [createStep, setCreateStep]         = useState('form')
  const [createMembers, setCreateMembers]   = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [form, setForm] = useState({
    name: '', dueDate: '', paymentLink: '',
    mode: 'year',
    yearAmounts: { ...BLANK_AMOUNTS },
    memberAmounts: {},
  })
  const [saving, setSaving]     = useState(false)
  const [createErr, setCreateErr] = useState(null)

  // Safety valve: only fire if still loading after 12s (see Dashboard note).
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      setLoading(false); setError(e => e ?? 'Loading timed out. Please refresh.')
    }, 12000)
    return () => clearTimeout(t)
  }, [loading])

  // ── Data loading ──
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      let colQ = supabase
        .from('dues_collections').select('*')
        .eq('chapter_id', chapterId).order('created_at', { ascending: false })
      if (viewingSemesterId) colQ = colQ.eq('semester_id', viewingSemesterId)
      const { data: cols, error: e1 } = await colQ
      if (e1) throw e1
      const cols_ = cols ?? []
      setCollections(cols_)

      if (cols_.length > 0) {
        const { data: dues, error: e2 } = await supabase
          .from('member_dues')
          .select('id, dues_collection_id, member_id, amount_owed, status, last_reminder_sent, member:members(id, full_name, year, role, email)')
          .in('dues_collection_id', cols_.map(c => c.id))
        if (e2) throw e2
        setAllDues(dues ?? [])
        setSelectedId(prev => prev ?? (cols_.find(c => c.status === 'active')?.id ?? cols_[0]?.id ?? null))
      } else {
        setAllDues([])
      }
    } catch (err) {
      setError(err?.message ?? 'Failed to load dues.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, viewingSemesterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  // ── Create collection ──
  async function openCreate() {
    setShowCreate(true); setCreateStep('form'); setCreateErr(null); setSaving(false)
    setForm({ name: '', dueDate: '', paymentLink: '', mode: 'year', yearAmounts: { ...BLANK_AMOUNTS }, memberAmounts: {} })
    setLoadingMembers(true)
    const { data } = await supabase
      .from('members').select('id, full_name, year, role')
      .eq('chapter_id', chapterId).order('full_name')
    const mems = data ?? []
    setCreateMembers(mems)
    const ma = {}; mems.forEach(m => { ma[m.id] = '' })
    setForm(prev => ({ ...prev, memberAmounts: ma }))
    setLoadingMembers(false)
  }

  async function saveCollection() {
    setSaving(true); setCreateErr(null)
    try {
      const { data: col, error: e1 } = await supabase
        .from('dues_collections')
        .insert({ chapter_id: chapterId, name: form.name.trim(), due_date: form.dueDate || null, payment_link: form.paymentLink.trim() || null, status: 'active' })
        .select().single()
      if (e1) throw e1

      if (form.mode === 'year') {
        const tiers = YEAR_TIERS
          .filter(t => parseFloat(form.yearAmounts[t] || 0) > 0)
          .map(t => ({ dues_collection_id: col.id, classification: t, amount: parseFloat(form.yearAmounts[t]) }))
        if (tiers.length > 0) { const { error: e2 } = await supabase.from('dues_tiers').insert(tiers); if (e2) throw e2 }
      }

      const rows = createMembers
        .map(m => ({ dues_collection_id: col.id, member_id: m.id, amount_owed: getAmountForMember(m, form), status: 'pending' }))
        .filter(r => r.amount_owed > 0)
      if (rows.length > 0) { const { error: e3 } = await supabase.from('member_dues').insert(rows); if (e3) throw e3 }

      setShowCreate(false)
      await load()
      setSelectedId(col.id)
    } catch (err) {
      setCreateErr(err?.message ?? 'Failed to create collection.')
    } finally {
      setSaving(false)
    }
  }

  // ── Row actions ──
  async function markPaid(dueId) {
    setMarkingId(dueId)
    const { error: err } = await supabase.from('member_dues').update({ status: 'paid' }).eq('id', dueId)
    if (!err) setAllDues(prev => prev.map(d => d.id === dueId ? { ...d, status: 'paid' } : d))
    setMarkingId(null)
  }

  async function sendReminder(due) {
    const col = collections.find(c => c.id === due.dues_collection_id)
    if (!col) return
    setRemindingId(due.id)
    const msg = `Hi ${due.member?.full_name ?? 'Member'}, you owe ${fmtMoney(due.amount_owed)} for ${col.name} (due ${fmtDate(col.due_date)}).${col.payment_link ? ' Pay at: ' + col.payment_link : ''}`
    await supabase.from('notifications').insert({ chapter_id: chapterId, type: 'dues', title: `Dues Reminder: ${col.name}`, message: msg, read: false })
    const now = new Date().toISOString()
    await supabase.from('member_dues').update({ last_reminder_sent: now }).eq('id', due.id)
    setAllDues(prev => prev.map(d => d.id === due.id ? { ...d, last_reminder_sent: now } : d))
    setRemindingId(null)
  }

  async function sendAllReminders() {
    const unpaid = filteredDues.filter(d => d.status !== 'paid')
    if (!unpaid.length) return
    setSendingAll(true)
    for (const due of unpaid) await sendReminder(due)
    setSendingAll(false)
  }

  async function closeCollection(colId) {
    if (!window.confirm('Close this collection? It will be marked as closed.')) return
    setClosingId(colId)
    const { error: err } = await supabase.from('dues_collections').update({ status: 'closed' }).eq('id', colId)
    if (!err) setCollections(prev => prev.map(c => c.id === colId ? { ...c, status: 'closed' } : c))
    setClosingId(null)
  }

  // ── Derived ──
  const selectedCollection = collections.find(c => c.id === selectedId) ?? null
  const selectedDues = allDues.filter(d => d.dues_collection_id === selectedId)
  const filteredDues = selectedDues.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (filterYear !== 'all' && d.member?.year !== filterYear) return false
    return true
  })
  const previewRows  = createMembers.map(m => ({ ...m, amount: getAmountForMember(m, form) }))
  const previewTotal = previewRows.reduce((s, r) => s + r.amount, 0)
  const activeCount  = collections.filter(c => c.status === 'active').length
  const canPreview   = form.name.trim() && (
    form.mode === 'year'
      ? YEAR_TIERS.some(t => parseFloat(form.yearAmounts[t] || 0) > 0)
      : Object.values(form.memberAmounts).some(v => parseFloat(v || 0) > 0)
  )
  const unpaidCount = filteredDues.filter(d => d.status !== 'paid').length

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none transition'
  const fs = { onFocus: (e) => { e.target.style.borderColor = '#1b2640' }, onBlur: (e) => { e.target.style.borderColor = '#e5e7eb' } }

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {activeCount > 0 ? `${activeCount} active collection${activeCount !== 1 ? 's' : ''}` : 'No active collections'}
        </p>
        {isAdmin && isViewingActive && (
          <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#b08d4f', color: '#fff' }}>
            + Create Dues Collection
          </button>
        )}
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f3f4f6' }}>
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="gl-serif text-lg font-semibold text-gray-900 mb-1">No dues collections yet</h3>
          <p className="text-sm text-gray-500">Create your first collection to start tracking member payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {collections.map(col => (
            <CollectionCard key={col.id} col={col} stats={statsFor(col.id, allDues)} selected={selectedId === col.id} onSelect={setSelectedId} />
          ))}
        </div>
      )}

      {/* Member dues table for selected collection */}
      {selectedCollection && (
        <div className="space-y-4">
          {/* Table header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="gl-serif text-lg font-semibold text-gray-900">{selectedCollection.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={selectedCollection.status === 'active' ? { backgroundColor: '#dcfce7', color: '#15803d' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                {selectedCollection.status === 'active' ? 'Active' : 'Closed'}
              </span>
              {selectedCollection.payment_link && (
                <a href={selectedCollection.payment_link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">
                  Payment Link ↗
                </a>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {selectedCollection.status === 'active' && (
                  <button onClick={() => closeCollection(selectedCollection.id)} disabled={closingId === selectedCollection.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                    {closingId === selectedCollection.id ? '…' : 'Close Collection'}
                  </button>
                )}
                <button onClick={sendAllReminders} disabled={sendingAll || unpaidCount === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: '#1b2640', color: '#fff' }}>
                  {sendingAll ? 'Sending…' : `Send All Reminders (${unpaidCount})`}
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" {...fs}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" {...fs}>
              <option value="all">All Years</option>
              {YEAR_OPTIONS.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {filteredDues.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No members match the current filters.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100" style={{ backgroundColor: '#faf8f3' }}>
                    {['Member', 'Year', 'Amount Owed', 'Status', 'Last Reminder', ...(isAdmin ? ['Actions'] : [])].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDues.map((d, i) => {
                    const badge = statusBadge(d.status)
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-gray-900">{d.member?.full_name ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{d.member?.year ?? '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-semibold text-gray-900">{fmtMoney(d.amount_owed)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.text }}>{badge.label}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{fmtAgo(d.last_reminder_sent)}</td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {d.status !== 'paid' && (
                                <button onClick={() => markPaid(d.id)} disabled={markingId === d.id}
                                  className="text-xs font-semibold transition hover:opacity-70 disabled:opacity-40"
                                  style={{ color: '#15803d' }}>
                                  {markingId === d.id ? '…' : 'Mark Paid'}
                                </button>
                              )}
                              <button onClick={() => sendReminder(d)} disabled={remindingId === d.id}
                                className="text-xs font-semibold transition hover:opacity-70 disabled:opacity-40"
                                style={{ color: '#1b2640' }}>
                                {remindingId === d.id ? '…' : 'Remind'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="gl-serif text-xl font-semibold text-gray-900">
                  {createStep === 'form' ? 'Create Dues Collection' : 'Preview & Confirm'}
                </h3>
                {createStep === 'preview' && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {previewRows.filter(r => r.amount > 0).length} members · {fmtMoney(previewTotal)} expected
                  </p>
                )}
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {createStep === 'form' ? (
                <div className="space-y-5">
                  {createErr && (
                    <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>{createErr}</p>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Collection Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder='e.g. "Fall 2026 Dues"' value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} {...fs} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <input type="date" value={form.dueDate}
                        onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className={inputCls} {...fs} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Link</label>
                      <input type="url" placeholder="https://venmo.com/…" value={form.paymentLink}
                        onChange={e => setForm(p => ({ ...p, paymentLink: e.target.value }))} className={inputCls} {...fs} />
                    </div>
                  </div>

                  {/* Mode toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount Setup</label>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200">
                      {[['year', 'Set by Class Year'], ['manual', 'Set Manually']].map(([m, label], i) => (
                        <button key={m} onClick={() => setForm(p => ({ ...p, mode: m }))}
                          className="flex-1 py-2 text-sm font-medium transition"
                          style={{
                            backgroundColor: form.mode === m ? '#1b2640' : '#fff',
                            color: form.mode === m ? '#fff' : '#6b7280',
                            borderRight: i === 0 ? '1px solid #e5e7eb' : 'none',
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* By Class Year */}
                  {form.mode === 'year' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">Leave blank to exclude that classification. Officers in leadership roles use the Officer rate if set.</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {YEAR_TIERS.map(tier => (
                          <div key={tier} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">{tier}</span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                              <input type="number" min="0" step="0.01" placeholder="0"
                                value={form.yearAmounts[tier]}
                                onChange={e => setForm(p => ({ ...p, yearAmounts: { ...p.yearAmounts, [tier]: e.target.value } }))}
                                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none transition" {...fs} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual */}
                  {form.mode === 'manual' && (
                    loadingMembers ? (
                      <div className="py-6"><Spinner /></div>
                    ) : createMembers.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No members found. Add members first.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr style={{ backgroundColor: '#faf8f3' }}>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Member</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Year</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {createMembers.map((m, i) => (
                              <tr key={m.id} className="border-t border-gray-100" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td className="px-4 py-2 text-sm text-gray-900">{m.full_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{m.year || '—'}</td>
                                <td className="px-4 py-2">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                                    <input type="number" min="0" step="0.01" placeholder="0"
                                      value={form.memberAmounts[m.id] ?? ''}
                                      onChange={e => setForm(p => ({ ...p, memberAmounts: { ...p.memberAmounts, [m.id]: e.target.value } }))}
                                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none text-right transition" {...fs} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Preview step */
                <div className="space-y-4">
                  {createErr && (
                    <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>{createErr}</p>
                  )}
                  <div className="p-4 rounded-lg space-y-2" style={{ backgroundColor: '#faf8f3' }}>
                    {[['Collection', form.name], ['Due Date', fmtDate(form.dueDate)], ['Payment Link', form.paymentLink || null]].filter(([, v]) => v && v !== '—').map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-semibold text-gray-900 truncate max-w-xs ml-4">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ backgroundColor: '#faf8f3' }}>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Member</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Year</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.filter(r => r.amount > 0).map((r, i) => (
                          <tr key={r.id} className="border-t border-gray-100" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td className="px-4 py-2 text-sm text-gray-900">{r.full_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{r.year || '—'}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{fmtMoney(r.amount)}</td>
                          </tr>
                        ))}
                        {previewRows.filter(r => r.amount > 0).length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-6 text-sm text-gray-400 text-center">No amounts set — go back and enter amounts.</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200" style={{ backgroundColor: '#faf8f3' }}>
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-900" colSpan={2}>
                            Total ({previewRows.filter(r => r.amount > 0).length} members)
                          </td>
                          <td className="px-4 py-2.5 text-sm font-bold text-right" style={{ color: '#1b2640' }}>{fmtMoney(previewTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              {createStep === 'form' ? (
                <>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
                  <button onClick={() => canPreview && setCreateStep('preview')} disabled={!canPreview || loadingMembers}
                    className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#1b2640', color: '#fff' }}>
                    Preview Summary →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setCreateStep('form')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">← Back</button>
                  <button onClick={saveCollection} disabled={saving || previewRows.filter(r => r.amount > 0).length === 0}
                    className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ backgroundColor: '#b08d4f', color: '#fff' }}>
                    {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
                    {saving ? 'Creating…' : 'Create Collection'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
