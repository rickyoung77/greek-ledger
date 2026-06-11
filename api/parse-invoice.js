// Vercel serverless function — POST /api/parse-invoice
// ───────────────────────────────────────────────────────────────
// Receives a base64 PDF, sends it to Claude (Opus 4.8) as a document
// block, and returns structured JSON to auto-fill the expense form.
//
// SECURITY: ANTHROPIC_API_KEY lives ONLY in the server environment
// (no VITE_ prefix → never bundled into the browser). The PDF round-trips
// through this function; the key is never exposed to the client.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'
const MAX_PDF_BYTES = 12 * 1024 * 1024 // 12 MB cap (base64 ~ +33%)

// Frozen system prompt → cached across requests (prompt caching is a
// prefix match; keep this byte-identical and put nothing volatile in it).
const SYSTEM_PROMPT = `You are an expert accounts-payable assistant for a fraternity/sorority chapter treasurer. You read a single vendor invoice (catering, DJ, bus company, venue, production, supplies, etc.) and extract its key fields for an expense record.

Rules:
- "vendor" is the business that issued the invoice (the payee), not the chapter.
- "amount" is the FINAL total due (grand total including tax/fees), as a number with no currency symbol or commas.
- "date" is the invoice date in YYYY-MM-DD. If only a due date is present, use that. If no date is found, use null.
- "line_items" lists the billed items. Each has a description and its line amount (number). Omit pure subtotal/tax/total rows from line_items. If line items aren't itemized, return an empty array.
- "category" is your best guess of the chapter budget category from: Social, Operations, Philanthropy, Housing. Choose the closest fit.
- If a field genuinely cannot be determined, use null (or [] for line_items). Never invent values.
- Base every value strictly on what the document shows.`

// Structured-output schema — guarantees parseable JSON back to the form.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    vendor: { type: ['string', 'null'] },
    amount: { type: ['number', 'null'] },
    date: { type: ['string', 'null'] },
    category: {
      anyOf: [
        { type: 'string', enum: ['Social', 'Operations', 'Philanthropy', 'Housing'] },
        { type: 'null' },
      ],
    },
    invoice_number: { type: ['string', 'null'] },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: ['number', 'null'] },
        },
        required: ['description', 'amount'],
        additionalProperties: false,
      },
    },
  },
  required: ['vendor', 'amount', 'date', 'category', 'invoice_number', 'line_items'],
  additionalProperties: false,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'Invoice parsing is not configured. Set ANTHROPIC_API_KEY on the server.',
    })
  }

  // Body is { pdfBase64: string, filename?: string }. Vercel parses JSON bodies
  // automatically; guard for the raw-string case just in case.
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const pdfBase64 = body?.pdfBase64
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'Missing pdfBase64 in request body.' })
  }
  // Rough size guard before we hand a giant payload to the API.
  if (pdfBase64.length * 0.75 > MAX_PDF_BYTES) {
    return res.status(413).json({ error: 'PDF is too large (max 12 MB).' })
  }

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            { type: 'text', text: 'Extract the invoice fields as structured JSON.' },
          ],
        },
      ],
    })

    // output_config.format guarantees the first text block is valid JSON.
    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock) {
      return res.status(502).json({ error: 'No parse result returned. Please try again.' })
    }
    const parsed = JSON.parse(textBlock.text)

    return res.status(200).json({
      data: parsed,
      usage: {
        input_tokens: message.usage?.input_tokens ?? null,
        output_tokens: message.usage?.output_tokens ?? null,
        cache_read_input_tokens: message.usage?.cache_read_input_tokens ?? null,
      },
    })
  } catch (err) {
    // Map the SDK's typed errors to clean client messages; never leak the key/stack.
    const status = err?.status ?? 500
    const apiMsg = String(err?.message ?? '')
    let clientMsg = 'Could not read the invoice. Please try again or enter the details manually.'
    if (status === 401) {
      clientMsg = 'Invoice parsing is misconfigured (invalid API key).'
    } else if (status === 429) {
      clientMsg = 'Invoice parsing is busy right now. Please try again in a moment.'
    } else if (status === 413 || /too large|request_too_large/i.test(apiMsg)) {
      clientMsg = 'That PDF is too large to parse (max 12 MB / 100 pages).'
    } else if (/credit|billing|insufficient/i.test(apiMsg)) {
      clientMsg = 'Invoice parsing is unavailable — the account is out of API credits.'
    } else if (/pdf.*not valid|not a valid pdf|invalid.*pdf|could not.*pdf|unsupported|corrupt/i.test(apiMsg)) {
      clientMsg = "This file isn't a readable PDF. It may be password-protected, a scanned image saved oddly, or not a real PDF. Try re-saving/exporting it as a standard PDF, or enter the details manually."
    }
    console.error('[parse-invoice] error:', status, apiMsg)
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: clientMsg })
  }
}
