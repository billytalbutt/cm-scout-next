/**
 * Fast `player stats.dat` summary decode (CM “Senior club” style totals).
 *
 * Paired-save research (Blackburn, Kieron Dyer player.dat id 118): when the player id
 * sits at the anchor (int32), season apps/goals/assists are usually u8 at anchor+91..93.
 * When anchor+59 also equals apps, goals at anchor+60 match CM (anchor+92 can be stale).
 */

import type { PlayerRecord, PlayerSavePerformanceStats } from './types'

export const PLAYER_STATS_SUMMARY_VERSION = 2

/** Byte offsets from the buffer offset where `player.dat` id (int32 LE) was found. */
export const PLAYER_STATS_SUMMARY_FIELDS = {
  apps: 91,
  goals: 92,
  assists: 93,
  /** Secondary slot — goals/assists here when +59 === apps (+91). */
  appsAlt: 59,
  goalsAlt: 60,
  assistsAlt: 61,
} as const

const F = PLAYER_STATS_SUMMARY_FIELDS

const MAX_PLAUSIBLE_PLUS20 = 10_000_000
const MAX_PLAUSIBLE_PLUS32 = 10_000_000

export interface SummaryStatsTriple {
  apps: number
  goals: number
  assists: number
}

function readU8(buf: Buffer, anchor: number, rel: number): number {
  return buf.readUInt8(anchor + rel)
}

export function plausibleSummaryStats(apps: number, goals: number, assists: number): boolean {
  if (apps < 1 || apps > 60 || goals > 60 || assists > 40) return false
  if (goals > apps) return false
  if (goals > Math.max(2, Math.floor(apps / 2))) return false
  return true
}

function sideFieldsOk(buf: Buffer, anchor: number): boolean {
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  return p20 > 0 && p32 > 0 && p20 < 500 && p32 < 500
}

/** Read apps/goals/assists with aligned +59/+60 slot when it matches +91. */
export function readSummaryStatsAtAnchor(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  if (anchor < 0 || anchor + F.assists + 1 > buf.length) return null

  const apps = readU8(buf, anchor, F.apps)
  let goals = readU8(buf, anchor, F.goals)
  let assists = readU8(buf, anchor, F.assists)

  const appsAlt = readU8(buf, anchor, F.appsAlt)
  if (appsAlt === apps && apps > 0) {
    goals = readU8(buf, anchor, F.goalsAlt)
    const ast93 = readU8(buf, anchor, F.assists)
    const ast61 = readU8(buf, anchor, F.assistsAlt)
    assists = ast93 > 0 ? ast93 : ast61
  }

  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

function isSummaryCandidateAnchor(buf: Buffer, anchor: number): boolean {
  if (anchor < 0 || anchor + F.assists + 1 > buf.length) return false
  if (buf.readInt32LE(anchor + 4) !== 0) return false
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  if (p20 >= MAX_PLAUSIBLE_PLUS20 || p32 >= MAX_PLAUSIBLE_PLUS32) return false
  if (p20 < 0 || p32 < 0) return false
  return readSummaryStatsAtAnchor(buf, anchor) != null
}

/** Prefer Senior-club aggregate rows, then most apps, fewest goals, most assists. */
export function compareSummaryCandidates(
  buf: Buffer,
  anchorA: number,
  anchorB: number,
): number {
  const a = readSummaryStatsAtAnchor(buf, anchorA)
  const b = readSummaryStatsAtAnchor(buf, anchorB)
  if (!a || !b) return 0

  const sideA = sideFieldsOk(buf, anchorA)
  const sideB = sideFieldsOk(buf, anchorB)
  if (sideA !== sideB) return sideA ? 1 : -1
  if (a.apps !== b.apps) return a.apps - b.apps
  if (a.goals !== b.goals) return b.goals - a.goals
  if (a.assists !== b.assists) return a.assists - b.assists
  return 0
}

export function decodePlayerStatsSummaryAtAnchor(
  buf: Buffer,
  anchor: number,
): PlayerSavePerformanceStats | null {
  const stats = readSummaryStatsAtAnchor(buf, anchor)
  if (!stats) return null
  return {
    apps: stats.apps,
    goals: stats.goals,
    assists: stats.assists,
    averageRating: null,
    layout: 'summaryV1',
  }
}

/**
 * Single pass over `player stats.dat` — one summary row per `player.dat` id when found.
 */
export function parsePlayerStatsSummary(
  buf: Buffer,
  players: readonly PlayerRecord[],
): Map<number, PlayerSavePerformanceStats> {
  const out = new Map<number, PlayerSavePerformanceStats>()
  if (!buf.length) return out

  const playerIds = new Set<number>()
  for (const p of players) playerIds.add(p.id)

  const bestAnchor = new Map<number, number>()

  const len = buf.length
  for (let anchor = 0; anchor <= len - 94; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue
    if (!isSummaryCandidateAnchor(buf, anchor)) continue

    const prevAnchor = bestAnchor.get(playerDatId)
    if (prevAnchor != null && compareSummaryCandidates(buf, anchor, prevAnchor) <= 0) continue

    bestAnchor.set(playerDatId, anchor)
    const decoded = decodePlayerStatsSummaryAtAnchor(buf, anchor)!
    out.set(playerDatId, decoded)
  }

  return out
}
