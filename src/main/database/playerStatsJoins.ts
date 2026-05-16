/**
 * Phase B — join keys for `player stats.dat` rows (research).
 * Assumes a fixed grid from Phase A (`PLAYER_STATS_RESEARCH_GRID_V0`); results are
 * evidence only until UI goldens confirm.
 */

import { plausiblePlayerStatsInt32AtPlus4 } from './playerStatsLayout'

export interface PlayerStatsResearchGrid {
  headerBytes: number
  stride: number
  /** Byte offset within each row where `player.dat` row id lives (int32 LE). */
  idOffsetInRow: number
}

/**
 * Blackburn uncompressed (Phase A); re-validate on other saves before production use.
 */
export const PLAYER_STATS_RESEARCH_GRID_V0: PlayerStatsResearchGrid = {
  headerBytes: 60,
  stride: 128,
  idOffsetInRow: 40,
}

export function* iterPlayerStatsRowStarts(buf: Buffer, g: PlayerStatsResearchGrid): Generator<number> {
  for (let o = g.headerBytes; o + g.stride <= buf.length; o += g.stride) {
    yield o
  }
}

export function isEligibleResearchStatsRow(
  buf: Buffer,
  rowStart: number,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
): boolean {
  const idOff = rowStart + g.idOffsetInRow
  if (idOff + 8 > buf.length) return false
  const id = buf.readInt32LE(idOff)
  if (!playerIds.has(id)) return false
  return plausiblePlayerStatsInt32AtPlus4(buf.readInt32LE(idOff + 4))
}

function skipInt32Rel(rel: number, g: PlayerStatsResearchGrid): boolean {
  return rel >= g.idOffsetInRow && rel < g.idOffsetInRow + 8
}

export function listEligibleRowStarts(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  maxRows = 80_000,
): number[] {
  const out: number[] = []
  for (const rowStart of iterPlayerStatsRowStarts(buf, g)) {
    if (!isEligibleResearchStatsRow(buf, rowStart, g, playerIds)) continue
    out.push(rowStart)
    if (out.length >= maxRows) break
  }
  return out
}

/** `player.dat` row id → one `staff.dat` id (first staff row linked to that player slot). */
export function buildPlayerDatIdToStaffId(
  players: readonly { id: number }[],
  staff: readonly { id: number; player_id: number }[],
): Map<number, number> {
  const out = new Map<number, number>()
  for (const s of staff) {
    if (s.player_id < 0 || s.player_id >= players.length) continue
    const pid = players[s.player_id]!.id
    if (!out.has(pid)) out.set(pid, s.id)
  }
  return out
}

export interface RankedFieldOffset {
  rel: number
  matches: number
  eligibleRows: number
  /** matches / eligibleRows */
  rate: number
}

/**
 * Among rows that pass `isEligibleResearchStatsRow`, count how often `readInt32LE(row+rel)`
 * is in `targetIds` (e.g. `club_comp` ids). Skips the id and +4 magic dword.
 */
export function rankInt32OffsetsAgainstIdSet(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  targetIds: ReadonlySet<number>,
  maxEligibleRows = 25_000,
): RankedFieldOffset[] {
  const eligible = listEligibleRowStarts(buf, g, playerIds, maxEligibleRows)
  const eligibleRows = eligible.length
  if (eligibleRows < 1) return []

  const matchAtRel = new Map<number, number>()
  for (let rel = 0; rel <= g.stride - 4; rel += 4) {
    if (skipInt32Rel(rel, g)) continue
    matchAtRel.set(rel, 0)
  }

  for (const rowStart of eligible) {
    for (let rel = 0; rel <= g.stride - 4; rel += 4) {
      if (skipInt32Rel(rel, g)) continue
      const v = buf.readInt32LE(rowStart + rel)
      if (!targetIds.has(v)) continue
      matchAtRel.set(rel, (matchAtRel.get(rel) ?? 0) + 1)
    }
  }

  const ranked: RankedFieldOffset[] = []
  for (const [rel, matches] of matchAtRel) {
    ranked.push({ rel, matches, eligibleRows, rate: matches / eligibleRows })
  }
  ranked.sort((a, b) => b.matches - a.matches || b.rate - a.rate)
  return ranked
}

/**
 * Among eligible rows, count rows where `readInt32LE(row+rel) === staffId` for the
 * staff row tied to this row's `player.dat` id (via `buildPlayerDatIdToStaffId`).
 */
