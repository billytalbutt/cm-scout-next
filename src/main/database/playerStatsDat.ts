/**
 * Heuristic decode of CM0102 `player stats.dat` (save block).
 * The game does not publish this layout; offsets are inferred from paired-save diffs
 * (Blackburn test saves) and validated on a few row shapes (zeroed prefix, prev-id chain, default).
 */

import type { PlayerRecord, PlayerSavePerformanceStats } from './types'

/** Bump when heuristic offsets / pick rules change; golden tests must be reviewed. */
export const PLAYER_STATS_HEURISTIC_VERSION = 1

const MAX_INT32_AT_PLUS4 = 50_000_000
const BAND_PLUS4_MIN = 1500
const BAND_PLUS4_MAX = 6000

function isAllZero8(buf: Buffer, anchor: number): boolean {
  const s = anchor - 8
  if (s < 0) return false
  for (let i = 0; i < 8; i++) {
    if (buf[s + i] !== 0) return false
  }
  return true
}

function isChainPrevId(buf: Buffer, anchor: number, playerDatId: number): boolean {
  if (anchor < 8) return false
  return buf.readInt32LE(anchor - 8) === playerDatId - 1
}

function layoutKind(buf: Buffer, anchor: number, playerDatId: number): 'zeroedPrefix' | 'chainPrevId' | 'default' {
  if (isAllZero8(buf, anchor)) return 'zeroedPrefix'
  if (isChainPrevId(buf, anchor, playerDatId)) return 'chainPrevId'
  return 'default'
}

/** Exported for tests and future spec decoder (same rules as internal `layoutKind`). */
export function detectPlayerStatsRowLayout(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
): 'zeroedPrefix' | 'chainPrevId' | 'default' {
  return layoutKind(buf, anchor, playerDatId)
}

function collectOccurrences(buf: Buffer, playerIds: ReadonlySet<number>): Map<number, number[]> {
  const out = new Map<number, number[]>()
  const len = buf.length
  for (let i = 0; i <= len - 4; i++) {
    const v = buf.readInt32LE(i)
    if (!playerIds.has(v)) continue
    const list = out.get(v)
    if (list) list.push(i)
    else out.set(v, [i])
  }
  return out
}

/** Every buffer offset where `readInt32LE` equals a known `player.dat` row id. */
export function collectPlayerDatIdOccurrences(buf: Buffer, playerIds: ReadonlySet<number>): Map<number, number[]> {
  return collectOccurrences(buf, playerIds)
}

function pickAnchor(buf: Buffer, playerDatId: number, occ: readonly number[]): number | null {
  if (occ.length === 0) return null
  if (occ.length === 1) return occ[0]!

  const last = buf.length - 8
  const plausible = occ.filter((c) => {
    if (c < 0 || c > last) return false
    const v4 = buf.readInt32LE(c + 4)
    return v4 < MAX_INT32_AT_PLUS4 && v4 > -1_000_000_000
  })
  if (plausible.length === 1) return plausible[0]!
  if (plausible.length > 1) {
    plausible.sort((a, b) => a - b)
    const band = plausible.filter((c) => {
      if (c < 0 || c > last) return false
      const v4 = buf.readInt32LE(c + 4)
      return v4 >= BAND_PLUS4_MIN && v4 <= BAND_PLUS4_MAX
    })
    if (band.length > 0) return band.reduce((a, b) => (a <= b ? a : b))
    return plausible[0]!
  }

  if (occ.length === 2) {
    return occ[0]! <= occ[1]! ? occ[0]! : occ[1]!
  }
  return occ.reduce((a, b) => (a <= b ? a : b))
}

/** Pick one anchor among many `player.dat` id hits (heuristic v1). */
export function pickPlayerStatsAnchor(buf: Buffer, playerDatId: number, occ: readonly number[]): number | null {
  return pickAnchor(buf, playerDatId, occ)
}

function readU8(buf: Buffer, anchor: number, rel: number): number | null {
  const i = anchor + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function plausibleDecoded(s: PlayerSavePerformanceStats): boolean {
  if (s.goals != null && (s.goals < 0 || s.goals > 120)) return false
  if (s.apps != null && (s.apps < 0 || s.apps > 120)) return false
  if (s.assists != null && (s.assists < 0 || s.assists > 80)) return false
  return true
}

export function isHeuristicDecodedPlausible(s: PlayerSavePerformanceStats): boolean {
  return plausibleDecoded(s)
}

function decodeAtAnchor(buf: Buffer, anchor: number, playerDatId: number): PlayerSavePerformanceStats {
  const layout = layoutKind(buf, anchor, playerDatId)
  if (layout === 'zeroedPrefix') {
    if (anchor > buf.length - 8) {
      return { apps: null, goals: null, assists: null, layout: 'zeroedPrefix' }
    }
    const v4 = buf.readInt32LE(anchor + 4)
    if (v4 < BAND_PLUS4_MIN || v4 > BAND_PLUS4_MAX) {
      return { apps: null, goals: null, assists: null, layout: 'zeroedPrefix' }
    }
    return {
      apps: readU8(buf, anchor, 12),
      goals: readU8(buf, anchor, 4),
      assists: readU8(buf, anchor, 106),
      layout,
    }
  }
  if (layout === 'chainPrevId') {
    if (anchor > buf.length - 8) {
      return { apps: null, goals: null, assists: null, layout: 'chainPrevId' }
    }
    const v4 = buf.readInt32LE(anchor + 4)
    if (v4 < 500_000 || v4 > MAX_INT32_AT_PLUS4) {
      return { apps: null, goals: null, assists: null, layout: 'chainPrevId' }
    }
    return {
      apps: null,
      goals: readU8(buf, anchor, 51),
      assists: null,
      layout,
    }
  }
  const v4 = anchor + 4 <= buf.length - 4 ? buf.readInt32LE(anchor + 4) : 0
  if (v4 < 500 || v4 > 250_000) {
    return { apps: null, goals: null, assists: null, layout: 'default' }
  }
  return {
    apps: null,
    goals: null,
    assists: readU8(buf, anchor, 106),
    layout: 'default',
  }
}

/** Decode one row at a known anchor (heuristic v1). Used by tests and tooling. */
export function decodePlayerStatsRowAtAnchor(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
): PlayerSavePerformanceStats {
  return decodeAtAnchor(buf, anchor, playerDatId)
}

/**
 * Build per–`player.dat` row id performance map. Missing or ambiguous rows yield no entry.
 */
export function parsePlayerSavePerformance(buf: Buffer, players: readonly PlayerRecord[]): Map<number, PlayerSavePerformanceStats> {
  const out = new Map<number, PlayerSavePerformanceStats>()
  if (!buf.length) return out

  const playerIds = new Set<number>()
  for (const p of players) playerIds.add(p.id)

  const occById = collectPlayerDatIdOccurrences(buf, playerIds)

  for (const p of players) {
    const occ = occById.get(p.id)
    if (!occ?.length) continue
    const anchor = pickPlayerStatsAnchor(buf, p.id, occ)
    if (anchor == null) continue
    const decoded = decodePlayerStatsRowAtAnchor(buf, anchor, p.id)
    const hasAny =
      decoded.apps != null || decoded.goals != null || decoded.assists != null
    if (!hasAny || !plausibleDecoded(decoded)) continue
    out.set(p.id, decoded)
  }

  return out
}
