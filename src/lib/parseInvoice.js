// Client helper: send a PDF File to /api/parse-invoice and get back the
// structured fields. The Anthropic API key stays server-side — this only
// talks to our own serverless function.

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:application/pdf;base64,XXXX" — strip the prefix.
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

export async function parseInvoice(file) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Please upload a PDF invoice.')
  }
  const pdfBase64 = await fileToBase64(file)

  const res = await fetch('/api/parse-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, filename: file.name }),
  })

  let payload
  try { payload = await res.json() } catch { payload = null }

  if (!res.ok) {
    throw new Error(payload?.error || 'Could not read the invoice. Please enter details manually.')
  }
  return payload.data // { vendor, amount, date, category, invoice_number, line_items }
}
