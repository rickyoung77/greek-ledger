// Vercel serverless function — POST /api/send-sms
// ───────────────────────────────────────────────────────────────
// Sends a personalized dues-reminder text blast from the treasurer.
// Each recipient gets the treasurer's custom message + their own dues balance.
//
// SECURITY (this endpoint spends money + texts people, so it is locked down):
//  - Twilio creds live ONLY in server env (never in the browser bundle).
//  - The caller must send their Supabase access token; we verify with it that
//    they are a chapter ADMIN before doing anything.
//  - The client NEVER supplies phone numbers or recipients. The server fetches
//    members + dues balances itself, scoped to the caller's chapter via RLS.
//    This closes the "spam arbitrary numbers" abuse vector.
//  - dryRun: true returns the computed recipient list + preview WITHOUT sending.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY
const MAX_RECIPIENTS = 500 // safety cap per blast

// ── tiny REST helpers (no SDK; keeps the function light) ─────────
async function sb(path, token, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message || `Supabase ${res.status}`)
  return data
}

async function rpc(fn, token, args) {
  return sb(`rpc/${fn}`, token, { method: 'POST', body: JSON.stringify(args) })
}

// Normalize a phone to E.164 (assume US if 10 digits). Returns null if unusable.
function toE164(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (digits.startsWith('+') && digits.length >= 11) return digits
  const d = digits.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const SID = process.env.TWILIO_ACCOUNT_SID
  const AUTH = process.env.TWILIO_AUTH_TOKEN
  const FROM = process.env.TWILIO_FROM_NUMBER
  const twilioConfigured = !!(SID && AUTH && FROM)

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { chapterId, message, audience = 'all', dryRun = false } = body || {}

  // Auth: the caller's Supabase access token (Bearer) proves who they are.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not signed in.' })
  if (!chapterId) return res.status(400).json({ error: 'Missing chapterId.' })
  if (!dryRun && (!message || !message.trim())) {
    return res.status(400).json({ error: 'Message is required.' })
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' })
  }

  try {
    // 1) Verify the caller is an admin of THIS chapter (RLS + role gate).
    const isAdmin = await rpc('user_is_chapter_admin', token, { cid: chapterId })
    if (isAdmin !== true) {
      return res.status(403).json({ error: 'Only a Treasurer or President can send texts.' })
    }

    // 2) Server-side: fetch members (with phones) for this chapter.
    const members = await sb(
      `members?chapter_id=eq.${chapterId}&select=id,full_name,phone`,
      token,
    )

    // 3) Compute each member's outstanding balance from unpaid member_dues
    //    in this chapter's dues collections.
    const collections = await sb(
      `dues_collections?chapter_id=eq.${chapterId}&select=id`,
      token,
    )
    const colIds = (collections || []).map((c) => c.id)
    let balanceByMember = {}
    if (colIds.length) {
      const dues = await sb(
        `member_dues?dues_collection_id=in.(${colIds.join(',')})&select=member_id,amount_owed,status`,
        token,
      )
      for (const d of dues || []) {
        if (d.status !== 'paid') {
          balanceByMember[d.member_id] = (balanceByMember[d.member_id] || 0) + Number(d.amount_owed || 0)
        }
      }
    }

    // 4) Build the recipient list per the audience choice.
    const recipients = []
    const skipped = { noPhone: 0, paidFiltered: 0 }
    for (const m of members || []) {
      const balance = balanceByMember[m.id] || 0
      if (audience === 'unpaid' && balance <= 0) { skipped.paidFiltered++; continue }
      const to = toE164(m.phone)
      if (!to) { skipped.noPhone++; continue }
      const balanceLine = balance > 0
        ? `You currently owe ${money(balance)} in dues.`
        : `Your dues are paid in full — thank you!`
      recipients.push({ name: m.full_name, to, balance, balanceLine })
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return res.status(400).json({ error: `Too many recipients (${recipients.length}). Max ${MAX_RECIPIENTS}.` })
    }

    // 5) dryRun → return the plan + a sample preview, send nothing.
    if (dryRun) {
      const sample = recipients.slice(0, 3).map((r) => ({
        name: r.name,
        preview: `${(message || '').trim()}${message ? '\n\n' : ''}${r.balanceLine}`.trim(),
      }))
      return res.status(200).json({
        dryRun: true, count: recipients.length, skipped, sample,
        twilioConfigured,
      })
    }

    if (!twilioConfigured) {
      return res.status(500).json({ error: 'Texting is not configured. Add Twilio credentials on the server.' })
    }
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients with a valid phone number.' })
    }

    // 6) Send via Twilio REST API (Basic auth), personalized per recipient.
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`
    const basic = Buffer.from(`${SID}:${AUTH}`).toString('base64')
    let sent = 0
    const failures = []
    for (const r of recipients) {
      const fullBody = `${message.trim()}\n\n${r.balanceLine}`
      const params = new URLSearchParams({ To: r.to, From: FROM, Body: fullBody })
      const tw = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      if (tw.ok) { sent++ } else {
        const err = await tw.json().catch(() => ({}))
        failures.push({ name: r.name, error: err?.message || `Twilio ${tw.status}` })
      }
    }

    return res.status(200).json({ sent, failed: failures.length, failures: failures.slice(0, 5) })
  } catch (err) {
    console.error('[send-sms] error:', err?.message)
    return res.status(500).json({ error: 'Could not send the texts. Please try again.' })
  }
}
