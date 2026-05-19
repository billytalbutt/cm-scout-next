import { CA18_KEYS, inGameCa18Uncapped } from './database/attributes'
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

/** CA18 name → index for the same `inGameCa18` path as the profile. */
const CA18_INDEX = new Map<string, number>(CA18_KEYS.map((k, i) => [k, i]))

function clamp120(n: number): number {
  if (!Number.isFinite(n)) return 1
  const t = Math.trunc(n)
  if (t < 1) return 1
  if (t > 20) return 20
  return t
}

/**
 * Values for effectiveness recipes: **uncapped engine display** where the profile can exceed 20
 * (CA18 `inGameUncapped` from CA + intrinsic; other `player.dat` bytes as stored). Staff mentals stay
 * 1–20. This lets cheat-code elites (e.g. Tsigalko finishing/OTB) score above a flat “all 20s” profile.
 */
export function effectivenessAttrGetter(p: PlayerRecord, s: StaffRecord): (name: string) => number {
  const pr = p as Record<string, number>
  const sr = s as Record<string, number>
  const ca = p.current_ability
  return (name: string) => {
    if (STAFF_ONLY.has(name)) {
      const v = sr[name]
      return clamp120(typeof v === 'number' && Number.isFinite(v) ? v : 0)
    }
    const ca18i = CA18_INDEX.get(name)
    if (ca18i !== undefined) {
      const raw = pr[name]
      const intr = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      const uncapped = inGameCa18Uncapped(ca18i, ca, intr, p)
      return Number.isFinite(uncapped) ? Math.max(0, uncapped) : 0
    }
    const v = pr[name]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
  }
}
