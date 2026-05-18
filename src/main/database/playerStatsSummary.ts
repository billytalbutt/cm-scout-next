/**
 * Fast `player stats.dat` summary decode (CM “Senior club” style totals).
 *
 * Two layouts at a `player.dat` id anchor (int32 LE):
 * - **Slot A:** apps/goals/assists @ +91 / +92 / +93 (when +59 === apps, goals @ +60)
 * - **Slot B:** apps/goals/assists @ +76 / +77 / +78 — Senior club aggregate (+91 often 0)
 */

import type { PlayerRecord, PlayerSavePerformanceStats } from './types'

export const PLAYER_STATS_SUMMARY_VERSION = 3

export const PLAYER_STATS_SUMMARY_FIELDS = {
  apps: 91,
  goals: 92,
  assists: 93,
  appsAlt: 59,
  goalsAlt: 60,
  assistsAlt: 61,
  appsSenior: 76,
  goalsSenior: 77,
  assistsSenior: 78,
} as const

const F = PLAYER_STATS_SUMMARY_FIELDS

const MAX_PLAUSIBLE_PLUS20 = 10_000_000
const MAX_PLAUSIBLE_PLUS32 = 10_000_000
/** Senior-club +76 rows above this are usually another stat kind, not the season total. */
const MAX_SENIOR_SLOT_APPS = 15

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

function readSlotA(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const apps = readU8(buf, anchor, F.apps)
  if (apps < 1) return null

  let goals = readU8(buf, anchor, F.goals)
  let assists = readU8(buf, anchor, F.assists)

  const appsAlt = readU8(buf, anchor, F.appsAlt)
  if (appsAlt === apps) {
    goals = readU8(buf, anchor, F.goalsAlt)
    const ast93 = readU8(buf, anchor, F.assists)
    const ast61 = readU8(buf, anchor, F.assistsAlt)
    assists = ast93 > 0 ? ast93 : ast61
  }

  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

function readSlotB(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const apps = readU8(buf, anchor, F.appsSenior)
  if (apps < 1) return null
  const goals = readU8(buf, anchor, F.goalsSenior)
  const assists = readU8(buf, anchor, F.assistsSenior)
  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

/** Senior-club aggregate uses slot B when slot A apps byte is zero. */
export function isSlotBSeniorAggregate(buf: Buffer, anchor: number): boolean {
  return readU8(buf, anchor, F.apps) < 1 && readSlotB(buf, anchor) != null
}

export function isPlausibleSeniorSlotStats(stats: SummaryStatsTriple): boolean {
  return (
    stats.apps >= 5 &&
    stats.apps <= MAX_SENIOR_SLOT_APPS &&
    stats.goals >= 1 &&
    stats.goals <= Math.max(2, Math.floor(stats.apps / 2)) &&
    stats.assists <= stats.apps
  )
}

/** Pick the best-decoding slot group at this id anchor. */
export function readSummaryStatsAtAnchor(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  if (anchor < 0 || anchor + F.assists + 1 > buf.length) return null

  const slotB = readSlotB(buf, anchor)
  const slotA = readSlotA(buf, anchor)

  if (slotB && readU8(buf, anchor, F.apps) < 1) return slotB
  return slotA ?? slotB
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

function sideFieldsOk(buf: Buffer, anchor: number): boolean {
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  return p20 > 0 && p32 > 0 && p20 < 500 && p32 < 500
}

export function compareSummaryCandidates(
  buf: Buffer,
  anchorA: number,
  anchorB: number,
): number {
  const a = readSummaryStatsAtAnchor(buf, anchorA)
  const b = readSummaryStatsAtAnchor(buf, anchorB)
  if (!a || !b) return 0

  const seniorA = isSlotBSeniorAggregate(buf, anchorA)
  const seniorB = isSlotBSeniorAggregate(buf, anchorB)
  if (seniorA !== seniorB) return seniorA ? 1 : -1

  if (seniorA && seniorB) {
    const okA = isPlausibleSeniorSlotStats(a)
    const okB = isPlausibleSeniorSlotStats(b)
    if (okA !== okB) return okA ? 1 : -1
    if (a.goals !== b.goals) return b.goals - a.goals
    const bandA = a.apps >= 9 && a.apps <= 12
    const bandB = b.apps >= 9 && b.apps <= 12
    if (bandA !== bandB) return bandA ? 1 : -1
    if (a.apps !== b.apps) return a.apps - b.apps
    return a.assists - b.assists
  }

  if (a.apps !== b.apps) return a.apps - b.apps
  if (a.goals !== b.goals) return b.goals - a.goals
  if (a.assists !== b.assists) return a.assists - b.assists

  const sideA = sideFieldsOk(buf, anchorA)
  const sideB = sideFieldsOk(buf, anchorB)
  if (sideA !== sideB) return sideA ? 1 : -1
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
    out.set(playerDatId, decodePlayerStatsSummaryAtAnchor(buf, anchor)!)
  }

  return out
}
