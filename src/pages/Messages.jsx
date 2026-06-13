import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Treasurer text blast: a custom message from the treasurer, with each
// member's own dues balance appended. Admin-only. The send is server-side
// (/api/send-sms) — this page never sees phone numbers; the server fetches
// recipients + balances and verifies the caller is an admin.

const AUDIENCES = [
  { key: 'all',    label: 'Everyone',          hint: 'All members with a phone number' },
  { key: 'unpaid', label: 'Only members who owe', hint: 'Skips members paid in full' },
]

const SAMPLE = "Hey! Spring Formal is coming up 3/15 — get hyped. Quick reminder to square up your chapter dues so we stay in good standing. Pay link is in the GroupMe. Thanks!"

async function callSendSms(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Your session expired. Please sign in again.')
  const res = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  let json
  try { json = await res.json() } catch { json = null }
  if (!res.ok) throw new Error(json?.error || 'Request failed.')
  return json
}

export default function Messages() {
  const { chapterId, isAdmin } = useAuth()

  const [message, setMessage]   = useState('')
  const [audience, setAudience] = useState('all')
  const [preview, setPreview]   = useState(null) // dry-run result
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState(null)
  const [result, setResult]     = useState(null) // send result

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-xl mx-auto">
        <p className="gl-serif text-lg font-semibold text-gray-900 mb-1">Text Blasts</p>
        <p className="text-sm text-gray-500">Only a Treasurer or President can send chapter texts.</p>
      </div>
    )
  }

  async function handlePreview() {
    if (!message.trim()) { setError('Write a message first.'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const r = await callSendSms({ chapterId, message, audience, dryRun: true })
      setPreview(r)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function handleSend() {
    if (!window.confirm(`Send this text to ${preview.count} member${preview.count !== 1 ? 's' : ''}? This sends real SMS messages.`)) return
    setBusy(true); setError(null)
    try {
      const r = await callSendSms({ chapterId, message, audience, dryRun: false })
      setResult(r); setPreview(null); setMessage('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const charCount = message.length
  const segments  = Math.max(1, Math.ceil((charCount + 40) / 153)) // +~40 for the balance line

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="gl-serif text-xl font-semibold text-gray-900">Send a Text Blast</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your message goes to members&apos; phones, with each person&apos;s own dues balance added automatically.
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {error && (
            <p className="text-sm px-4 py-3 rounded-lg" style={{ backgroundColor: '#fbeaea', color: '#9b2c2c' }}>{error}</p>
          )}
          {result && (
            <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                Sent {result.sent} text{result.sent !== 1 ? 's' : ''}.{result.failed ? ` ${result.failed} failed.` : ''}
              </p>
              {result.failures?.length > 0 && (
                <ul className="text-xs mt-1" style={{ color: '#9b2c2c' }}>
                  {result.failures.map((f, i) => <li key={i}>{f.name}: {f.error}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Audience */}
          <div>
            <label className="block text-[13px] font-medium mb-2" style={{ color: '#5b677f' }}>Send to</label>
            <div className="flex gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => { setAudience(a.key); setPreview(null) }}
                  className="flex-1 text-left px-4 py-3 rounded-xl border-2 transition"
                  style={audience === a.key
                    ? { borderColor: '#b08d4f', backgroundColor: '#faf8f3' }
                    : { borderColor: '#e3dccd', backgroundColor: '#fff' }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#1b2640' }}>{a.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8a8170' }}>{a.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium" style={{ color: '#5b677f' }}>Your message</label>
              <button onClick={() => setMessage(SAMPLE)} className="text-xs font-medium hover:opacity-70" style={{ color: '#b08d4f' }}>
                Use example
              </button>
            </div>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setPreview(null) }}
              placeholder="e.g. Spring Formal is 3/15 — reminder to get your dues in so we stay in good standing!"
              className="gl-input"
              style={{ resize: 'vertical', lineHeight: 1.5 }}
            />
            <div className="flex items-center justify-between mt-1.5 text-xs" style={{ color: '#a99f8b' }}>
              <span>Each member&apos;s dues balance is added automatically below your message.</span>
              <span>{charCount} chars · ~{segments} SMS segment{segments !== 1 ? 's' : ''}/person</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={handlePreview}
              disabled={busy || !message.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ border: '1px solid #1b2640', color: '#1b2640' }}
            >
              {busy && !preview ? 'Checking…' : 'Preview Recipients'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview / confirm card */}
      {preview && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="gl-serif text-lg font-semibold text-gray-900">Preview</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-semibold" style={{ color: '#1b2640' }}>{preview.count}</span> member{preview.count !== 1 ? 's' : ''} will be texted.
              {preview.skipped?.noPhone ? ` ${preview.skipped.noPhone} skipped (no phone).` : ''}
              {preview.skipped?.paidFiltered ? ` ${preview.skipped.paidFiltered} skipped (paid).` : ''}
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {!preview.twilioConfigured && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}>
                Texting isn&apos;t configured on the server yet (Twilio credentials missing). You can preview, but Send won&apos;t work until they&apos;re added.
              </p>
            )}
            {preview.count === 0 ? (
              <p className="text-sm text-gray-400">No members match — add phone numbers on the Members page, or change the audience.</p>
            ) : (
              <>
                <p className="gl-eyebrow" style={{ color: '#a99f8b' }}>Sample of what they&apos;ll receive</p>
                {preview.sample.map((s, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: '#faf8f3', border: '1px solid #e9e2d3' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#8a8170' }}>To {s.name}</p>
                    <p className="text-sm whitespace-pre-line" style={{ color: '#1b2640' }}>{s.preview}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          {preview.count > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setPreview(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleSend}
                disabled={busy || !preview.twilioConfigured}
                className="gl-btn-brass px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {busy && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                )}
                {busy ? 'Sending…' : `Send to ${preview.count}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