export function rankInt32OffsetsForStaffIdJoin(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  playerDatIdToStaffId: ReadonlyMap<number, number>,
  maxEligibleRows = 25_000,
): RankedFieldOffset[] {
  const eligible = listEligibleRowStarts(buf, g, playerIds, maxEligibleRows)
  const eligibleRows = eligible.length
  if (eligibleRows < 1) return []

  const matchAtRel = new Map<number, number>()
  for (let rel = 0; rel <= g.stride - 4; rel += 4) {
    if (skipInt32Rel(rel, g)) continue
    matchAtRel.set(rel, 0)
  }

  for (const rowStart of eligible) {
    const idOff = rowStart + g.idOffsetInRow
    const pid = buf.readInt32LE(idOff)
    const staffId = playerDatIdToStaffId.get(pid)
    if (staffId === undefined) continue
    for (let rel = 0; rel <= g.stride - 4; rel += 4) {
      if (skipInt32Rel(rel, g)) continue
      if (buf.readInt32LE(rowStart + rel) !== staffId) continue
      matchAtRel.set(rel, (matchAtRel.get(rel) ?? 0) + 1)
    }
  }

  const ranked: RankedFieldOffset[] = []
  for (const [rel, matches] of matchAtRel) {
    ranked.push({ rel, matches, eligibleRows, rate: matches / eligibleRows })
  }
  ranked.sort((a, b) => b.matches - a.matches || b.rate - a.rate)
  return ranked
}

export interface RowsPerPlayerSummary {
  /** player.dat id → number of eligible structured rows */
  counts: Map<number, number>
  eligibleRows: number
  distinctPlayers: number
  maxRowsForOnePlayer: number
}

export function summarizeRowsPerPlayerDatId(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  maxEligibleRows = 100_000,
): RowsPerPlayerSummary {
  const eligible = listEligibleRowStarts(buf, g, playerIds, maxEligibleRows)
  const counts = new Map<number, number>()
  let maxRowsForOnePlayer = 0
  for (const rowStart of eligible) {
    const pid = buf.readInt32LE(rowStart + g.idOffsetInRow)
    const n = (counts.get(pid) ?? 0) + 1
    counts.set(pid, n)
    if (n > maxRowsForOnePlayer) maxRowsForOnePlayer = n
  }
  return {
    counts,
    eligibleRows: eligible.length,
    distinctPlayers: counts.size,
    maxRowsForOnePlayer,
  }
}

/** All row starts (structured grid) where this `player.dat` id appears in an eligible row. */
export function listEligibleRowStartsForPlayerDatId(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  playerDatId: number,
  maxRows = 500,
): number[] {
  const out: number[] = []
  for (const rowStart of iterPlayerStatsRowStarts(buf, g)) {
    if (!isEligibleResearchStatsRow(buf, rowStart, g, playerIds)) continue
    if (buf.readInt32LE(rowStart + g.idOffsetInRow) !== playerDatId) continue
    out.push(rowStart)
    if (out.length >= maxRows) break
  }
  return out
}

/**
 * For one int32 column offset, classify values against `club_comp` and `staff_comp` id sets
 * (many ids can appear in both sets by coincidence — use `inBoth` as a warning signal).
 */
export function summarizeInt32AtOffsetAgainstClubAndStaffComp(
  buf: Buffer,
  g: PlayerStatsResearchGrid,
  playerIds: ReadonlySet<number>,
  rel: number,
  clubCompIds: ReadonlySet<number>,
  staffCompIds: ReadonlySet<number>,
  maxEligibleRows = 25_000,
): {
  eligibleRows: number
  inClubOnly: number
  inStaffCompOnly: number
  inBoth: number
  inNeither: number
} {
  const eligible = listEligibleRowStarts(buf, g, playerIds, maxEligibleRows)
  if (rel < 0 || rel + 4 > g.stride) {
    return { eligibleRows: eligible.length, inClubOnly: 0, inStaffCompOnly: 0, inBoth: 0, inNeither: 0 }
  }
  let inClubOnly = 0
  let inStaffCompOnly = 0
  let inBoth = 0
  let inNeither = 0
  for (const rowStart of eligible) {
    const v = buf.readInt32LE(rowStart + rel)
    const c = clubCompIds.has(v)
    const s = staffCompIds.has(v)
    if (c && s) inBoth++
    else if (c) inClubOnly++
    else if (s) inStaffCompOnly++
    else inNeither++
  }
  return {
    eligibleRows: eligible.length,
    inClubOnly,
    inStaffCompOnly,
    inBoth,
    inNeither,
  }
}
