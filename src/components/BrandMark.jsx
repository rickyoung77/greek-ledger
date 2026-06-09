/**
 * Greek Ledger wordmark — a small brass monogram crest beside a serif wordmark.
 * variant: 'light' (for navy backgrounds) | 'dark' (for cream backgrounds).
 */
export default function BrandMark({ variant = 'dark', size = 'md' }) {
  const onNavy = variant === 'light'
  const wordColor = onNavy ? '#f3efe6' : '#1b2640'
  const dims = size === 'lg' ? 44 : size === 'sm' ? 32 : 38
  const wordSize = size === 'lg' ? '1.75rem' : size === 'sm' ? '1.25rem' : '1.5rem'

  return (
    <div className="flex items-center gap-3">
      {/* Crest */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: dims,
          height: dims,
          borderRadius: 9,
          border: '1px solid rgba(176,141,79,0.55)',
          background: onNavy
            ? 'linear-gradient(180deg, rgba(176,141,79,0.18), rgba(176,141,79,0.04))'
            : 'linear-gradient(180deg, #fff, #f3efe6)',
          boxShadow: onNavy ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        <span
          className="gl-serif"
          style={{
            fontSize: dims * 0.5,
            fontWeight: 600,
            lineHeight: 1,
            color: '#b08d4f',
            letterSpacing: '-0.03em',
          }}
        >
          GL
        </span>
      </div>

      {/* Wordmark */}
      <span
        className="gl-serif"
        style={{ fontSize: wordSize, fontWeight: 600, letterSpacing: '0.01em', color: wordColor, lineHeight: 1 }}
      >
        Greek Ledger
      </span>
    </div>
  )
}
