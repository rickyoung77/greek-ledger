import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const typeConfig = {
  approval:  { color: '#22c55e', bg: '#dcfce7', icon: '✓' },
  pending:   { color: '#eab308', bg: '#fef9c3', icon: '⏳' },
  dues:      { color: '#3b82f6', bg: '#eff6ff', icon: '$' },
  budget:    { color: '#f97316', bg: '#fff7ed', icon: '!' },
  rejection: { color: '#ef4444', bg: '#fee2e2', icon: '✕' },
  report:    { color: '#8b5cf6', bg: '#f5f3ff', icon: '📄' },
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Notifications() {
  const { chapterId, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

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
        .from('notifications').select('*').eq('chapter_id', chapterId).order('created_at', { ascending: false })
      if (err) throw err
      setNotifications(data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    if (chapterId) load()
    else if (!authLoading) setLoading(false)
  }, [chapterId, authLoading, load])

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!unreadIds.length) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
        </p>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-sm font-semibold transition hover:opacity-70 disabled:opacity-40"
          style={{ color: '#1b2640' }}
        >
          Mark all as read
        </button>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">No notifications yet.</p>
        )}
        {notifications.map((n) => {
          const cfg = typeConfig[n.type] ?? typeConfig.pending
          return (
            <div
              key={n.id}
              className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 transition hover:shadow-md"
              style={{ borderLeft: n.read ? '4px solid #e5e7eb' : `4px solid ${cfg.color}` }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <p className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {n.title}
                    {!n.read && <span className="ml-2 inline-block w-2 h-2 rounded-full align-middle" style={{ backgroundColor: cfg.color }} />}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{relativeTime(n.created_at)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
