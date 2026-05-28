import { inGameCa18 } from '../shared/cm0102AttributeDisplay'
import { ATTR_CA18, scoutDisplayVector48 } from './cmScoutRating'
import type { PlayerRecord, StaffRecord } from './database/types'
import type { RegenBaselineEntry } from './regenBaseline'

/** In-game 1–20 display vector (same as profile / CM Scout % inputs). */
export function developmentDisplayVector48(p: PlayerRecord, s: StaffRecord): number[] {
  return scoutDisplayVector48(p, s)
}

/** v2 snapshots stored raw disk intrinsics — CA18 slots are often &lt;1 or &gt;20. */
export function isLegacyRawAttr48Snapshot(attrs: readonly number[]): boolean {
  if (attrs.length !== 48) return false
  for (let i = 0; i < 18; i++) {
    const v = attrs[i] ?? 0
    if (v < 1 || v > 20) return true
  }
  return false
}

function isGkFromPosSig(posSig: string | undefined): boolean {
  if (!posSig) return false
  const gk = Number(posSig.split(',')[0])
  return Number.isFinite(gk) && gk > 14
}

/** Convert legacy snapshot raw intrinsics to in-game display at snapshot CA. */
export function displayVectorFromLegacyRaw48(
  raw48: readonly number[],
  ca: number,
  posSig: string | undefined,
): number[] {
  const gkPlayer = { goalkeeper: isGkFromPosSig(posSig) ? 20 : 1 }
  const out: number[] = []
  let ca18j = 0
  for (let i = 0; i < 48; i++) {
    const intr = raw48[i] ?? 0
    if (ATTR_CA18[i]) {
      out.push(inGameCa18(ca18j, ca, intr, gkPlayer))
      ca18j++
    } else {
      let v = intr
      if (v < 1) v = 1
      else if (v > 20) v = 20
      out.push(v)
    }
  }
  return out
}

/** Resolve snapshot baseline as in-game display values for development compare. */
export function resolveSnapshotDisplay48(entry: RegenBaselineEntry): number[] | null {
  const stored = entry.attr48
  if (!stored || stored.length !== 48) return null
  if (isLegacyRawAttr48Snapshot(stored)) {
    return displayVectorFromLegacyRaw48(stored, entry.ca, entry.posSig)
  }
  return [...stored]
}

export function snapshotUsesLegacyRawAttrs(entry: RegenBaselineEntry | undefined): boolean {
  if (!entry?.attr48) return false
  return isLegacyRawAttr48Snapshot(entry.attr48)
}
