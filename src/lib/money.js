// Money parsing helpers, shared by MoneyInput and the pages that validate
// amounts. Kept in a plain .js module (not the component file) so React Fast
// Refresh stays happy.

export function parseMoney(raw) {
  if (raw == null) return NaN
  const cleaned = String(raw).replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '.') return NaN
  return Number(cleaned)
}

export function isValidMoney(raw) {
  const n = parseMoney(raw)
  return Number.isFinite(n) && n >= 0
}
