/**
 * Greek Ledger wordmark — the logo is the wordmark itself, set in Playfair
 * Display (high-contrast display serif) with a small brass diamond accent.
 * No boxed monogram. variant: 'light' (navy bg) | 'dark' (cream bg).
 */
export default function BrandMark({ variant = 'dark', size = 'md' }) {
  const onNavy = variant === 'light'
  const ink   = onNavy ? '#f3efe6' : '#1b2640'
  const brass = onNavy ? '#c4a368' : '#b08d4f'
  const wordSize = size === 'lg' ? '1.9rem' : size === 'sm' ? '1.2rem' : '1.45rem'

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* small brass diamond — a quiet emblem, not a boxed icon */}
      <span
        aria-hidden
        style={{
          width: 7, height: 7, flexShrink: 0,
          transform: 'rotate(45deg)',
          background: brass,
          boxShadow: onNavy ? '0 0 8px rgba(196,163,104,0.5)' : 'none',
        }}
      />
      <span
        className="gl-display"
        style={{
          fontSize: wordSize,
          fontWeight: 600,
          letterSpacing: '0.005em',
          color: ink,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        Greek Ledger
      </span>
    </div>
  )
}
