import { useRef, useState } from 'react'
import { parseInvoice } from '../lib/parseInvoice'

// Drag-or-click PDF dropzone that parses a vendor invoice with Claude and
// hands the extracted fields back via onParsed(fields, file). Refined finance
// styling (cream / navy / brass) to match the rest of the app.
export default function InvoiceUpload({ onParsed }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | parsing | done | error
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file) {
    if (!file) return
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      setStatus('error'); setError('Please upload a PDF or a photo/screenshot (JPG, PNG) of the invoice.'); return
    }
    setFileName(file.name)
    setStatus('parsing'); setError(null)
    try {
      const fields = await parseInvoice(file)
      setStatus('done')
      onParsed?.(fields, file)
    } catch (err) {
      setStatus('error')
      setError(err?.message ?? 'Could not read the invoice.')
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const parsing = status === 'parsing'

  return (
    <div>
      <p className="gl-eyebrow mb-2" style={{ color: '#b08d4f' }}>✦ AI Invoice Parsing</p>
      <button
        type="button"
        onClick={() => !parsing && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={parsing}
        className="w-full rounded-xl px-4 py-5 text-center transition"
        style={{
          border: `1.5px dashed ${dragOver ? '#b08d4f' : status === 'done' ? '#86c89b' : status === 'error' ? '#e3b1b1' : '#d8d2c5'}`,
          backgroundColor: dragOver ? '#f6efe0' : status === 'done' ? '#f0fdf4' : '#faf8f3',
          cursor: parsing ? 'wait' : 'pointer',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {parsing ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#b08d4f' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#1b2640' }}>
              Reading {fileName || 'invoice'}…
            </span>
          </div>
        ) : status === 'done' ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="#15803d" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#15803d' }}>
              Filled from {fileName}. Review and submit.
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <svg className="w-6 h-6" fill="none" stroke="#b08d4f" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 13l3-3m0 0l3 3m-3-3v9" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#1b2640' }}>
              Upload an invoice — PDF or photo
            </span>
            <span className="text-xs" style={{ color: '#a99f8b' }}>
              Claude reads it and fills the form. PDF, JPG, or a phone photo.
            </span>
          </div>
        )}
      </button>

      {status === 'error' && error && (
        <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>{error}</p>
      )}
    </div>
  )
}
