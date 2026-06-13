// A forgiving money input. Unlike <input type="number">, this accepts what
// people actually type — "5,000", "$5000", "5000.50", with spaces — instead of
// silently rejecting commas/$ and leaving the field blank (which left users
// stuck using only the stepper arrows).
//
// Value flows as a plain string; use parseMoney() (from lib/money) to read it.

export default function MoneyInput({ value, onChange, placeholder = '0.00', className = 'gl-input', autoFocus, id }) {
  function handle(e) {
    // Allow only digits, one dot, commas, $, spaces while typing.
    let v = e.target.value.replace(/[^0-9.,$\s]/g, '')
    const firstDot = v.indexOf('.')
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
    }
    onChange(v)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={handle}
        placeholder={placeholder}
        className={className}
        style={{ paddingLeft: '1.6rem' }}
      />
    </div>
  )
}
