/**
 * Current-season per-competition stats from live `player stats.dat` (CM “staff comp history” slice).
 * Not stored in static `player.dat` / `staff.dat` — only in the save stream.
 */

import {
  buildCompetitionNamesById,
  competitionNameFromMaps,
  isKnownCompetitionId,
  type CompetitionNamesById,
} from './competitionNames'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'
import {
  decodePlayerStatsGridRow,
  dedupeResearchRowsByCompetition,
  type DecodedPlayerStatsGridRow,
} from './playerStatsFields'
import { buildPlayerDatIdToStaffId, iterPlayerStatsRowStarts, PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import type { StaffHistoryRecord } from './staffHistory'
import type { PlayerRecord, PlayerStatsPerCompetitionRow, StaffRecord } from './types'

/** One competition row for the active season (`player stats.dat` grid, keyed by `staff.dat` id). */
export interface StaffCompHistoryRecord {
  staffId: number
  competitionId: number
  apps: number
  goals: number
  assists: number
  /** Match average (e.g. 7.85), not the stored integer ×100. */
  averageRating: number | null
}

export interface StaffCompSeasonTotals {
  apps: number
  goals: number
  assists: number
  averageRating: number | null
}

const MAX_COMP_ROWS_PER_STAFF = 20
const MAX_SEASON_APPS = 55
const MAX_SEASON_GOALS = 50
const MAX_SEASON_ASSISTS = 40

function rowHasAnyStat(r: DecodedPlayerStatsGridRow): boolean {
  return (
    (r.apps != null && r.apps > 0) ||
    (r.goals != null && r.goals > 0) ||
    (r.assists != null && r.assists > 0) ||
    r.averageRating != null
  )
}

/** Drop grid false-positives: plausible single-season slice only. */
export function isPlausibleCompHistoryGridRow(r: DecodedPlayerStatsGridRow): boolean {
  if (r.competitionId == null || r.competitionId <= 0) return false
  const apps = r.apps ?? 0
  const goals = r.goals ?? 0
  const assists = r.assists ?? 0
  if (apps > MAX_SEASON_APPS || goals > MAX_SEASON_GOALS || assists > MAX_SEASON_ASSISTS) return false
  if (apps === 0 && goals === 0 && assists === 0) return false
  if (goals > apps + 5) return false
  if (assists > apps + 5) return false
  return true
}

function toStaffCompRecord(staffId: number, r: DecodedPlayerStatsGridRow): StaffCompHistoryRecord | null {
  if (r.competitionId == null || r.competitionId <= 0) return null
  const apps = r.apps ?? 0
  const goals = r.goals ?? 0
  const assists = r.assists ?? 0
  if (apps === 0 && goals === 0 && assists === 0 && r.averageRating == null) return null
  return {
    staffId,
    competitionId: r.competitionId,
    apps,
    goals,
    assists,
    averageRating: r.averageRating,
  }
}

/**
 * Single-pass index: `player stats.dat` grid rows → staff id (via `player.dat` id).
 * Mirrors OpenClaw “staff_comp_history” (competition id, apps, goals, assists, average rating).
 */
export function indexStaffCompHistoryFromPlayerStats(
  buf: Buffer,
  players: readonly PlayerRecord[],
  staff: readonly StaffRecord[],
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): Map<number, StaffCompHistoryRecord[]> {
  const competitionNames = buildCompetitionNamesById(clubCompsById, staffCompsById)
  const playerDatIdToStaffId = buildPlayerDatIdToStaffId(players, staff)
  const playerIds = new Set(players.map((p) => p.id))
  const rowsByPlayer = new Map<number, DecodedPlayerStatsGridRow[]>()
  const grid = PLAYER_STATS_RESEARCH_GRID_V0

  for (const rowStart of iterPlayerStatsRowStarts(buf, grid)) {
    const decoded = decodePlayerStatsGridRow(buf, rowStart, grid)
    if (!decoded || decoded.playerDatId <= 0 || !playerIds.has(decoded.playerDatId)) continue
    if (!rowHasAnyStat(decoded) || !isPlausibleCompHistoryGridRow(decoded)) continue
    if (!isKnownCompetitionId(decoded.competitionId, competitionNames, decoded.playerDatId)) continue
    const list = rowsByPlayer.get(decoded.playerDatId) ?? []
    list.push(decoded)
    rowsByPlayer.set(decoded.playerDatId, list)
  }

  const byStaffId = new Map<number, StaffCompHistoryRecord[]>()
  for (const [playerDatId, rawRows] of rowsByPlayer) {
    const staffId = playerDatIdToStaffId.get(playerDatId)
    if (staffId == null) continue
    const deduped = dedupeResearchRowsByCompetition(rawRows.filter(isPlausibleCompHistoryGridRow))
      .sort((a, b) => (b.apps ?? 0) - (a.apps ?? 0))
      .slice(0, MAX_COMP_ROWS_PER_STAFF)
    const out: StaffCompHistoryRecord[] = []
    for (const r of deduped) {
      const rec = toStaffCompRecord(staffId, r)
      if (rec) out.push(rec)
    }
    if (out.length) {
      out.sort((a, b) => a.competitionId - b.competitionId)
      byStaffId.set(staffId, out)
    }
  }
  return byStaffId
}

export function aggregateStaffCompSeasonTotals(rows: readonly StaffCompHistoryRecord[]): StaffCompSeasonTotals {
  let apps = 0
  let goals = 0
  let assists = 0
  let ratingSum = 0
  let ratingApps = 0
  for (const r of rows) {
    apps += r.apps
    goals += r.goals
    assists += r.assists
    if (r.averageRating != null && r.apps > 0) {
      ratingSum += r.apps * r.averageRating
      ratingApps += r.apps
    }
  }
  return {
    apps,
    goals,
    assists,
    averageRating: ratingApps > 0 ? Math.round((ratingSum / ratingApps) * 100) / 100 : null,
  }
}

export function staffCompHistoryToProfileRows(
  rows: readonly StaffCompHistoryRecord[],
  competitionNames: CompetitionNamesById,
  playerDatId?: number,
): PlayerStatsPerCompetitionRow[] {
  return rows.map((r) => ({
    competitionId: r.competitionId,
    competitionName: competitionNameFromMaps(r.competitionId, competitionNames, playerDatId),
    apps: r.apps,
    goals: r.goals,
    assists: r.assists,
    averageRating: r.averageRating,
    tackles: null,
    passes: null,
    headers: null,
  }))
}

/** `player.dat` id → per-competition profile rows (for existing profile IPC fields). */
/** Career = staff_history prior years + current season comp totals (avoids double-counting current SH row). */
export function computeCareerTotalsFromHistoryAndComp(
  hist: readonly StaffHistoryRecord[] | undefined,
  highlightHistoryYear: number | null,
  compTotals: StaffCompSeasonTotals,
  hasCompRows: boolean,
): { careerApps: number; careerGoals: number } {
  if (!hasCompRows) {
    let careerApps = 0
    let careerGoals = 0
    for (const h of hist ?? []) {
      careerApps += h.apps
      careerGoals += h.goals
    }
    return { careerApps, careerGoals }
  }
  let careerApps = 0
  let careerGoals = 0
  for (const h of hist ?? []) {
    if (highlightHistoryYear != null && h.year === highlightHistoryYear) continue
    careerApps += h.apps
    careerGoals += h.goals
  }
  careerApps += compTotals.apps
  careerGoals += compTotals.goals
  return { careerApps, careerGoals }
}

export function perCompRowsByPlayerDatId(
  byStaffId: Map<number, StaffCompHistoryRecord[]>,
  staff: readonly StaffRecord[],
  players: readonly PlayerRecord[],
  competitionNames: CompetitionNamesById,
): Map<number, PlayerStatsPerCompetitionRow[]> {
  const staffToPlayerDatId = new Map<number, number>()
  for (const s of staff) {
    if (s.player_id < 0 || s.player_id >= players.length) continue
    staffToPlayerDatId.set(s.id, players[s.player_id]!.id)
  }
  const out = new Map<number, PlayerStatsPerCompetitionRow[]>()
  for (const [staffId, rows] of byStaffId) {
    const playerDatId = staffToPlayerDatId.get(staffId)
    if (playerDatId == null) continue
    out.set(playerDatId, staffCompHistoryToProfileRows(rows, competitionNames, playerDatId))
  }
  return out
}
