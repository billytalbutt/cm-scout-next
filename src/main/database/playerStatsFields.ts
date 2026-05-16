/**
 * Phase C — fixed field map on 128-byte `player stats.dat` rows (grid V0).
 * See `docs/PLAYER_STATS_DECODING_SPEC.md` and `PLAYER_STATS_FIELD_MAP_V0`.
 */

import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  type PlayerStatsResearchGrid,
  isEligibleResearchStatsRow,
  iterPlayerStatsRowStarts,
} from './playerStatsJoins'
import { plausiblePlayerStatsInt32AtPlus4 } from './playerStatsLayout'
import { parsePlayerSavePerformance } from './playerStatsDat'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'
import type { PlayerRecord, PlayerSavePerformanceStats, PlayerStatsPerCompetitionRow } from './types'

/** Bump when field offsets or row-pick rules change. */
export const PLAYER_STATS_FIELD_MAP_VERSION = 2

/**
 * Byte offsets within a 128-byte row (grid V0, `player.dat` id @ 40).
 * Goals @ 51 (id+11) — rel 44 is the low byte of the magic int32 at id+4, not goals.
 */
export const PLAYER_STATS_FIELD_MAP_V0 = {
  competitionId: { rel: 8, type: 'int32' as const },
  goals: { rel: 51, type: 'u8' as const },
  apps: { rel: 52, type: 'u8' as const },
  assists: { rel: 53, type: 'u8' as const },
  /** Experimental: u8 10–100 interpreted as rating / 10 (6.0–10.0). */
  averageRating: { rel: 76, type: 'u8' as const, scale: 0.1 as const },
  tackles: { rel: 115, type: 'u8' as const },
  headers: { rel: 116, type: 'u8' as const },
  passes: { rel: 117, type: 'u8' as const },
  playerDatId: { rel: 40, type: 'int32' as const },
} as const

const F = PLAYER_STATS_FIELD_MAP_V0
const GRID = PLAYER_STATS_RESEARCH_GRID_V0

/** int32 @ rel 8 is not a reliable competition key — used only with heavy filtering. */
const BOGUS_COMP_NAME =
  /\b(manager|award|month|year|of the year|of the month)\b|trophy|gala|vote/i

export function isBogusCompetitionLabel(name: string): boolean {
  return BOGUS_COMP_NAME.test(name)
}

export function isPlausibleGridStatRow(r: DecodedPlayerStatsGridRow): boolean {
  const apps = r.apps ?? 0
  const goals = r.goals ?? 0
  const ast = r.assists ?? 0
  if (apps > 120 || goals > 120 || ast > 80) return false
  if (apps > 0 && goals > apps) return false
  if (apps > 0 && ast > apps) return false
  return r.apps != null || r.goals != null || r.assists != null
}

