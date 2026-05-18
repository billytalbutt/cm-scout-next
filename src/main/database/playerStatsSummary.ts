/**
 * Fast `player stats.dat` summary decode (CM “Senior club” style totals).
 *
 * Paired-save research (Blackburn, Kieron Dyer player.dat id 118): when the player id
 * sits at the anchor (int32), season apps/goals/assists are u8 at anchor+91/+92/+93.
 * One O(n) pass picks the best candidate per player (v4 === 0, plausible side fields).
 */

import type { PlayerRecord, PlayerSavePerformanceStats } from './types'

export const PLAYER_STATS_SUMMARY_VERSION = 1

/** Byte offsets from the buffer offset where `player.dat` id (int32 LE) was found. */
export const PLAYER_STATS_SUMMARY_FIELDS = {
  apps: 91,
  goals: 92,
  assists: 93,
} as const

const MAX_PLAUSIBLE_PLUS20 = 10_000_000
const MAX_PLAUSIBLE_PLUS32 = 10_000_000

function readU8(buf: Buffer, anchor: number, rel: number): number | null {
  const i = anchor + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function plausibleSummaryStats(apps: number, goals: number, assists: number): boolean {
  if (apps < 1 || apps > 60 || goals > 60 || assists > 40) return false
  if (goals > apps) return false
  if (goals > Math.max(2, Math.floor(apps / 2))) return false
  return true
}

function isSummaryCandidateAnchor(buf: Buffer, anchor: number): boolean {
  if (anchor < 0 || anchor + 94 > buf.length) return false
  if (buf.readInt32LE(anchor + 4) !== 0) return false
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  if (p20 >= MAX_PLAUSIBLE_PLUS20 || p32 >= MAX_PLAUSIBLE_PLUS32) return false
  if (p20 < 0 || p32 < 0) return false
  const apps = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.apps)
  const goals = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.goals)
  const assists = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.assists)
  return plausibleSummaryStats(apps, goals, assists)
}

/** Prefer Senior-club aggregate rows (small positive side fields), then most apps, then lowest total. */
function summaryCandidateRank(
  buf: Buffer,
  anchor: number,
  apps: number,
  goals: number,
  assists: number,
): number {
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  const sideFieldsOk = p20 > 0 && p32 > 0 && p20 < 500 && p32 < 500
  const total = apps + goals + assists
  return (sideFieldsOk ? 1_000_000 : 0) + apps * 1000 - total * 10
}

export function decodePlayerStatsSummaryAtAnchor(
  buf: Buffer,
  anchor: number,
): PlayerSavePerformanceStats | null {
  if (!isSummaryCandidateAnchor(buf, anchor)) return null
  return {
    apps: readU8(buf, anchor, PLAYER_STATS_SUMMARY_FIELDS.apps),
    goals: readU8(buf, anchor, PLAYER_STATS_SUMMARY_FIELDS.goals),
    assists: readU8(buf, anchor, PLAYER_STATS_SUMMARY_FIELDS.assists),
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

  const bestRank = new Map<number, number>()

  const len = buf.length
  for (let anchor = 0; anchor <= len - 94; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue
    if (!isSummaryCandidateAnchor(buf, anchor)) continue

    const apps = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.apps)
    const goals = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.goals)
    const assists = buf.readUInt8(anchor + PLAYER_STATS_SUMMARY_FIELDS.assists)
    const rank = summaryCandidateRank(buf, anchor, apps, goals, assists)
    const prev = bestRank.get(playerDatId)
    if (prev != null && rank <= prev) continue

    bestRank.set(playerDatId, rank)
    out.set(playerDatId, {
      apps,
      goals,
      assists,
      averageRating: null,
      layout: 'summaryV1',
    })
  }

  return out
}
