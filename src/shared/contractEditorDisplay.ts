import { contractTypeLabel } from './contractTypes'

/** CM0102 contract bonus sentinel — no bonus in save. */
export function fmtContractBonus(n: number): string {
  if (!Number.isFinite(n) || n < 0) return 'None'
  if (n === 0) return 'None'
  return fmtWage(n)
}

export function fmtWage(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

export function fmtReleaseFee(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'None'
  return fmtWage(n)
}

/** `contract.dat` squad-status byte (CM0102 in-game squad role). */
const SQUAD_STATUS_LABELS: Record<number, string> = {
  0: 'Not set',
  1: 'Key player',
  2: 'First team',
  3: 'Squad player',
  4: 'Future prospect',
  5: 'Hot prospect',
  6: 'Youngster',
  7: 'Not wanted',
  8: 'On loan',
}

export function squadStatusLabel(byte: number): string {
  return SQUAD_STATUS_LABELS[byte] ?? `Unknown (${byte})`
}

export function transferArrangedLabel(clubId: number, clubName?: string | null): string {
  if (!Number.isFinite(clubId) || clubId <= 0) return 'None'
  const name = clubName?.trim()
  if (name) return name
  return `Club #${clubId}`
}

export function contractTypeDisplay(byte: number): string {
  return contractTypeLabel(byte)
}

export function yesNoLabel(v: number): string {
  return v > 0 ? 'Yes' : 'No'
}
