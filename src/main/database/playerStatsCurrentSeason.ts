/**
 * CM History tab — current-season stats by scope (League / Cup / Continental / …).
 * Golden match: Joe Cole @ Blackburn save (Aug 2005).
 *
 * `player stats history.tmp` row (player.dat id @ +0):
 *   apps +4, goals +5, assists +6, scope category u8 @ +12
 *   scope: 1=Cup, 2=Continental, 3=League (4=Senior-club duplicate in history — prefer player stats.dat)
 *
 * `player stats.dat` embedded record (Cole-style, rec @ anchor−40):
 *   Senior club totals: apps +13, goals +26/+86, assists +30 (`readSummaryStatsAtAnchor`); subtract u8 +12 non-competitive apps when &lt; total
 *   Average rating: u16 ÷100 in record when present, else u8 +64 (÷10) — display with two decimals in UI
 *
 * Some saves also store `player.dat` id @ row+2 on 47-byte history rows (not only @+0).
 */

import {
  competitionNameFromMaps,
  isKnownCompetitionId,
  type CompetitionNamesById,
} from './competitionNames'
import { PLAYER_STATS_HISTORY_ROW_BYTES_CANDIDATE } from './playerStatsHistoryProbe'
import {
  buildSummaryAnchorIndex,
  embeddedIdRecordStart,
  mergeSeniorClubAppsAtAnchor,
  readEmbeddedIdRecordStats,
  readEmbeddedSeniorRating,
  readSeniorClubRatingAtAnchor,
  readSummaryStatsAtAnchor,
  type SummaryAnchorIndex,
} from './playerStatsSummary'
import { pickPlayerStatsAnchor } from './playerStatsDat'
import type {
  PlayerRecord,
  PlayerSavePerformanceStats,
  StaffCompHistoryRecord,
  StaffRecord,
} from './types'

export const PLAYER_STATS_HISTORY_RECORD = {
  playerDatIdRel: 0,
  appsRel: 4,
  goalsRel: 5,
  assistsRel: 6,
  /** `club_comp.dat` / `staff_comp.dat` id when present (verified Cole Premier id 7 @ +8). */
  competitionIdRel: 8,
  scopeRel: 12,
} as const

export interface PlayerCompSeasonRow {
  competitionId: number
  competitionName: string
  apps: number
  goals: number
  assists: number
}

/** CM profile “scope” ids in `player stats history.tmp` (verified Cole). */
export const CM_STAT_SCOPE = {
  cup: 1,
  continental: 2,
  league: 3,
  seniorClubHistory: 4,
} as const

export type CmStatScopeKey =
  | 'nonCompetitive'
  | 'league'
  | 'cup'
  | 'continental'
  | 'international'
  | 'seniorClub'

export interface CmScopeStatRow {
  key: CmStatScopeKey
  label: string
  apps: number
  goals: number
  assists: number
  averageRating: number | null
  source: 'player stats history.tmp' | 'player stats.dat' | 'staff.dat'
}

export interface PlayerCurrentSeasonStats {
  scopes: CmScopeStatRow[]
  seniorClub: CmScopeStatRow | null
}

const R = PLAYER_STATS_HISTORY_RECORD

const SCOPE_LABELS: Record<number, string> = {
  [CM_STAT_SCOPE.cup]: 'Cup',
  [CM_STAT_SCOPE.continental]: 'Continental',
  [CM_STAT_SCOPE.league]: 'League',
  [CM_STAT_SCOPE.seniorClubHistory]: 'Senior club',
}

const SCOPE_ORDER: CmStatScopeKey[] = [
  'nonCompetitive',
  'league',
  'cup',
  'continental',
  'international',
  'seniorClub',
]

