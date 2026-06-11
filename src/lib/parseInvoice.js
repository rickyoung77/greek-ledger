// Client helper: send an invoice file (PDF or image) to /api/parse-invoice
// and get back the structured fields. The Anthropic API key stays server-side
// — this only talks to our own serverless function.

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:<mime>;base64,XXXX" — strip the prefix.
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

export async function parseInvoice(file) {
  if (!file || !ALLOWED.includes(file.type)) {
    throw new Error('Please upload a PDF or an image (JPG/PNG) of the invoice.')
  }
  const fileBase64 = await fileToBase64(file)

  const res = await fetch('/api/parse-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mediaType: file.type, filename: file.name }),
  })

  let payload
  try { payload = await res.json() } catch { payload = null }

  if (!res.ok) {
    throw new Error(payload?.error || 'Could not read the invoice. Please enter details manually.')
  }
  return payload.data // { vendor, amount, date, category, invoice_number, line_items }
}
