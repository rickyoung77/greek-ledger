import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']

const duesStyle = {
  Paid:    { bg: '#dcfce7', text: '#15803d' },
  Pending: { bg: '#fef9c3', text: '#a16207' },
}

function initials(name) {
  const parts = (name ?? '').trim().split(' ')
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

export default function Members() {
  const { chapterId, loading: authLoading } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

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
        supabase.from('members').select('*').eq('chapter_id', chapterId).order('role'),
        timeout,
      ])
      if (err) throw err
      setMembers(data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load members.')
    } finally {
      setLoading(false)
    }
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
        <button className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#c9a84c', color: '#1e2a4a' }}>
          + Add Member
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No members yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#f8f9fa' }}>
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
                    <td className="px-6 py-4 text-sm text-gray-600">{m.year}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{m.email ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: duesStyle[m.dues_status]?.bg, color: duesStyle[m.dues_status]?.text }}>
                        {m.dues_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-sm font-medium transition hover:opacity-70" style={{ color: '#1e2a4a' }}>View Profile</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
