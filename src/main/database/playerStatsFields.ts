/**
 * Phase C — fixed field map on 128-byte `player stats.dat` rows (grid V0).
 * Research mode: expose every decoded row in the profile table for CM comparison.
 * Summary line (`savePerformance`) uses heuristic v1 only — not grid “primary” picks.
 */

import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  type PlayerStatsResearchGrid,
  iterPlayerStatsRowStarts,
} from './playerStatsJoins'
import { collectPlayerDatIdOccurrences, parsePlayerSavePerformance } from './playerStatsDat'
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
/** Skip off-grid scan when id appears everywhere in the blob (dense `player.dat` ids). */
const MAX_OFFGRID_ID_OCCURRENCES = 16

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
  /** Buffer offset of this player's `player.dat` id (int32); may be off the 128-byte grid. */
  idAnchor?: number
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

/** When comp tables are loaded, only keep rows whose competition id resolves in save data. */
export function shouldGateResearchRowsByCompetition(
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): boolean {
  return (clubCompsById?.size ?? 0) > 0 || (staffCompsById?.size ?? 0) > 0
}

/** Competition id must map to `club_comp.dat` or `staff_comp.dat` (not 0 / player id / unknown). */
export function isResolvedCompetitionId(
  competitionId: number | null,
  playerDatId: number,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): boolean {
  if (competitionId == null || competitionId <= 0) return false
  if (competitionId === playerDatId) return false
  return (
    (clubCompsById?.has(competitionId) ?? false) || (staffCompsById?.has(competitionId) ?? false)
  )
}

function isGridAlignedRowStart(rowStart: number, g: PlayerStatsResearchGrid = GRID): boolean {
  return rowStart >= g.headerBytes && (rowStart - g.headerBytes) % g.stride === 0
}

function researchRowRank(r: DecodedPlayerStatsGridRow, g: PlayerStatsResearchGrid = GRID): number {
  let score = (r.apps ?? 0) * 10 + (r.goals ?? 0) * 5 + (r.assists ?? 0)
  if (isGridAlignedRowStart(r.rowStart, g)) score += 10_000
  return score
}

/** One row per resolved competition id — prefer grid-aligned, then higher apps. */
export function dedupeResearchRowsByCompetition(
  rows: readonly DecodedPlayerStatsGridRow[],
  g: PlayerStatsResearchGrid = GRID,
): DecodedPlayerStatsGridRow[] {
  const byComp = new Map<number, DecodedPlayerStatsGridRow>()
  for (const r of rows) {
    if (r.competitionId == null) continue
    const existing = byComp.get(r.competitionId)
    if (!existing || researchRowRank(r, g) > researchRowRank(existing, g)) {
      byComp.set(r.competitionId, r)
    }
  }
  return [...byComp.values()]
}

