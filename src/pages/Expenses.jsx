import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import InvoiceUpload from '../components/InvoiceUpload'

const statusStyles = {
  Approved: { bg: '#dcfce7', text: '#15803d' },
  Pending:  { bg: '#fef9c3', text: '#a16207' },
  Rejected: { bg: '#fee2e2', text: '#b91c1c' },
}
const fmt     = (n) => `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const CATEGORY_OPTIONS = ['All Categories', 'Social', 'Operations', 'Philanthropy', 'Housing']
const STATUS_OPTIONS   = ['All Statuses', 'Approved', 'Pending', 'Rejected']
const BLANK_FORM = { amount: '', budget_account_id: '', category: '', description: '', date: '', submitted_by: '' }

export default function Expenses() {
  const { chapterId, fullName, isAdmin, canSubmitExpenses, loading: authLoading } = useAuth()

  const [expenses, setExpenses]   = useState([])
  const [accounts, setAccounts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [savingId, setSavingId]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [category, setCategory]   = useState('All Categories')
  const [status, setStatus]       = useState('All Statuses')
  const [member, setMember]       = useState('All Members')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(BLANK_FORM)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError]   = useState(null)
  const [receiptFile, setReceiptFile] = useState(null) // uploaded invoice file to archive
  const [viewingId, setViewingId]     = useState(null)  // expense whose receipt is being opened

  const activeRef = useRef(true)

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
      const [expResult, acctResult] = await Promise.all([
        supabase.from('expenses').select('*').eq('chapter_id', chapterId).order('date', { ascending: false }),
        supabase.from('budget_accounts').select('id, name, color').eq('chapter_id', chapterId).order('name'),
      ])
      if (expResult.error) throw expResult.error
      if (acctResult.error) throw acctResult.error
      setExpenses(expResult.data ?? [])
      setAccounts(acctResult.data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load expenses.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  async function updateStatus(id, next) {
    setSavingId(id)
    const { error: err } = await supabase.from('expenses').update({ status: next }).eq('id', id)
    if (!err) setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status: next } : e)))
    setSavingId(null)
  }

  async function deleteExpense(id) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    setDeletingId(id)
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (!err) setExpenses((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  function openModal() {
    setForm({ ...BLANK_FORM, submitted_by: fullName || '' })
    setModalError(null)
    setReceiptFile(null)
    setShowModal(true)
  }

  // Map Claude's parsed invoice fields onto the form. If the parsed category
  // matches one of this chapter's budget accounts by name, pre-select it.
  // Also keep the uploaded file so it can be archived on submit.
  function applyParsedInvoice(fields, file) {
    if (file) setReceiptFile(file)
    if (!fields) return
    const desc = fields.vendor
      ? `${fields.vendor}${fields.invoice_number ? ` — Invoice ${fields.invoice_number}` : ''}`
      : (fields.line_items?.[0]?.description ?? '')
    const matchAcct = fields.category
      ? accounts.find((a) => a.name.toLowerCase() === String(fields.category).toLowerCase())
      : null
    setModalError(null)
    setForm((prev) => ({
      ...prev,
      amount:            fields.amount != null ? String(fields.amount) : prev.amount,
      date:              fields.date || prev.date,
      description:       desc || prev.description,
      category:          fields.category || prev.category,
      budget_account_id: matchAcct ? matchAcct.id : prev.budget_account_id,
    }))
  }

  async function handleSubmit() {
    if (!form.amount || !form.description.trim()) {
      setModalError('Amount and description are required.')
      return
    }
    setModalSaving(true)
    setModalError(null)
    const selectedAccount = accounts.find((a) => a.id === form.budget_account_id)
    try {
      const { data, error: err } = await supabase.from('expenses').insert({
        chapter_id:        chapterId,
        description:       form.description.trim(),
        amount:            parseFloat(form.amount) || 0,
        category:          selectedAccount ? selectedAccount.name : (form.category || 'Uncategorized'),
        budget_account_id: selectedAccount ? selectedAccount.id : null,
        submitted_by:      form.submitted_by.trim() || fullName || 'Unknown',
        status:            'Pending',
        date:              form.date || new Date().toISOString().slice(0, 10),
      }).select().single()
      if (err) throw err

      // Archive the uploaded invoice file (if any) to the private receipts
      // bucket, then link it on the expense row. A failed upload doesn't lose
      // the expense — it's already saved; we just note the receipt is missing.
      let saved = data
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        const path = `${chapterId}/${data.id}/invoice.${ext}`
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, receiptFile, { contentType: receiptFile.type, upsert: true })
        if (upErr) {
          setModalError('Expense saved, but the receipt upload failed. You can re-attach it later.')
        } else {
          const { data: updated } = await supabase
            .from('expenses').update({ receipt_path: path }).eq('id', data.id).select().single()
          if (updated) saved = updated
        }
      }

      setExpenses((prev) => [saved, ...prev])
      setReceiptFile(null)
      if (!receiptFile || saved.receipt_path) setShowModal(false)
    } catch (err) {
      setModalError(err?.message ?? 'Failed to submit expense.')
    } finally {
      setModalSaving(false)
    }
  }

  // Open a receipt via a short-lived signed URL (bucket is private).
  async function viewReceipt(exp) {
    if (!exp.receipt_path) return
    setViewingId(exp.id)
    try {
      const { data, error: err } = await supabase.storage
        .from('receipts').createSignedUrl(exp.receipt_path, 60)
      if (err || !data?.signedUrl) throw err || new Error('No URL')
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch {
      setError('Could not open the receipt.')
    } finally {
      setViewingId(null)
    }
  }

  const memberOptions = useMemo(() => {
    const names = [...new Set(expenses.map((e) => e.submitted_by))].sort()
    return ['All Members', ...names]
  }, [expenses])

  const filtered = expenses.filter((e) => {
    if (category !== 'All Categories' && e.category    !== category) return false
    if (status   !== 'All Statuses'   && e.status      !== status)   return false
    if (member   !== 'All Members'    && e.submitted_by !== member)  return false
    if (dateFrom && e.date < dateFrom) return false
    if (dateTo   && e.date > dateTo)   return false
    return true
  })

  const totalSpent    = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const pendingCount  = expenses.filter((e) => e.status === 'Pending').length
  const totalApproved = expenses.filter((e) => e.status === 'Approved').reduce((s, e) => s + Number(e.amount), 0)

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Total Expenses This Semester', value: fmt(totalSpent),    color: '#3b82f6' },
          { label: 'Pending Approval',             value: pendingCount,       color: '#eab308' },
          { label: 'Total Approved',               value: fmt(totalApproved), color: '#22c55e' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-2 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="gl-serif text-3xl font-semibold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        {[
          { value: category, onChange: setCategory, options: CATEGORY_OPTIONS },
          { value: status,   onChange: setStatus,   options: STATUS_OPTIONS },
          { value: member,   onChange: setMember,   options: memberOptions },
        ].map((sel, i) => (
          <select key={i} value={sel.value} onChange={(e) => sel.onChange(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            {sel.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setCategory('All Categories'); setStatus('All Statuses'); setMember('All Members'); setDateFrom(''); setDateTo('') }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Clear</button>
          {canSubmitExpenses && (
            <button onClick={openModal} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#b08d4f', color: '#fff' }}>+ Submit Expense</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <span className="text-sm text-gray-500">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#faf8f3' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Submitted By', 'Status', 'Receipt', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp, i) => (
                <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtDate(exp.date)}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-800">{exp.category}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 max-w-xs truncate">{exp.description}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{fmt(exp.amount)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{exp.submitted_by}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: statusStyles[exp.status]?.bg, color: statusStyles[exp.status]?.text }}>
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {exp.receipt_path ? (
                      <button
                        onClick={() => viewReceipt(exp)}
                        disabled={viewingId === exp.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold transition hover:opacity-70 disabled:opacity-50"
                        style={{ color: '#b08d4f' }}
                        title="View archived invoice"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {viewingId === exp.id ? '…' : 'View'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        {exp.status === 'Pending' && (
                          <>
                            <button onClick={() => updateStatus(exp.id, 'Approved')} disabled={savingId === exp.id} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                              {savingId === exp.id ? '…' : 'Approve'}
                            </button>
                            <button onClick={() => updateStatus(exp.id, 'Rejected')} disabled={savingId === exp.id} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                              {savingId === exp.id ? '…' : 'Reject'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          disabled={deletingId === exp.id}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
                          style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                        >
                          {deletingId === exp.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400">No expenses match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="gl-serif text-xl font-semibold text-gray-900">Submit Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {modalError && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>{modalError}</p>
              )}

              <InvoiceUpload onParsed={applyParsedInvoice} />
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: '#e9e2d3' }} />
                <span className="text-xs" style={{ color: '#a99f8b' }}>or enter manually</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#e9e2d3' }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Account</label>
                <select
                  value={form.budget_account_id}
                  onChange={(e) => setForm({ ...form, budget_account_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Uncategorized —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Brief description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submitted By</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.submitted_by}
                  onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={modalSaving || !form.amount || !form.description.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#1b2640', color: '#fff' }}
              >
                {modalSaving && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {modalSaving ? 'Submitting…' : 'Submit Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
