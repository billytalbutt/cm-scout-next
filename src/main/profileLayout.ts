import type { PlayerRecord } from './database/types'

/** Title-case attribute key for display / alphabetical sort (CM-style names). */
export function humanizeAttrKey(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Natural positions where suitability > 14 (same threshold as CM Scout suitability). */
export function formatNaturalPositions(p: PlayerRecord): string {
  const roles: { abbr: string; val: number }[] = [
    { abbr: 'GK', val: p.goalkeeper },
    { abbr: 'SW', val: p.sweeper },
    { abbr: 'D', val: p.defender },
    { abbr: 'WB', val: p.wing_back },
    { abbr: 'DM', val: p.defensive_midfielder },
    { abbr: 'M', val: p.midfielder },
    { abbr: 'AM', val: p.attacking_midfielder },
    { abbr: 'ST', val: p.attacker },
  ]
  const nat = roles.filter((r) => r.val > 14)
  if (nat.length === 0) return 'No primary position (all roles ≤14)'

  const sides: string[] = []
  if (p.left_side > 14) sides.push('L')
  if (p.right_side > 14) sides.push('R')
  if (p.centre_side > 14) sides.push('C')
  const sideStr = sides.length ? ` (${sides.join('/')})` : ''
  if (p.free_role > 14) return `${nat.map((r) => r.abbr).join(', ')}${sideStr} · Free role`
  return `${nat.map((r) => r.abbr).join(', ')}${sideStr}`
}

/** Split sorted keys into three columns (left → right), balanced counts (CM profile style). */
export function splitIntoThreeColumns<T>(sorted: T[]): [T[], T[], T[]] {
  const n = sorted.length
  if (n === 0) return [[], [], []]
  const c0 = Math.ceil(n / 3)
  const c1 = Math.ceil((n - c0) / 2)
  return [sorted.slice(0, c0), sorted.slice(c0, c0 + c1), sorted.slice(c0 + c1)]
}
