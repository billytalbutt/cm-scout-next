import { CA18_KEYS, inGameCa18 } from './database/attributes'
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
 * Values for effectiveness recipes: **same 1–20 scale as the profile** (in-game CA18 from CA + intrinsic;
 * other `player.dat` bytes clamped 1–20; staff mentals clamped 1–20). Avoids raw signed bytes (−7, 26, …)
 * that do not match what you see in-game.
 */
export function effectivenessAttrGetter(p: PlayerRecord, s: StaffRecord): (name: string) => number {
  const pr = p as Record<string, number>
  const sr = s as Record<string, number>
  return (name: string) => {
    if (STAFF_ONLY.has(name)) {
      const v = sr[name]
      return clamp120(typeof v === 'number' && Number.isFinite(v) ? v : 0)
    }
    const ca18i = CA18_INDEX.get(name)
    if (ca18i !== undefined) {
      const raw = pr[name]
      const intr = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      return clamp120(inGameCa18(ca18i, p.current_ability, intr, p))
    }
    const v = pr[name]
    return clamp120(typeof v === 'number' && Number.isFinite(v) ? v : 0)
  }
}
