/**
 * Refined navy "showpiece" panel for the auth pages.
 * Cream/navy/brass register: pinstripe fabric texture, a large serif monogram
 * watermark, a slow single light sheen, and a few faint gold motes drifting up.
 * Whisper-quiet by design. Respects prefers-reduced-motion (CSS disables anims).
 *
 * Renders only its own surface; callers place it as an absolutely-positioned
 * full-bleed layer (it fills its relative parent).
 */
export default function AnimatedBackground() {
  return (
    <div className="gl-navy-panel absolute inset-0 overflow-hidden">
      {/* fabric pinstripe */}
      <div className="gl-pinstripe absolute inset-0" />

      {/* oversized serif monogram watermark */}
      <span className="gl-monogram" style={{ fontSize: '34rem', right: '-6rem', bottom: '-10rem' }}>
        GL
      </span>

      {/* slow light sheen */}
      <span className="gl-sheen" />

      {/* faint drifting gold motes */}
      <span className="gl-mote" style={{ left: '18%', bottom: '12%', animationDelay: '0s' }} />
      <span className="gl-mote" style={{ left: '42%', bottom: '4%', animationDelay: '-5s' }} />
      <span className="gl-mote" style={{ left: '63%', bottom: '20%', animationDelay: '-9s' }} />
      <span className="gl-mote" style={{ left: '80%', bottom: '8%', animationDelay: '-3s' }} />

      {/* hairline brass frame inset */}
      <div
        className="absolute pointer-events-none"
        style={{ inset: 18, border: '1px solid rgba(176,141,79,0.18)', borderRadius: 4 }}
      />
    </div>
  )
}
