/** Right-click on attribute minimum inputs: empty → 5 → 10 → 15 → 20 → empty (≥20 clears). */
export function nextAttrMinLadderOnRightClick(current: string): string {
  const t = current.trim()
  const n = Number(t)
  if (!t || !Number.isFinite(n) || n <= 0) return '5'
  if (n >= 20) return ''
  for (const step of [5, 10, 15, 20] as const) {
    if (step > n) return String(step)
  }
  return ''
}