function readU8(buf: Buffer, rowStart: number, rel: number): number | null {
  const i = rowStart + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function readI32(buf: Buffer, rowStart: number, rel: number): number | null {
  const i = rowStart + rel
  if (i < 0 || i + 4 > buf.length) return null
  return buf.readInt32LE(i)
}

function plausibleU8Stat(v: number | null, max: number): v is number {
  return v != null && v >= 0 && v <= max
}

function decodeAverageRatingU8(v: number | null): number | null {
  if (v == null || v < 10 || v > 100) return null
  return Math.round(v * F.averageRating.scale * 100) / 100
}

export interface DecodedPlayerStatsGridRow {
  rowStart: number
  playerDatId: number
  competitionId: number | null
  apps: number | null
  goals: number | null
  assists: number | null
  averageRating: number | null
  tackles: number | null
  passes: number | null
  headers: number | null
}

/** Decode one 128-byte row using field map V0 (no competition name). */
export function decodePlayerStatsGridRow(
  buf: Buffer,
  rowStart: number,
  g: PlayerStatsResearchGrid = GRID,
): DecodedPlayerStatsGridRow | null {
  if (rowStart + g.stride > buf.length) return null
  const playerDatId = readI32(buf, rowStart, F.playerDatId.rel)
  if (playerDatId == null) return null

  const goals = readU8(buf, rowStart, F.goals.rel)
  const apps = readU8(buf, rowStart, F.apps.rel)
  const assists = readU8(buf, rowStart, F.assists.rel)

  return {
    rowStart,
    playerDatId,
    competitionId: readI32(buf, rowStart, F.competitionId.rel),
    apps: plausibleU8Stat(apps, 120) ? apps : null,
    goals: plausibleU8Stat(goals, 120) ? goals : null,
    assists: plausibleU8Stat(assists, 80) ? assists : null,
    averageRating: decodeAverageRatingU8(readU8(buf, rowStart, F.averageRating.rel)),
    tackles: plausibleU8Stat(readU8(buf, rowStart, F.tackles.rel), 200) ? readU8(buf, rowStart, F.tackles.rel) : null,
    passes: plausibleU8Stat(readU8(buf, rowStart, F.passes.rel), 500) ? readU8(buf, rowStart, F.passes.rel) : null,
    headers: plausibleU8Stat(readU8(buf, rowStart, F.headers.rel), 200) ? readU8(buf, rowStart, F.headers.rel) : null,
  }
}

function rowHasAnyStat(r: DecodedPlayerStatsGridRow): boolean {
  return (
    r.apps != null ||
    r.goals != null ||
    r.assists != null ||
    r.averageRating != null ||
    r.tackles != null ||
    r.passes != null ||
    r.headers != null
  )
}

export function competitionNameForId(
  competitionId: number | null,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): string {
  if (competitionId == null) return 'Unknown competition'
  if (competitionId === 0) return 'Unknown competition'
  const cc = clubCompsById?.get(competitionId)
  if (cc) {
    const n = (cc.name ?? '').trim() || (cc.shortName ?? '').trim()
    if (n) return n
  }
  const sc = staffCompsById?.get(competitionId)
  if (sc) {
    const n = (sc.name ?? '').trim() || (sc.shortName ?? '').trim()
    if (n) return n
  }
  return `Competition #${competitionId}`
}

function isTrustedCompetitionId(
  competitionId: number | null,
  playerDatId: number,
  competitionName: string,
): boolean {
  if (competitionId == null || competitionId === 0) return false
  if (competitionId === playerDatId) return false
  if (isBogusCompetitionLabel(competitionName)) return false
  return true
}

function scoreSeasonRow(
  r: DecodedPlayerStatsGridRow,
  divCompId: number | undefined,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): number {
  if (!isPlausibleGridStatRow(r)) return -1
  const name = competitionNameForId(r.competitionId, clubCompsById, staffCompsById)
  if (r.competitionId != null && r.competitionId === r.playerDatId) return -1
  if (isBogusCompetitionLabel(name)) return -1

  let score = 0
  const apps = r.apps ?? 0
  const goals = r.goals ?? 0
  score += apps * 3 + goals + (r.assists ?? 0) * 2
  if (divCompId != null && r.competitionId === divCompId) score += 10_000
  if (r.competitionId != null && isTrustedCompetitionId(r.competitionId, r.playerDatId, name)) {
    score += 200
  }
  return score
}

/** Pick the grid row most likely to be current-season league stats (not max-apps noise). */
export function pickBestSeasonGridRow(
  rows: DecodedPlayerStatsGridRow[],
  divCompId: number | undefined,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): DecodedPlayerStatsGridRow | null {
  let best: DecodedPlayerStatsGridRow | null = null
  let bestScore = -1
  for (const r of rows) {
    const s = scoreSeasonRow(r, divCompId, clubCompsById, staffCompsById)
    if (s > bestScore) {
      bestScore = s
      best = r
    }
  }
  return best
}

function toPerCompRow(
  r: DecodedPlayerStatsGridRow,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): PlayerStatsPerCompetitionRow | null {
  if (!rowHasAnyStat(r) || !isPlausibleGridStatRow(r)) return null
  const cid = r.competitionId ?? 0
  const name = competitionNameForId(r.competitionId, clubCompsById, staffCompsById)
  if (!isTrustedCompetitionId(r.competitionId, r.playerDatId, name)) return null
  return {
    competitionId: cid,
    competitionName: name,
    apps: r.apps ?? 0,
    goals: r.goals ?? 0,
    assists: r.assists,
    averageRating: r.averageRating,
    tackles: r.tackles,
    passes: r.passes,
    headers: r.headers,
  }
}

function gridRowToSavePerformance(
  r: DecodedPlayerStatsGridRow,
  displayCompetitionId?: number | null,
): PlayerSavePerformanceStats {
  return {
    apps: r.apps,
    goals: r.goals,
    assists: r.assists,
    averageRating: r.averageRating,
    tackles: r.tackles,
    passes: r.passes,
    headers: r.headers,
    layout: 'gridV0',
    competitionId: displayCompetitionId ?? r.competitionId,
  }
}

/** `player.dat` id → employer `club.dat` id (first linked staff row). */
export function buildPlayerDatIdToClubId(
  players: readonly { id: number }[],
  staff: readonly { player_id: number; club_job_id: number }[],
): Map<number, number> {
  const out = new Map<number, number>()
  for (const s of staff) {
    if (s.player_id < 0 || s.player_id >= players.length) continue
    const pid = players[s.player_id]!.id
    if (!out.has(pid)) out.set(pid, s.club_job_id)
  }
  return out
}

/** Per-competition rows: member division only, or synthetic division row from best season stats. */
export function buildMemberPerCompetitionRows(
  decodedRows: DecodedPlayerStatsGridRow[],
  best: DecodedPlayerStatsGridRow | null,
  playerDatId: number,
  divCompId: number | undefined,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): PlayerStatsPerCompetitionRow[] {
  const out: PlayerStatsPerCompetitionRow[] = []
  if (divCompId != null && divCompId !== 0) {
    for (const r of decodedRows) {
      if (r.competitionId !== divCompId) continue
      const row = toPerCompRow(r, clubCompsById, staffCompsById)
      if (row) out.push(row)
    }
  }

  if (out.length === 0 && best && divCompId != null && divCompId !== 0) {
    const name = competitionNameForId(divCompId, clubCompsById, staffCompsById)
    if (!isBogusCompetitionLabel(name)) {
      out.push({
        competitionId: divCompId,
        competitionName: name,
        apps: best.apps ?? 0,
        goals: best.goals ?? 0,
        assists: best.assists,
        averageRating: best.averageRating,
        tackles: best.tackles,
        passes: best.passes,
        headers: best.headers,
      })
    }
  }

  const byComp = new Map<number, PlayerStatsPerCompetitionRow>()
  for (const r of out) {
    const prev = byComp.get(r.competitionId)
    if (!prev || r.apps > prev.apps) byComp.set(r.competitionId, r)
  }
  return [...byComp.values()].sort((a, b) => a.competitionName.localeCompare(b.competitionName))
}

export interface PlayerStatsSaveParseContext {
  clubCompsById?: Map<number, ClubCompRecord>
  staffCompsById?: Map<number, StaffCompRecord>
  clubDivisionCompIdByClubId: Map<number, number>
}

export interface PlayerStatsSaveParseResult {
  byPlayerDatId: Map<number, PlayerSavePerformanceStats>
  perCompByPlayerDatId: Map<number, PlayerStatsPerCompetitionRow[]>
}

function mergeHeuristicGoals(
  grid: PlayerSavePerformanceStats,
  heuristic: PlayerSavePerformanceStats,
): PlayerSavePerformanceStats {
  const gGoals = grid.goals
  const hGoals = heuristic.goals
  if (
    gGoals != null &&
    hGoals != null &&
    gGoals > hGoals &&
    (grid.apps ?? 0) <= 20 &&
    gGoals > (grid.apps ?? 0)
  ) {
    return { ...grid, goals: hGoals, layout: 'gridV0' }
  }
  return grid
}

/**
 * Structured grid decode (Phase C) with heuristic v1 fallback for players with no grid row.
 */
export function parsePlayerStatsFromSave(
  buf: Buffer,
  players: readonly PlayerRecord[],
  staff: readonly { player_id: number; club_job_id: number }[],
  ctx: PlayerStatsSaveParseContext,
): PlayerStatsSaveParseResult {
  const playerIds = new Set(players.map((p) => p.id))
  const playerToClub = buildPlayerDatIdToClubId(players, staff)
  const byPlayer = new Map<number, PlayerSavePerformanceStats>()
  const perCompByPlayer = new Map<number, PlayerStatsPerCompetitionRow[]>()
  const rowsByPlayer = new Map<number, DecodedPlayerStatsGridRow[]>()

  for (const rowStart of iterPlayerStatsRowStarts(buf, GRID)) {
    if (!isEligibleResearchStatsRow(buf, rowStart, GRID, playerIds)) continue
    const idOff = rowStart + GRID.idOffsetInRow
    if (!plausiblePlayerStatsInt32AtPlus4(buf.readInt32LE(idOff + 4))) continue
    const decoded = decodePlayerStatsGridRow(buf, rowStart)
    if (!decoded || !rowHasAnyStat(decoded)) continue
    const list = rowsByPlayer.get(decoded.playerDatId) ?? []
    list.push(decoded)
    rowsByPlayer.set(decoded.playerDatId, list)
  }

  const heuristic = parsePlayerSavePerformance(buf, players)

  for (const [playerDatId, decodedRows] of rowsByPlayer) {
    const clubId = playerToClub.get(playerDatId)
    const divCompId =
      clubId != null ? ctx.clubDivisionCompIdByClubId.get(clubId) : undefined
    const best = pickBestSeasonGridRow(
      decodedRows,
      divCompId,
      ctx.clubCompsById,
      ctx.staffCompsById,
    )
    if (best) {
      let perf = gridRowToSavePerformance(best, divCompId ?? best.competitionId)
      const h = heuristic.get(playerDatId)
      if (h) perf = mergeHeuristicGoals(perf, h)
      byPlayer.set(playerDatId, perf)
    }

    const memberRows = buildMemberPerCompetitionRows(
      decodedRows,
      best,
      playerDatId,
      divCompId,
      ctx.clubCompsById,
      ctx.staffCompsById,
    )
    if (memberRows.length) perCompByPlayer.set(playerDatId, memberRows)
  }

  for (const [id, h] of heuristic) {
    if (!byPlayer.has(id)) byPlayer.set(id, h)
  }

  return { byPlayerDatId: byPlayer, perCompByPlayerDatId: perCompByPlayer }
}