export function filterDecodedRowsWithResolvedCompetition(
  rows: readonly DecodedPlayerStatsGridRow[],
  playerDatId: number,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
  options?: { dedupeByCompetition?: boolean },
): DecodedPlayerStatsGridRow[] {
  if (!shouldGateResearchRowsByCompetition(clubCompsById, staffCompsById)) {
    return [...rows]
  }
  const filtered = rows.filter((r) =>
    isResolvedCompetitionId(r.competitionId, playerDatId, clubCompsById, staffCompsById),
  )
  if (options?.dedupeByCompetition === false) return filtered
  return dedupeResearchRowsByCompetition(filtered)
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

function researchRowLocationTag(r: DecodedPlayerStatsGridRow, g = GRID): string {
  const anchor = r.idAnchor ?? r.rowStart + g.idOffsetInRow
  const aligned =
    r.rowStart >= g.headerBytes && (r.rowStart - g.headerBytes) % g.stride === 0
  if (aligned) return `grid @${r.rowStart}`
  return `id @${anchor} (off-grid, row ${r.rowStart})`
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
    competitionName: `${baseName} · ${researchRowLocationTag(r)}`,
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

/**
 * Every research row for one player: grid-aligned slots first; if none, decode at each
 * `player.dat` id occurrence using the same V0 field map (off-grid anchors).
 */
export function collectResearchGridRowsForPlayer(
  buf: Buffer,
  playerDatId: number,
  playerIds: ReadonlySet<number>,
  g: PlayerStatsResearchGrid = GRID,
  knownIdOccurrences?: readonly number[],
  compCtx?: Pick<PlayerStatsSaveParseContext, 'clubCompsById' | 'staffCompsById'>,
): DecodedPlayerStatsGridRow[] {
  const byRowStart = new Map<number, DecodedPlayerStatsGridRow>()

  for (const rowStart of iterPlayerStatsRowStarts(buf, g)) {
    if (buf.readInt32LE(rowStart + g.idOffsetInRow) !== playerDatId) continue
    const decoded = decodePlayerStatsGridRow(buf, rowStart)
    if (!decoded || !rowHasAnyStat(decoded)) continue
    byRowStart.set(rowStart, { ...decoded, idAnchor: rowStart + g.idOffsetInRow })
  }

  if (byRowStart.size === 0) {
    const occ =
      knownIdOccurrences ??
      collectPlayerDatIdOccurrences(buf, playerIds).get(playerDatId) ??
      []
    if (occ.length > MAX_OFFGRID_ID_OCCURRENCES) return []
    for (const anchor of occ) {
      const rowStart = anchor - g.idOffsetInRow
      if (rowStart < 0 || rowStart + g.stride > buf.length) continue
      if (byRowStart.has(rowStart)) continue
      const decoded = decodePlayerStatsGridRow(buf, rowStart)
      if (!decoded || decoded.playerDatId !== playerDatId) continue
      if (!rowHasAnyStat(decoded)) continue
      byRowStart.set(rowStart, { ...decoded, idAnchor: anchor })
    }
  }

  const raw = [...byRowStart.values()].sort((a, b) => a.rowStart - b.rowStart)
  return filterDecodedRowsWithResolvedCompetition(
    raw,
    playerDatId,
    compCtx?.clubCompsById,
    compCtx?.staffCompsById,
  )
}

/** Research table rows — gated on resolved competition id, deduped per competition. */
export function buildResearchPerCompetitionRows(
  decodedRows: DecodedPlayerStatsGridRow[],
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
  playerDatId?: number,
): PlayerStatsPerCompetitionRow[] {
  const gated =
    playerDatId != null
      ? filterDecodedRowsWithResolvedCompetition(
          decodedRows,
          playerDatId,
          clubCompsById,
          staffCompsById,
        )
      : decodedRows
  const out: PlayerStatsPerCompetitionRow[] = []
  for (const r of gated) {
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

/** `off` = instant (profile uses staff_history). `research` = full grid scan (slow on large saves). */
export type PlayerStatsParseMode = 'off' | 'heuristic' | 'research'

const EMPTY_PLAYER_STATS_PARSE: PlayerStatsSaveParseResult = {
  byPlayerDatId: new Map(),
  perCompByPlayerDatId: new Map(),
}

/**
 * Decode `player stats.dat`. Default `off` — do not run on every Load Database (multi‑MB scan + per‑player grid walks).
 */
export function parsePlayerStatsFromSave(
  buf: Buffer,
  players: readonly PlayerRecord[],
  staff: readonly { player_id: number; club_job_id: number }[],
  ctx: PlayerStatsSaveParseContext,
  mode: PlayerStatsParseMode = 'off',
): PlayerStatsSaveParseResult {
  if (mode === 'off' || !buf.length) return EMPTY_PLAYER_STATS_PARSE

  if (mode === 'heuristic') {
    return {
      byPlayerDatId: parsePlayerSavePerformance(buf, players),
      perCompByPlayerDatId: new Map(),
    }
  }

  const playerIds = new Set(players.map((p) => p.id))
  const perCompByPlayer = new Map<number, PlayerStatsPerCompetitionRow[]>()
  const rowsByPlayer = new Map<number, DecodedPlayerStatsGridRow[]>()
  const occById = collectPlayerDatIdOccurrences(buf, playerIds)

  for (const rowStart of iterPlayerStatsRowStarts(buf, GRID)) {
    const playerDatId = readI32(buf, rowStart, F.playerDatId.rel)
    if (playerDatId == null || !playerIds.has(playerDatId)) continue
    const decoded = decodePlayerStatsGridRow(buf, rowStart)
    if (!decoded || !rowHasAnyStat(decoded)) continue
    const list = rowsByPlayer.get(playerDatId) ?? []
    list.push({ ...decoded, idAnchor: rowStart + GRID.idOffsetInRow })
    rowsByPlayer.set(playerDatId, list)
  }

  for (const [playerDatId, occ] of occById) {
    if (rowsByPlayer.get(playerDatId)?.length) continue
    if (!occ.length || occ.length > MAX_OFFGRID_ID_OCCURRENCES) continue
    const fallback = collectResearchGridRowsForPlayer(buf, playerDatId, playerIds, GRID, occ, {
      clubCompsById: ctx.clubCompsById,
      staffCompsById: ctx.staffCompsById,
    })
    if (fallback.length) rowsByPlayer.set(playerDatId, fallback)
  }

  if (shouldGateResearchRowsByCompetition(ctx.clubCompsById, ctx.staffCompsById)) {
    for (const [playerDatId, list] of rowsByPlayer) {
      const gated = filterDecodedRowsWithResolvedCompetition(
        list,
        playerDatId,
        ctx.clubCompsById,
        ctx.staffCompsById,
      )
      if (gated.length) rowsByPlayer.set(playerDatId, gated)
      else rowsByPlayer.delete(playerDatId)
    }
  }

  for (const [playerDatId, decodedRows] of rowsByPlayer) {
    const research = buildResearchPerCompetitionRows(
      decodedRows,
      ctx.clubCompsById,
      ctx.staffCompsById,
      playerDatId,
    )
    if (research.length) perCompByPlayer.set(playerDatId, research)
  }

  const byPlayer = new Map<number, PlayerSavePerformanceStats>()
  const heuristic = parsePlayerSavePerformance(buf, players)
  for (const [id, h] of heuristic) {
    byPlayer.set(id, h)
    const research = perCompByPlayer.get(id) ?? []
    const hRow = heuristicResearchRow(h)
    if (hRow && !research.length) {
      perCompByPlayer.set(id, [hRow])
    }
  }

  return { byPlayerDatId: byPlayer, perCompByPlayerDatId: perCompByPlayer }
}
