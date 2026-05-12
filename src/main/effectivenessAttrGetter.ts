import type { PlayerRecord, StaffRecord } from './database/types'

const STAFF_ONLY = new Set<string>([
  'adaptability',
  'ambition',
  'determination',
  'loyalty',
  'pressure',
  'professionalism',
  'sportsmanship',
  'temperament',
])

/**
 * Attribute getter for effectiveness: `player.dat` fields plus staff-only mentals from `staff.dat`.
 */
export function effectivenessAttrGetter(p: PlayerRecord, s: StaffRecord): (name: string) => number {
  const pr = p as Record<string, number>
  const sr = s as Record<string, number>
  return (name: string) => {
    if (STAFF_ONLY.has(name)) {
      const v = sr[name]
      return typeof v === 'number' && Number.isFinite(v) ? v : 0
    }
    const v = pr[name]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
}