function readU8(buf: Buffer, base: number, rel: number): number | null {
  const i = base + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function plausibleTriple(apps: number, goals: number, assists: number): boolean {
  if (apps > 60 || goals > 40 || assists > 40) return false
  if (goals > apps || assists > apps) return false
  return true
}

function decodeHistoryRecordAt(
  buf: Buffer,
  rowStart: number,
  playerIdRel: number,
): {
  playerDatId: number
  apps: number
  goals: number
  assists: number
  scope: number
} | null {
  const maxRel = Math.max(R.scopeRel, playerIdRel + 4)
  if (rowStart + maxRel + 1 > buf.length) return null
  const playerDatId = buf.readInt32LE(rowStart + playerIdRel)
  const apps = readU8(buf, rowStart, R.appsRel)
  const goals = readU8(buf, rowStart, R.goalsRel)
  const assists = readU8(buf, rowStart, R.assistsRel)
  const scope = readU8(buf, rowStart, R.scopeRel)
  if (apps == null || goals == null || assists == null || scope == null) return null
  if (!plausibleTriple(apps, goals, assists)) return null
  return { playerDatId, apps, goals, assists, scope }
}

function decodeHistoryRecord(buf: Buffer, rowStart: number) {
  return decodeHistoryRecordAt(buf, rowStart, R.playerDatIdRel)
}

type HistoryScopeRow = { apps: number; goals: number; assists: number; scope: number }
type HistoryCompRow = { competitionId: number; apps: number; goals: number; assists: number }

function readCompIdAtRow(
  buf: Buffer,
  rowStart: number,
  playerDatId: number,
  competitionNames: CompetitionNamesById,
): number | null {
  for (const compRel of [R.competitionIdRel, 4] as const) {
    if (rowStart + compRel + 4 > buf.length) continue
    const comp = buf.readInt32LE(rowStart + compRel)
    if (!isKnownCompetitionId(comp, competitionNames, playerDatId)) continue
    return comp
  }
  return null
}

function pushCompRow(
  out: Map<number, HistoryCompRow[]>,
  rec: HistoryCompRow & { playerDatId: number },
): void {
  const entry = {
    competitionId: rec.competitionId,
    apps: rec.apps,
    goals: rec.goals,
    assists: rec.assists,
  }
  const list = out.get(rec.playerDatId)
  if (list) {
    const dup = list.some(
      (x) =>
        x.competitionId === entry.competitionId &&
        x.apps === entry.apps &&
        x.goals === entry.goals &&
        x.assists === entry.assists,
    )
    if (!dup) list.push(entry)
  } else out.set(rec.playerDatId, [entry])
}

function pickBestCompRow(rows: HistoryCompRow[], competitionId: number): HistoryCompRow | null {
  const hits = rows.filter((r) => r.competitionId === competitionId)
  if (!hits.length) return null
  return hits.reduce((a, b) => {
    if (a.apps !== b.apps) return a.apps < b.apps ? a : b
    if (a.assists !== b.assists) return a.assists > b.assists ? a : b
    return a.goals <= b.goals ? a : b
  })
}

function pushHistoryRow(
  out: Map<number, HistoryScopeRow[]>,
  rec: { playerDatId: number; apps: number; goals: number; assists: number; scope: number },
): void {
  const entry = {
    apps: rec.apps,
    goals: rec.goals,
    assists: rec.assists,
    scope: rec.scope,
  }
  const list = out.get(rec.playerDatId)
  if (list) {
    const dup = list.some(
      (x) =>
        x.scope === entry.scope &&
        x.apps === entry.apps &&
        x.goals === entry.goals &&
        x.assists === entry.assists,
    )
    if (!dup) list.push(entry)
  } else out.set(rec.playerDatId, [entry])
}

export interface PlayerStatsHistoryIndex {
  byScope: Map<number, HistoryScopeRow[]>
  byComp: Map<number, HistoryCompRow[]>
}

function decodeHistoryRowLayout(
  buf: Buffer,
  row: number,
  playerRel: number,
  appsRel: number,
  goalsRel: number,
  assistsRel: number,
  playerDatId: number,
): { apps: number; goals: number; assists: number } | null {
  const apps = readU8(buf, row, appsRel)
  const goals = readU8(buf, row, goalsRel)
  const assists = readU8(buf, row, assistsRel)
  if (apps == null || goals == null || assists == null) return null
  if (!plausibleTriple(apps, goals, assists)) return null
  if (buf.readInt32LE(row + playerRel) !== playerDatId) return null
  return { apps, goals, assists }
}

/**
 * Fast index: 47-byte CM rows only (~2M steps on a 99MB file).
 * Avoids the old 4-byte full-file scan (~25M steps) that blocked the UI for minutes.
 */
export function indexPlayerStatsHistory(
  buf: Buffer,
  playerIds: ReadonlySet<number>,
  competitionNames: CompetitionNamesById,
): PlayerStatsHistoryIndex {
  const byScope = new Map<number, HistoryScopeRow[]>()
  const byComp = new Map<number, HistoryCompRow[]>()
  if (!buf.length || !playerIds.size) return { byScope, byComp }

  const stride = PLAYER_STATS_HISTORY_ROW_BYTES_CANDIDATE
  for (let row = 0; row + stride <= buf.length; row += stride) {
    for (const playerIdRel of [R.playerDatIdRel, 2] as const) {
      const pid = buf.readInt32LE(row + playerIdRel)
      if (!playerIds.has(pid)) continue
      const rec = decodeHistoryRecordAt(buf, row, playerIdRel)
      if (rec) {
        pushHistoryRow(byScope, rec)
        const compId = readCompIdAtRow(buf, row, rec.playerDatId, competitionNames)
        if (compId != null) {
          pushCompRow(byComp, {
            playerDatId: rec.playerDatId,
            competitionId: compId,
            apps: rec.apps,
            goals: rec.goals,
            assists: rec.assists,
          })
        }
      }
    }

    const pid20 = buf.readInt32LE(row + 20)
    if (playerIds.has(pid20)) {
      const triple = decodeHistoryRowLayout(buf, row, 20, 24, 25, 26, pid20)
      if (triple) {
        const comp = buf.readInt32LE(row + 8)
        if (isKnownCompetitionId(comp, competitionNames, pid20)) {
          pushCompRow(byComp, {
            playerDatId: pid20,
            competitionId: comp,
            apps: triple.apps,
            goals: triple.goals,
            assists: triple.assists,
          })
        }
      }
    }
  }

  return { byScope, byComp }
}

/** @deprecated Use `indexPlayerStatsHistory` — scope map only. */
export function indexPlayerStatsHistoryByPlayerDatId(
  buf: Buffer,
  playerIds?: ReadonlySet<number>,
): Map<number, HistoryScopeRow[]> {
  if (!buf.length) return new Map()
  const ids = playerIds ?? new Set<number>()
  return indexPlayerStatsHistory(buf, ids, new Map()).byScope
}

function seniorClubFromEmbedded(
  statsBuf: Buffer,
  playerDatId: number,
  opts?: {
    anchorOccurrences?: readonly number[]
    bestAnchor?: number
    idHitCount?: number
    summaryAnchorIndex?: SummaryAnchorIndex
  },
): CmScopeStatRow | null {
  const occ = opts?.anchorOccurrences ?? []
  const anchor =
    opts?.bestAnchor ?? pickPlayerStatsAnchor(statsBuf, playerDatId, occ)
  if (anchor == null) return null

  const hits = opts?.idHitCount ?? occ.length
  const summary = readSummaryStatsAtAnchor(statsBuf, anchor, playerDatId, hits)
  const rec = embeddedIdRecordStart(statsBuf, anchor, playerDatId)
  let apps: number
  let goals: number
  let assists: number

  if (summary) {
    apps = summary.apps
    goals = summary.goals
    assists = summary.assists
    if (opts?.summaryAnchorIndex) {
      apps = mergeSeniorClubAppsAtAnchor(
        statsBuf,
        anchor,
        playerDatId,
        hits,
        summary,
        opts.summaryAnchorIndex.maxApps91ByStatKey,
        opts.summaryAnchorIndex.max76ByStatKey,
      )
    }
    if (rec != null) {
      const goalsAlt = readU8(statsBuf, rec, 86)
      if (
        goalsAlt != null &&
        goalsAlt <= apps &&
        goalsAlt < goals &&
        plausibleTriple(apps, goalsAlt, assists)
      ) {
        goals = goalsAlt
      }
    }
  } else if (rec != null) {
    const emb = readEmbeddedIdRecordStats(statsBuf, rec)
    if (!emb) return null
    apps = emb.apps
    goals = emb.goals
    assists = emb.assists
  } else {
    return null
  }

  if (!plausibleTriple(apps, goals, assists)) return null

  if (rec != null) {
    const nonCompApps = readU8(statsBuf, rec, 12)
    if (nonCompApps != null && nonCompApps > 0 && nonCompApps < apps) {
      apps -= nonCompApps
    }
  }

  const triple = { apps, goals, assists }
  const averageRating = summary
    ? readSeniorClubRatingAtAnchor(statsBuf, anchor, playerDatId, hits, triple)
    : rec != null
      ? readEmbeddedSeniorRating(statsBuf, rec)
      : null

  return {
    key: 'seniorClub',
    label: 'Senior club',
    apps,
    goals,
    assists,
    averageRating,
    source: 'player stats.dat',
  }
}

function seniorClubFromSaveSummary(
  savePerf: PlayerSavePerformanceStats | null | undefined,
): CmScopeStatRow | null {
  if (!savePerf || savePerf.apps == null) return null
  const apps = savePerf.apps
  const goals = savePerf.goals ?? 0
  const assists = savePerf.assists ?? 0
  if (!plausibleTriple(apps, goals, assists)) return null
  return {
    key: 'seniorClub',
    label: 'Senior club',
    apps,
    goals,
    assists,
    averageRating: savePerf.averageRating ?? null,
    source: 'player stats.dat',
  }
}

function pickScopeRow(
  rows: Array<{ apps: number; goals: number; assists: number; scope: number }>,
  scopeId: number,
): { apps: number; goals: number; assists: number } | null {
  const hits = rows.filter((r) => r.scope === scopeId)
  if (!hits.length) return null
  const best = hits.reduce((a, b) => {
    if (a.apps !== b.apps) return a.apps < b.apps ? a : b
    if (a.assists !== b.assists) return a.assists > b.assists ? a : b
    return a.goals <= b.goals ? a : b
  })
  return { apps: best.apps, goals: best.goals, assists: best.assists }
}

function historyRowsForPlayer(
  buf: Buffer,
  playerDatId: number,
): Array<{ apps: number; goals: number; assists: number; scope: number }> {
  const needle = Buffer.allocUnsafe(4)
  needle.writeInt32LE(playerDatId, 0)
  const out: Array<{ apps: number; goals: number; assists: number; scope: number }> = []
  let pos = 0
  while (pos < buf.length - 16) {
    const i = buf.indexOf(needle, pos)
    if (i === -1) break
    pos = i + 4
    for (const delta of [-8, -4, 0, 4, 8]) {
      const rowStart = i + delta
      if (rowStart < 0 || rowStart + R.scopeRel + 1 > buf.length) continue
      const rec = decodeHistoryRecord(buf, rowStart)
      if (!rec || rec.playerDatId !== playerDatId) continue
      const entry = {
        apps: rec.apps,
        goals: rec.goals,
        assists: rec.assists,
        scope: rec.scope,
      }
      if (
        !out.some(
          (x) =>
            x.scope === entry.scope &&
            x.apps === entry.apps &&
            x.goals === entry.goals &&
            x.assists === entry.assists,
        )
      ) {
        out.push(entry)
      }
    }
  }
  return out
}

export function decodePlayerCurrentSeasonStats(
  playerDatId: number,
  historyBuf: Buffer | null | undefined,
  statsBuf: Buffer | null | undefined,
  historyByPlayer?: Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>>,
  staffInternational?: { apps: number; goals: number } | null,
  opts?: {
    statsAnchorOccurrences?: readonly number[]
    statsBestAnchor?: number
    statsIdHitCount?: number
    summaryAnchorIndex?: SummaryAnchorIndex
    savePerformance?: PlayerSavePerformanceStats | null
  },
): PlayerCurrentSeasonStats {
  const histRows =
    historyByPlayer?.get(playerDatId) ??
    (historyBuf?.length ? historyRowsForPlayer(historyBuf, playerDatId) : [])
  let seniorClub: CmScopeStatRow | null = null
  if (statsBuf?.length) {
    seniorClub = seniorClubFromEmbedded(statsBuf, playerDatId, {
      anchorOccurrences: opts?.statsAnchorOccurrences,
      bestAnchor: opts?.statsBestAnchor,
      idHitCount: opts?.statsIdHitCount,
      summaryAnchorIndex: opts?.summaryAnchorIndex,
    })
  }
  if (!seniorClub) {
    seniorClub = seniorClubFromSaveSummary(opts?.savePerformance)
  } else if (
    opts?.savePerformance &&
    seniorClub.averageRating == null &&
    opts.savePerformance.averageRating != null
  ) {
    seniorClub = { ...seniorClub, averageRating: opts.savePerformance.averageRating }
  }

  const scopeRows: CmScopeStatRow[] = []

  const add = (
    key: CmStatScopeKey,
    label: string,
    triple: { apps: number; goals: number; assists: number } | null,
    source: CmScopeStatRow['source'],
  ) => {
    if (!triple) {
      scopeRows.push({
        key,
        label,
        apps: 0,
        goals: 0,
        assists: 0,
        averageRating: null,
        source,
      })
      return
    }
    scopeRows.push({
      key,
      label,
      apps: triple.apps,
      goals: triple.goals,
      assists: triple.assists,
      averageRating: null,
      source,
    })
  }

  add('nonCompetitive', 'Non Competitive', { apps: 0, goals: 0, assists: 0 }, 'player stats history.tmp')
  add('league', 'League', pickScopeRow(histRows, CM_STAT_SCOPE.league), 'player stats history.tmp')
  add('cup', 'Cup', pickScopeRow(histRows, CM_STAT_SCOPE.cup), 'player stats history.tmp')
  add(
    'continental',
    'Continental',
    pickScopeRow(histRows, CM_STAT_SCOPE.continental),
    'player stats history.tmp',
  )
  let intlTriple = pickScopeRow(histRows, 5) ?? pickScopeRow(histRows, 6)
  if (!intlTriple && staffInternational && staffInternational.apps > 0) {
    intlTriple = {
      apps: staffInternational.apps,
      goals: staffInternational.goals,
      assists: 0,
    }
    add('international', 'International', intlTriple, 'staff.dat')
  } else {
    add('international', 'International', intlTriple, 'player stats history.tmp')
  }

  if (seniorClub) {
    scopeRows.push(seniorClub)
  } else {
    add(
      'seniorClub',
      'Senior club',
      pickScopeRow(histRows, CM_STAT_SCOPE.seniorClubHistory),
      'player stats history.tmp',
    )
  }

  const ordered = SCOPE_ORDER.map((key) => scopeRows.find((r) => r.key === key)!).filter(Boolean)

  return { scopes: ordered, seniorClub }
}

/** Fast path when parser already indexed history. */
export function decodePlayerCurrentSeasonStatsFromIndex(
  playerDatId: number,
  historyByPlayer: Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>> | undefined,
  statsBuf: Buffer | null | undefined,
): PlayerCurrentSeasonStats {
  return decodePlayerCurrentSeasonStats(playerDatId, null, statsBuf, historyByPlayer)
}

export function compRowsForPlayer(
  raw: readonly HistoryCompRow[],
  competitionNames: CompetitionNamesById,
  playerDatId: number,
): PlayerCompSeasonRow[] {
  const compIds = [...new Set(raw.map((r) => r.competitionId))].sort((a, b) => a - b)
  const out: PlayerCompSeasonRow[] = []
  for (const competitionId of compIds) {
    const best = pickBestCompRow(raw, competitionId)
    if (!best) continue
    out.push({
      competitionId,
      competitionName: competitionNameFromMaps(competitionId, competitionNames, playerDatId),
      apps: best.apps,
      goals: best.goals,
      assists: best.assists,
    })
  }
  return out.sort((a, b) => a.competitionName.localeCompare(b.competitionName))
}

export function mergeCompSeasonRows(
  historyRows: readonly PlayerCompSeasonRow[],
  gridRows: readonly StaffCompHistoryRecord[],
  competitionNames: CompetitionNamesById,
  playerDatId: number,
): PlayerCompSeasonRow[] {
  const byId = new Map<number, PlayerCompSeasonRow>()
  for (const r of historyRows) byId.set(r.competitionId, r)
  for (const g of gridRows) {
    if (byId.has(g.competitionId)) continue
    if (g.apps === 0 && g.goals === 0 && g.assists === 0) continue
    byId.set(g.competitionId, {
      competitionId: g.competitionId,
      competitionName: competitionNameFromMaps(g.competitionId, competitionNames, playerDatId),
      apps: g.apps,
      goals: g.goals,
      assists: g.assists,
    })
  }
  return [...byId.values()].sort((a, b) => a.competitionName.localeCompare(b.competitionName))
}

export function compSeasonStat(
  cm: PlayerCurrentSeasonIndexed | null | undefined,
  competitionId: number,
): PlayerCompSeasonRow | null {
  if (!cm?.byCompetition.length) return null
  return cm.byCompetition.find((c) => c.competitionId === competitionId) ?? null
}

/** Flattened current-season stats for grid, filters, and profile (keyed by `player.dat` id). */
export interface PlayerCurrentSeasonIndexed {
  scopes: CmScopeStatRow[]
  seniorApps: number
  seniorGoals: number
  seniorAssists: number
  seniorAvgRating: number | null
  leagueApps: number
  leagueGoals: number
  leagueAssists: number
  cupApps: number
  cupGoals: number
  cupAssists: number
  continentalApps: number
  continentalGoals: number
  continentalAssists: number
  internationalApps: number
  internationalGoals: number
  internationalAssists: number
  /** Per-competition rows (`club_comp` id @ history +8, 47-byte stride, or grid fallback). */
  byCompetition: PlayerCompSeasonRow[]
  /** True when Senior club, scope, or per-competition row has decoded data for this save. */
  available: boolean
}

function scopeStats(
  decoded: PlayerCurrentSeasonStats,
  key: CmStatScopeKey,
): { apps: number; goals: number; assists: number; averageRating: number | null } {
  const row = decoded.scopes.find((s) => s.key === key)
  return {
    apps: row?.apps ?? 0,
    goals: row?.goals ?? 0,
    assists: row?.assists ?? 0,
    averageRating: row?.averageRating ?? null,
  }
}

/**
 * Fill Senior club gaps from `parsePlayerStatsSummary` without overwriting
 * `seniorClubFromEmbedded` (Cole non-comp / goals @86, slot-B +91 merge, …).
 */
export function mergeSavePerformanceIntoIndexed(
  indexed: PlayerCurrentSeasonIndexed,
  savePerf: PlayerSavePerformanceStats | null | undefined,
): PlayerCurrentSeasonIndexed {
  if (!savePerf || savePerf.apps == null) return indexed

  const hasDecodedSenior =
    indexed.seniorApps > 0 || indexed.seniorGoals > 0 || indexed.seniorAssists > 0
  const spApps = savePerf.apps
  const spGoals = savePerf.goals ?? 0
  const spAssists = savePerf.assists ?? 0
  const hasSaveSenior = spApps > 0 || spGoals > 0 || spAssists > 0

  if (!hasDecodedSenior && hasSaveSenior) {
    return {
      ...indexed,
      seniorApps: spApps,
      seniorGoals: spGoals,
      seniorAssists: spAssists,
      seniorAvgRating: savePerf.averageRating ?? null,
      available: true,
    }
  }

  if (indexed.seniorAvgRating == null && savePerf.averageRating != null) {
    return { ...indexed, seniorAvgRating: savePerf.averageRating, available: true }
  }

  return indexed
}

export function indexedFromDecoded(
  decoded: PlayerCurrentSeasonStats,
  byCompetition: PlayerCompSeasonRow[] = [],
): PlayerCurrentSeasonIndexed {
  const senior = decoded.seniorClub ?? decoded.scopes.find((s) => s.key === 'seniorClub')
  const league = scopeStats(decoded, 'league')
  const cup = scopeStats(decoded, 'cup')
  const continental = scopeStats(decoded, 'continental')
  const international = scopeStats(decoded, 'international')
  const seniorApps = senior?.apps ?? 0
  const seniorGoals = senior?.goals ?? 0
  const seniorAssists = senior?.assists ?? 0
  const anyScope =
    seniorApps > 0 ||
    seniorGoals > 0 ||
    seniorAssists > 0 ||
    league.apps > 0 ||
    league.goals > 0 ||
    league.assists > 0 ||
    cup.apps > 0 ||
    cup.goals > 0 ||
    cup.assists > 0 ||
    continental.apps > 0 ||
    continental.goals > 0 ||
    continental.assists > 0 ||
    international.apps > 0 ||
    international.goals > 0 ||
    international.assists > 0 ||
    byCompetition.some((c) => c.apps > 0 || c.goals > 0 || c.assists > 0)

  return {
    scopes: decoded.scopes,
    byCompetition,
    seniorApps,
    seniorGoals,
    seniorAssists,
    seniorAvgRating: senior?.averageRating ?? null,
    leagueApps: league.apps,
    leagueGoals: league.goals,
    leagueAssists: league.assists,
    cupApps: cup.apps,
    cupGoals: cup.goals,
    cupAssists: cup.assists,
    continentalApps: continental.apps,
    continentalGoals: continental.goals,
    continentalAssists: continental.assists,
    internationalApps: international.apps,
    internationalGoals: international.goals,
    internationalAssists: international.assists,
    available: anyScope,
  }
}

/**
 * One pass over `player stats history.tmp`, then per-player decode from `player stats.dat`.
 * Used for every player in the grid when the save includes those blocks.
 */
export function buildPlayerCurrentSeasonIndex(
  players: readonly PlayerRecord[],
  staff: readonly StaffRecord[],
  historyBuf: Buffer | null | undefined,
  statsBuf: Buffer | null | undefined,
  competitionNames: CompetitionNamesById,
  staffCompHistoryByStaffId?: Map<number, StaffCompHistoryRecord[]>,
  savePerformanceByPlayerDatId?: Map<number, PlayerSavePerformanceStats>,
  onProgress?: (fraction: number) => void,
): Map<number, PlayerCurrentSeasonIndexed> {
  const out = new Map<number, PlayerCurrentSeasonIndexed>()
  if (!historyBuf?.length && !statsBuf?.length) return out

  const playerIds = new Set<number>()
  for (const s of staff) {
    const pid = players[s.player_id]?.id
    if (pid != null) playerIds.add(pid)
  }

  onProgress?.(0.05)
  let historyByScope: Map<number, HistoryScopeRow[]> | undefined
  let historyByComp: Map<number, HistoryCompRow[]> | undefined
  if (historyBuf?.length && playerIds.size) {
    const hist = indexPlayerStatsHistory(historyBuf, playerIds, competitionNames)
    historyByScope = hist.byScope
    historyByComp = hist.byComp
  }

  onProgress?.(0.35)
  let summaryAnchorIndex: SummaryAnchorIndex | undefined
  if (statsBuf?.length && playerIds.size) {
    const playerList = players.filter((p) => playerIds.has(p.id))
    summaryAnchorIndex = buildSummaryAnchorIndex(statsBuf, playerList)
  }

  onProgress?.(0.45)
  const intlByPlayerId = new Map<number, { apps: number; goals: number }>()
  for (const s of staff) {
    const pid = players[s.player_id]?.id
    if (pid != null) intlByPlayerId.set(pid, { apps: s.int_apps, goals: s.int_goals })
  }

  const seen = new Set<number>()
  let processed = 0
  const totalPlayers = playerIds.size
  for (const s of staff) {
    const pid = players[s.player_id]?.id
    if (pid == null || seen.has(pid)) continue
    seen.add(pid)
    const savePerf = savePerformanceByPlayerDatId?.get(pid) ?? null
    const decoded = decodePlayerCurrentSeasonStats(
      pid,
      null,
      statsBuf,
      historyByScope,
      intlByPlayerId.get(pid) ?? null,
      {
        statsBestAnchor: summaryAnchorIndex?.bestAnchorByPlayer.get(pid),
        statsIdHitCount: summaryAnchorIndex?.idHitCount.get(pid),
        summaryAnchorIndex,
        savePerformance: savePerf,
      },
    )
    const histComp = historyByComp?.get(pid) ?? []
    const gridComp = staffCompHistoryByStaffId?.get(s.id) ?? []
    const byCompetition = mergeCompSeasonRows(
      compRowsForPlayer(histComp, competitionNames, pid),
      gridComp,
      competitionNames,
      pid,
    )
    const indexed = mergeSavePerformanceIntoIndexed(
      indexedFromDecoded(decoded, byCompetition),
      savePerf,
    )
    if (indexed.available || savePerf?.apps != null) out.set(pid, indexed)
    processed++
    if (onProgress && (processed % 2000 === 0 || processed === totalPlayers)) {
      onProgress(0.45 + (0.55 * processed) / Math.max(1, totalPlayers))
    }
  }
  onProgress?.(1)
  return out
}
