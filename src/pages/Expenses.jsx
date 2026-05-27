import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const statusStyles = {
  Approved: { bg: '#dcfce7', text: '#15803d' },
  Pending:  { bg: '#fef9c3', text: '#a16207' },
  Rejected: { bg: '#fee2e2', text: '#b91c1c' },
}
const fmt     = (n) => `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const CATEGORY_OPTIONS = ['All Categories', 'Social', 'Operations', 'Philanthropy', 'Housing']
const STATUS_OPTIONS   = ['All Statuses', 'Approved', 'Pending', 'Rejected']

export default function Expenses() {
  const { chapterId, fullName, loading: authLoading } = useAuth()

  const [expenses, setExpenses]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [savingId, setSavingId]   = useState(null)

  const [category, setCategory]   = useState('All Categories')
  const [status, setStatus]       = useState('All Statuses')
  const [member, setMember]       = useState('All Members')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ amount: '', category: 'Social', description: '', date: '' })

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
      const { data, error: err } = await Promise.race([
        supabase.from('expenses').select('*').eq('chapter_id', chapterId).order('date', { ascending: false }),
        timeout,
      ])
      if (err) throw err
      setExpenses(data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load expenses.')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id, next) {
    setSavingId(id)
    const { error: err } = await supabase.from('expenses').update({ status: next }).eq('id', id)
    if (!err) setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status: next } : e)))
    setSavingId(null)
  }

  async function handleSubmit() {
    const { data, error: err } = await supabase.from('expenses').insert({
      chapter_id:   chapterId,
      description:  form.description,
      amount:       parseFloat(form.amount) || 0,
      category:     form.category,
      submitted_by: fullName || 'Unknown',
      status:       'Pending',
      date:         form.date || new Date().toISOString().slice(0, 10),
    }).select().single()

    if (!err && data) {
      setExpenses((prev) => [data, ...prev])
      setShowModal(false)
      setForm({ amount: '', category: 'Social', description: '', date: '' })
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
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
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
          <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>+ Submit Expense</button>
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
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#f8f9fa' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Submitted By', 'Status', 'Actions'].map((h) => (
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
                    {exp.status === 'Pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateStatus(exp.id, 'Approved')} disabled={savingId === exp.id} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                          {savingId === exp.id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => updateStatus(exp.id, 'Rejected')} disabled={savingId === exp.id} className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                          {savingId === exp.id ? '…' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">No expenses match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Submit New Expense</h3>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition">
                  <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm text-gray-400">Click to upload or drag and drop</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Cancel</button>
              <button onClick={handleSubmit} className="px-5 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#1e2a4a', color: '#fff' }}>Submit Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
