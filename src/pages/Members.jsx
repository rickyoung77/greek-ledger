import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']
const ROLES = ['President', 'VP Finance', 'Treasurer', 'Secretary', 'Social Chair', 'Member']
const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']

const duesStyle = {
  Paid:    { bg: '#dcfce7', text: '#15803d' },
  Pending: { bg: '#fef9c3', text: '#a16207' },
}

function initials(name) {
  const parts = (name ?? '').trim().split(' ')
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

const BLANK = { full_name: '', email: '', role: 'Member', year: 'Junior' }

function Modal({ title, onClose, onSave, saving, error, disabled, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="gl-serif text-xl font-semibold text-gray-900">{title}</h3>
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
            style={{ backgroundColor: '#1b2640', color: '#fff' }}
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

export default function Members() {
  const { chapterId, loading: authLoading } = useAuth()
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState(BLANK)
  const [saving, setSaving]         = useState(false)
  const [modalError, setModalError] = useState(null)
  const [togglingId, setTogglingId]     = useState(null)
  const [removingId, setRemovingId]     = useState(null)
  const [editingYearId, setEditingYearId] = useState(null)

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
      const { data, error: err } = await supabase
        .from('members').select('*').eq('chapter_id', chapterId).order('role')
      if (err) throw err
      setMembers(data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load members.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  function openModal() {
    setForm(BLANK)
    setModalError(null)
    setShowModal(true)
  }

  async function addMember() {
    if (!form.full_name.trim()) { setModalError('Full name is required.'); return }
    setSaving(true)
    setModalError(null)
    try {
      const { data, error: err } = await supabase.from('members').insert({
        chapter_id:  chapterId,
        full_name:   form.full_name.trim(),
        email:       form.email.trim() || null,
        role:        form.role,
        year:        form.year,
        dues_status: 'Pending',
      }).select().single()
      if (err) throw err
      setMembers((prev) => [...prev, data].sort((a, b) => a.role.localeCompare(b.role)))
      setShowModal(false)
    } catch (err) {
      setModalError(err?.message ?? 'Failed to add member.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleDues(id, current) {
    setTogglingId(id)
    const next = current === 'Paid' ? 'Pending' : 'Paid'
    const { error: err } = await supabase.from('members').update({ dues_status: next }).eq('id', id)
    if (!err) setMembers((prev) => prev.map((m) => m.id === id ? { ...m, dues_status: next } : m))
    setTogglingId(null)
  }

  async function updateYear(id, year) {
    setEditingYearId(null)
    const { error: err } = await supabase.from('members').update({ year }).eq('id', id)
    if (!err) setMembers((prev) => prev.map((m) => m.id === id ? { ...m, year } : m))
  }

  async function removeMember(id) {
    if (!window.confirm('Remove this member from the chapter?')) return
    setRemovingId(id)
    const { error: err } = await supabase.from('members').delete().eq('id', id)
    if (!err) setMembers((prev) => prev.filter((m) => m.id !== id))
    setRemovingId(null)
  }

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  const paidCount = members.filter((m) => m.dues_status === 'Paid').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {members.length} member{members.length !== 1 ? 's' : ''} · {paidCount} dues paid
        </p>
        <button
          onClick={openModal}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90"
          style={{ backgroundColor: '#b08d4f', color: '#fff' }}
        >
          + Add Member
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No members yet. Add your first member above.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#faf8f3' }}>
                {['Member', 'Role', 'Year', 'Email', 'Dues Status', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition" style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white" style={{ backgroundColor: color }}>
                          {initials(m.full_name)}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{m.role}</td>
                    <td className="px-6 py-4 text-sm">
                      {editingYearId === m.id ? (
                        <select
                          autoFocus
                          defaultValue={m.year}
                          onChange={(e) => updateYear(m.id, e.target.value)}
                          onBlur={() => setEditingYearId(null)}
                          className="border rounded px-2 py-1 text-sm focus:outline-none"
                          style={{ borderColor: '#1b2640' }}
                        >
                          {YEARS.map((y) => <option key={y}>{y}</option>)}
                        </select>
                      ) : (
                        <span
                          onClick={() => setEditingYearId(m.id)}
                          className="text-gray-600 cursor-pointer hover:text-blue-600 hover:underline transition"
                          title="Click to edit year"
                        >
                          {m.year || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{m.email ?? '—'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleDues(m.id, m.dues_status)}
                        disabled={togglingId === m.id}
                        title="Click to toggle"
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition hover:opacity-70 disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: duesStyle[m.dues_status]?.bg, color: duesStyle[m.dues_status]?.text }}
                      >
                        {togglingId === m.id ? '…' : m.dues_status}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => removeMember(m.id)}
                          disabled={removingId === m.id}
                          className="text-sm font-medium transition hover:opacity-70 disabled:opacity-40"
                          style={{ color: '#ef4444' }}
                        >
                          {removingId === m.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          title="Add Member"
          onClose={() => setShowModal(false)}
          onSave={addMember}
          saving={saving}
          error={modalError}
          disabled={!form.full_name.trim()}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
