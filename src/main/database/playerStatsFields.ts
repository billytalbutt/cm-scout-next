/**
 * Phase C — fixed field map on 128-byte `player stats.dat` rows (grid V0).
 * Research mode: expose every decoded row in the profile table for CM comparison.
 * Summary line (`savePerformance`) uses heuristic v1 only — not grid “primary” picks.
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

export const PLAYER_STATS_FIELD_MAP_VERSION = 1

/** Byte offsets within a 128-byte row (grid V0, `player.dat` id @ 40). */
export const PLAYER_STATS_FIELD_MAP_V0 = {
  competitionId: { rel: 8, type: 'int32' as const },
  goals: { rel: 44, type: 'u8' as const },
  apps: { rel: 52, type: 'u8' as const },
  assists: { rel: 53, type: 'u8' as const },
  averageRating: { rel: 76, type: 'u8' as const, scale: 0.1 as const },
  tackles: { rel: 115, type: 'u8' as const },
  headers: { rel: 116, type: 'u8' as const },
  passes: { rel: 117, type: 'u8' as const },
  playerDatId: { rel: 40, type: 'int32' as const },
} as const

const F = PLAYER_STATS_FIELD_MAP_V0
const GRID = PLAYER_STATS_RESEARCH_GRID_V0

/** Shown in profile table for heuristic-only players (not a real competition id). */
export const PLAYER_STATS_HEURISTIC_RESEARCH_COMP_ID = -2

const MAX_RESEARCH_ROWS_PER_PLAYER = 48

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

function competitionName(
  competitionId: number | null,
  playerDatId: number,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): string {
  if (competitionId == null) return 'Unknown competition'
  if (competitionId === 0) return 'Unknown competition (id 0)'
  if (competitionId === playerDatId) {
    return `Label collision (comp id = player id ${playerDatId})`
  }
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

function toResearchGridRow(
  r: DecodedPlayerStatsGridRow,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): PlayerStatsPerCompetitionRow | null {
  if (!rowHasAnyStat(r)) return null
  const baseName = competitionName(r.competitionId, r.playerDatId, clubCompsById, staffCompsById)
  return {
    competitionId: r.competitionId ?? 0,
    competitionName: `${baseName} · grid @${r.rowStart}`,
    apps: r.apps ?? 0,
    goals: r.goals ?? 0,
    assists: r.assists,
    averageRating: r.averageRating,
    tackles: r.tackles,
    passes: r.passes,
    headers: r.headers,
  }
}

function heuristicResearchRow(h: PlayerSavePerformanceStats): PlayerStatsPerCompetitionRow | null {
  const hasAny = h.apps != null || h.goals != null || h.assists != null
  if (!hasAny) return null
  return {
    competitionId: PLAYER_STATS_HEURISTIC_RESEARCH_COMP_ID,
    competitionName: `Heuristic v1 (${h.layout})`,
    apps: h.apps ?? 0,
    goals: h.goals ?? 0,
    assists: h.assists,
    averageRating: h.averageRating ?? null,
    tackles: h.tackles ?? null,
    passes: h.passes ?? null,
    headers: h.headers ?? null,
  }
}

/** All grid rows for one player (no dedupe) — for side-by-side CM verification. */
export function buildResearchPerCompetitionRows(
  decodedRows: DecodedPlayerStatsGridRow[],
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): PlayerStatsPerCompetitionRow[] {
  const out: PlayerStatsPerCompetitionRow[] = []
  for (const r of decodedRows) {
    const row = toResearchGridRow(r, clubCompsById, staffCompsById)
    if (row) out.push(row)
  }
  out.sort((a, b) => {
    if (b.apps !== a.apps) return b.apps - a.apps
    return a.competitionName.localeCompare(b.competitionName)
  })
  return out.slice(0, MAX_RESEARCH_ROWS_PER_PLAYER)
}

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

export interface PlayerStatsSaveParseContext {
  clubCompsById?: Map<number, ClubCompRecord>
  staffCompsById?: Map<number, StaffCompRecord>
  clubDivisionCompIdByClubId: Map<number, number>
}

export interface PlayerStatsSaveParseResult {
  byPlayerDatId: Map<number, PlayerSavePerformanceStats>
  perCompByPlayerDatId: Map<number, PlayerStatsPerCompetitionRow[]>
}

/**
 * Grid rows → research table per player. Heuristic v1 → summary map + extra table row when useful.
 */
export function parsePlayerStatsFromSave(
  buf: Buffer,
  players: readonly PlayerRecord[],
  staff: readonly { player_id: number; club_job_id: number }[],
  ctx: PlayerStatsSaveParseContext,
): PlayerStatsSaveParseResult {
  const playerIds = new Set(players.map((p) => p.id))
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

  for (const [playerDatId, decodedRows] of rowsByPlayer) {
    const research = buildResearchPerCompetitionRows(
      decodedRows,
      ctx.clubCompsById,
      ctx.staffCompsById,
    )
    if (research.length) perCompByPlayer.set(playerDatId, research)
  }

  const byPlayer = new Map<number, PlayerSavePerformanceStats>()
  const heuristic = parsePlayerSavePerformance(buf, players)
  for (const [id, h] of heuristic) {
    byPlayer.set(id, h)
    const research = perCompByPlayer.get(id) ?? []
    const hRow = heuristicResearchRow(h)
    if (hRow) {
      const merged = [...research, hRow]
      perCompByPlayer.set(id, merged)
    } else if (!research.length && hRow) {
      perCompByPlayer.set(id, [hRow])
    }
  }

  return { byPlayerDatId: byPlayer, perCompByPlayerDatId: perCompByPlayer }
}
