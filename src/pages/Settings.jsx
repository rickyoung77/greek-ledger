import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { chapterId, chapterName, semester, joinCode: initialCode, isAdmin, userRole, refreshProfile } = useAuth()
  const [code, setCode]           = useState(initialCode)
  const [copied, setCopied]       = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError]     = useState(null)

  useEffect(() => { setCode(initialCode) }, [initialCode])

  async function handleRegenerate() {
    if (!window.confirm('Regenerate the join code? The old code will stop working immediately.')) return
    setRegenerating(true)
    setRegenError(null)
    try {
      const { data, error } = await supabase.rpc('regenerate_join_code', { chapter_uuid: chapterId })
      if (error) throw error
      setCode(data)
      await refreshProfile()
    } catch (err) {
      setRegenError(err?.message ?? 'Failed to regenerate code.')
    } finally {
      setRegenerating(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Join code — admin only */}
      {isAdmin ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Chapter Join Code</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Share this code with members so they can sign up and join your chapter automatically.
            </p>
          </div>
          <div className="px-6 py-6">
            {regenError && (
              <p className="text-sm px-3 py-2 rounded-lg mb-4" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>{regenError}</p>
            )}

            <div className="flex items-center gap-5">
              <div className="flex-1 rounded-xl border-2 px-6 py-5 text-center" style={{ borderColor: '#e5e7eb', backgroundColor: '#f8f9fa' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Join Code</p>
                <p className="font-mono font-bold text-gray-900" style={{ fontSize: '2.5rem', letterSpacing: '0.3em' }}>
                  {code || '——'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 whitespace-nowrap"
                  style={{
                    backgroundColor: copied ? '#dcfce7' : '#f3f4f6',
                    color: copied ? '#15803d' : '#374151',
                  }}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Code
                    </>
                  )}
                </button>

                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                >
                  {regenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Regenerating…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-lg" style={{ backgroundColor: '#fffbeb', borderLeft: '3px solid #c9a84c' }}>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">How it works:</span> Members go to the signup page, choose "Join a Chapter", and enter this code. They'll be added to your chapter immediately.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f3f4f6' }}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Join Code — Admin Only</p>
              <p className="text-sm text-gray-500 mt-0.5">Ask your chapter admin to share the join code with new members.</p>
            </div>
          </div>
        </div>
      )}

      {/* Chapter info — visible to everyone */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Chapter Info</h2>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-600">Chapter Name</span>
            <span className="text-sm font-semibold text-gray-900">{chapterName || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-600">Semester</span>
            <span className="text-sm font-semibold text-gray-900">{semester || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-600">Your Role</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              {userRole || 'Member'}
            </span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-600">Access Level</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={isAdmin ? { backgroundColor: '#dcfce7', color: '#15803d' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
              {isAdmin ? 'Admin' : 'Member'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
