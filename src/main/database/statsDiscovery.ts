/**
 * Forensic export of every plausible player stat record in CM0102 saves.
 * Used by `scripts/discover-player-stats.ts` — not wired into Merlin production decode.
 */

import {
  decodePlayerStatsGridRow,
  isResolvedCompetitionId,
  PLAYER_STATS_FIELD_MAP_V0,
  type DecodedPlayerStatsGridRow,
} from './playerStatsFields'
import {
  collectPlayerDatIdOccurrences,
  decodePlayerStatsRowAtAnchor,
  detectPlayerStatsRowLayout,
} from './playerStatsDat'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  iterPlayerStatsRowStarts,
  type PlayerStatsResearchGrid,
} from './playerStatsJoins'
import {
  classifySeniorClubSlotKind,
  inspectSeniorClubAnchorsForPlayer,
  readSummaryStatsAtAnchor,
  PLAYER_STATS_SUMMARY_FIELDS as SF,
} from './playerStatsSummary'
import { STAFF_HISTORY_ROW_BYTES, type StaffHistoryRecord } from './staffHistory'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'

export const STAFF_INT_APPS_ROW_OFFSET = 34
export const STAFF_INT_GOALS_ROW_OFFSET = 35

/** Max `player stats.dat:u8_scan` rows per player in exported candidate list (expect matches always kept). */
export const MAX_U8_SCAN_CANDIDATES_EXPORT = 400

export type StatCandidateSource =
  | 'staff_history.dat'
  | 'staff_history.dat:aggregate'
  | 'staff.dat'
  | 'player stats.dat:grid_v0'
  | 'player stats.dat:anchor_summary'
  | 'player stats.dat:anchor_heuristic_v1'
  | 'player stats.dat:anchor_grid_aligned'
  | 'player stats.dat:u8_scan'
  | 'player stats history.tmp:id_hit'
  | 'player stats history.tmp:header'

export interface ExpectedStats {
  apps?: number
  goals?: number
  assists?: number
  /** CM average rating (e.g. 7.1), not raw u8. */
  rating?: number
}

export interface StatCandidate {
  source: StatCandidateSource
  file: string
  /** Primary byte offset (row start, anchor, or field offset). */
  offset: number
  field?: string
  apps?: number | null
  goals?: number | null
  assists?: number | null
  rating?: number | null
  competitionId?: number | null
  rowStart?: number
  idAnchor?: number
  hex?: string
  decoder?: string
  staffId?: number
  playerDatId?: number
  year?: number
  clubId?: number
  onLoan?: number
  note?: string
  /** Set when --expect provided and values match. */
  matchesExpect?: boolean
}

export interface SaveBlockInventoryEntry {
  name: string
  size: number
  present: boolean
}

export interface PlayerStatsDiscoveryIdentity {
  name: string
  playerDatId: number
  staffId: number
  staffRowOffset: number | null
  club: string
  clubJobId: number
}

export interface PlayerStatsDiscoveryReport {
  savePath: string
  gameDateIso: string | null
  blockInventory: SaveBlockInventoryEntry[]
  expected: ExpectedStats | null
  players: Array<{
    identity: PlayerStatsDiscoveryIdentity
    staffHistory: {
      rows: StaffHistoryRecord[]
      latestYearAtClub: { year: number; apps: number; goals: number; rowCount: number } | null
      note: string
    }
    staffDat: StatCandidate | null
    playerStatsDat: {
      byteLength: number
      idHitCount: number
      gridRows: DecodedPlayerStatsGridRow[]
      anchors: ReturnType<typeof inspectSeniorClubAnchorsForPlayer>
      decoderSideBySide: StatCandidate[]
      u8Candidates: StatCandidate[]
    } | null
    playerStatsHistoryTmp: {
      byteLength: number
      headerUint32: number[]
      idHits: number[]
      windows: Array<{ offset: number; hex: string }>
    } | null
    candidates: StatCandidate[]
    expectMatches: StatCandidate[]
  }>
}

const GRID = PLAYER_STATS_RESEARCH_GRID_V0

export function bufferToHex(buf: Buffer, start: number, len: number): string {
  const s = Math.max(0, start)
  const e = Math.min(buf.length, start + len)
  return buf.subarray(s, e).toString('hex')
}

export function parseExpectedStats(spec: string): ExpectedStats {
  const out: ExpectedStats = {}
  for (const part of spec.split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim())
    if (!k || v === undefined) continue
    const n = parseFloat(v)
    if (!Number.isFinite(n)) continue
    if (k === 'apps') out.apps = n
    else if (k === 'goals') out.goals = n
    else if (k === 'assists') out.assists = n
    else if (k === 'rating') out.rating = n
  }
  return out
}

function ratingFromU8(v: number): number {
  return Math.round(v * 10) / 100
}

export function plausibleU8Apps(v: number): boolean {
  return v >= 0 && v <= 60
}

export function plausibleU8Goals(v: number): boolean {
  return v >= 0 && v <= 40
}

export function plausibleU8Assists(v: number): boolean {
  return v >= 0 && v <= 30
}

export function plausibleU8RatingByte(v: number): boolean {
  return v >= 50 && v <= 100
}

export function candidateMatchesExpect(c: StatCandidate, exp: ExpectedStats): boolean {
  const ratingOk =
    exp.rating == null ||
    (c.rating != null && Math.abs(c.rating - exp.rating) <= 0.1)
  const appsOk = exp.apps == null || c.apps === exp.apps
  const goalsOk = exp.goals == null || c.goals === exp.goals
  const assistsOk = exp.assists == null || c.assists === exp.assists
  const anyStat =
    exp.apps != null || exp.goals != null || exp.assists != null || exp.rating != null
  if (!anyStat) return false
  return appsOk && goalsOk && assistsOk && ratingOk
}

function tagExpectMatches(candidates: StatCandidate[], exp: ExpectedStats | null): void {
  if (!exp || (exp.apps == null && exp.goals == null && exp.assists == null && exp.rating == null)) {
    return
  }
  for (const c of candidates) {
    c.matchesExpect = candidateMatchesExpect(c, exp)
  }
}

/** Scan u8 bytes in [start, end) for values that could be apps/goals/assists/rating. */
export function scanU8StatCandidatesInRange(
  buf: Buffer,
  start: number,
  end: number,
  ctx: {
    source: StatCandidateSource
    file: string
    playerDatId: number
    baseLabel: string
    rowStart?: number
    idAnchor?: number
  },
): StatCandidate[] {
  const out: StatCandidate[] = []
  const lo = Math.max(0, start)
  const hi = Math.min(buf.length, end)
  for (let off = lo; off < hi; off++) {
    const rel =
      ctx.rowStart != null ? off - ctx.rowStart : ctx.idAnchor != null ? off - ctx.idAnchor : off
    const v = buf.readUInt8(off)
    const fields: Array<{ field: string; ok: boolean; rating?: number }> = []
    if (plausibleU8Apps(v)) fields.push({ field: 'apps_u8', ok: true })
    if (plausibleU8Goals(v)) fields.push({ field: 'goals_u8', ok: true })
    if (plausibleU8Assists(v)) fields.push({ field: 'assists_u8', ok: true })
    if (plausibleU8RatingByte(v)) fields.push({ field: 'rating_u8', ok: true, rating: ratingFromU8(v) })

    for (const f of fields) {
      const c: StatCandidate = {
        source: ctx.source,
        file: ctx.file,
        offset: off,
        field: `${ctx.baseLabel}@${rel >= 0 ? '+' : ''}${rel} (${f.field})`,
        playerDatId: ctx.playerDatId,
        rowStart: ctx.rowStart,
        idAnchor: ctx.idAnchor,
      }
      if (f.field === 'apps_u8') c.apps = v
      if (f.field === 'goals_u8') c.goals = v
      if (f.field === 'assists_u8') c.assists = v
      if (f.field === 'rating_u8') c.rating = f.rating
      out.push(c)
    }
  }
  return out
}

/** Within ±radius of anchor, emit separate candidates for each offset triple (apps, goals, assists, rating). */
export function scanU8CandidatesNearAnchor(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  radius = 64,
): StatCandidate[] {
  return scanU8StatCandidatesInRange(buf, anchor - radius, anchor + radius + 4, {
    source: 'player stats.dat:u8_scan',
    file: 'player stats.dat',
    playerDatId,
    baseLabel: `anchor${anchor}`,
    idAnchor: anchor,
  })
}

export function scanU8CandidatesInGridRow(
  buf: Buffer,
  rowStart: number,
  playerDatId: number,
  stride = GRID.stride,
): StatCandidate[] {
  return scanU8StatCandidatesInRange(buf, rowStart, rowStart + stride, {
    source: 'player stats.dat:u8_scan',
    file: 'player stats.dat',
    playerDatId,
    baseLabel: `row${rowStart}`,
    rowStart,
  })
}

function staffHistoryCandidates(
  rows: readonly StaffHistoryRecord[],
  staffId: number,
  employerClubId: number,
): { rows: StaffHistoryRecord[]; candidates: StatCandidate[]; latestYearAtClub: PlayerStatsDiscoveryReport['players'][0]['staffHistory']['latestYearAtClub'] } {
  const mine = rows.filter((r) => r.staffId === staffId)
  const candidates: StatCandidate[] = []
  mine.forEach((r, rowIndex) => {
    candidates.push({
      source: 'staff_history.dat',
      file: 'staff_history.dat',
      offset: rowIndex * STAFF_HISTORY_ROW_BYTES,
      apps: r.apps,
      goals: r.goals,
      assists: null,
      rating: null,
      staffId,
      playerDatId: undefined,
      year: r.year,
      clubId: r.clubId,
      onLoan: r.onLoan,
      field: `row id=${r.id}`,
      note: 'No assists or average rating in TStaffHistory (17 B)',
    })
  })

  let latestYearAtClub: PlayerStatsDiscoveryReport['players'][0]['staffHistory']['latestYearAtClub'] = null
  if (mine.length) {
    const maxYear = Math.max(...mine.map((h) => h.year))
    const atClub = mine.filter((h) => h.year === maxYear && h.clubId === employerClubId)
    if (atClub.length) {
      const apps = atClub.reduce((a, h) => a + h.apps, 0)
      const goals = atClub.reduce((a, h) => a + h.goals, 0)
      latestYearAtClub = { year: maxYear, apps, goals, rowCount: atClub.length }
      candidates.push({
        source: 'staff_history.dat:aggregate',
        file: 'staff_history.dat',
        offset: 0,
        apps,
        goals,
        assists: null,
        rating: null,
        staffId,
        year: maxYear,
        clubId: employerClubId,
        field: `sum year=${maxYear} club=${employerClubId}`,
        note: 'League+cups combined per club-year (Merlin current-season fallback)',
      })
    }
  }

  return { rows: mine, candidates, latestYearAtClub }
}

function collectGridRowsForPlayer(
  statsBuf: Buffer,
  playerDatId: number,
  playerIds: ReadonlySet<number>,
  g: PlayerStatsResearchGrid = GRID,
): DecodedPlayerStatsGridRow[] {
  const out: DecodedPlayerStatsGridRow[] = []
  for (const rowStart of iterPlayerStatsRowStarts(statsBuf, g)) {
    if (statsBuf.readInt32LE(rowStart + g.idOffsetInRow) !== playerDatId) continue
    const decoded = decodePlayerStatsGridRow(statsBuf, rowStart, g)
    if (!decoded) continue
    const hasStat =
      decoded.apps != null ||
      decoded.goals != null ||
      decoded.assists != null ||
      decoded.averageRating != null
    if (!hasStat) continue
    out.push(decoded)
  }
  return out
}

function gridRowToCandidate(
  r: DecodedPlayerStatsGridRow,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): StatCandidate {
  const resolved =
    r.competitionId != null &&
    isResolvedCompetitionId(r.competitionId, r.playerDatId, clubCompsById, staffCompsById)
  return {
    source: 'player stats.dat:grid_v0',
    file: 'player stats.dat',
    offset: r.rowStart,
    rowStart: r.rowStart,
    playerDatId: r.playerDatId,
    competitionId: r.competitionId,
    apps: r.apps,
    goals: r.goals,
    assists: r.assists,
    rating: r.averageRating,
    hex: undefined,
    field: PLAYER_STATS_FIELD_MAP_V0
      ? `comp@+${PLAYER_STATS_FIELD_MAP_V0.competitionId.rel} apps@+${PLAYER_STATS_FIELD_MAP_V0.apps.rel} goals@+${PLAYER_STATS_FIELD_MAP_V0.goals.rel} assists@+${PLAYER_STATS_FIELD_MAP_V0.assists.rel} rating@+${PLAYER_STATS_FIELD_MAP_V0.averageRating.rel}`
      : undefined,
    decoder: 'grid_v0',
    note: resolved ? 'comp id resolves in club_comp/staff_comp' : 'comp id unresolved',
  }
}

function fixGridCandidateHex(c: StatCandidate, statsBuf: Buffer, stride: number): void {
  if (c.rowStart != null) {
    c.hex = bufferToHex(statsBuf, c.rowStart, stride)
  }
}

function anchorDecoderCandidates(
  statsBuf: Buffer,
  playerDatId: number,
  idHitCount: number,
  occ: readonly number[],
): StatCandidate[] {
  const out: StatCandidate[] = []
  for (const anchor of occ) {
    const v4 = statsBuf.readInt32LE(anchor + 4)
    const layout = detectPlayerStatsRowLayout(statsBuf, anchor, playerDatId)
    const summary = readSummaryStatsAtAnchor(statsBuf, anchor, playerDatId, idHitCount)
    if (summary) {
      out.push({
        source: 'player stats.dat:anchor_summary',
        file: 'player stats.dat',
        offset: anchor,
        idAnchor: anchor,
        playerDatId,
        apps: summary.apps,
        goals: summary.goals,
        assists: summary.assists,
        decoder: `summary_v7:${classifySeniorClubSlotKind(statsBuf, anchor, playerDatId, idHitCount)}`,
        field: `v4=${v4} +${SF.appsSenior}/+${SF.goalsSenior}/+${SF.assistsSenior} +${SF.apps}/+${SF.goals}/+${SF.assists}`,
      })
    }

    const heuristic = decodePlayerStatsRowAtAnchor(statsBuf, anchor, playerDatId)
    if (
      heuristic.apps != null ||
      heuristic.goals != null ||
      heuristic.assists != null
    ) {
      out.push({
        source: 'player stats.dat:anchor_heuristic_v1',
        file: 'player stats.dat',
        offset: anchor,
        idAnchor: anchor,
        playerDatId,
        apps: heuristic.apps,
        goals: heuristic.goals,
        assists: heuristic.assists,
        decoder: `heuristic_v1:${heuristic.layout ?? layout}`,
        field: `layout=${layout}`,
      })
    }

    const rowStart = anchor - GRID.idOffsetInRow
    if (rowStart >= GRID.headerBytes && rowStart + GRID.stride <= statsBuf.length) {
      const aligned = decodePlayerStatsGridRow(statsBuf, rowStart, GRID)
      if (aligned?.playerDatId === playerDatId) {
        out.push({
          source: 'player stats.dat:anchor_grid_aligned',
          file: 'player stats.dat',
          offset: anchor,
          rowStart,
          idAnchor: anchor,
          playerDatId,
          competitionId: aligned.competitionId,
          apps: aligned.apps,
          goals: aligned.goals,
          assists: aligned.assists,
          rating: aligned.averageRating,
          decoder: 'grid_v0@aligned_row',
        })
      }
    }
  }
  return out
}

export function probePlayerStatsHistoryTmp(
  buf: Buffer | null,
  playerDatId: number,
): PlayerStatsDiscoveryReport['players'][0]['playerStatsHistoryTmp'] {
  if (!buf?.length) return null

  const headerUint32: number[] = []
  for (let i = 0; i < Math.min(64, Math.floor(buf.length / 4)); i++) {
    headerUint32.push(buf.readUInt32LE(i * 4))
  }

  const needle = Buffer.allocUnsafe(4)
  needle.writeInt32LE(playerDatId, 0)
  const idHits: number[] = []
  let pos = 0
  while (pos < buf.length - 3) {
    const i = buf.indexOf(needle, pos)
    if (i === -1) break
    idHits.push(i)
    pos = i + 1
    if (idHits.length >= 200) break
  }

  const windows: Array<{ offset: number; hex: string }> = []
  windows.push({ offset: 0, hex: bufferToHex(buf, 0, Math.min(256, buf.length)) })
  for (const hit of idHits.slice(0, 32)) {
    windows.push({
      offset: hit,
      hex: bufferToHex(buf, hit - 32, 128),
    })
  }

  return { byteLength: buf.length, headerUint32, idHits, windows }
}

export function listSaveBlockInventory(
  readBlock: (name: string) => Buffer | null,
): SaveBlockInventoryEntry[] {
  const names = [
    'player stats.dat',
    'staff_history.dat',
    'player stats history.tmp',
    'match_stats_matches.tmp',
  ]
  return names.map((name) => {
    const buf = readBlock(name)
    return { name, size: buf?.length ?? 0, present: (buf?.length ?? 0) > 0 }
  })
}

export interface BuildDiscoveryReportInput {
  savePath: string
  gameDateIso: string | null
  blockInventory: SaveBlockInventoryEntry[]
  playerStatsBuf: Buffer | null
  playerStatsHistoryBuf: Buffer | null
  staffHistoryRows: StaffHistoryRecord[]
  staffHistorySource: 'embedded' | 'sibling' | 'none'
  players: Array<{
    name: string
    playerDatId: number
    staffId: number
    staffRowOffset: number | null
    club: string
    clubJobId: number
  }>
  clubCompsById?: Map<number, ClubCompRecord>
  staffCompsById?: Map<number, StaffCompRecord>
  staffById: Map<number, { int_apps: number; int_goals: number }>
  expected?: ExpectedStats | null
}

export function buildPlayerDiscoveryReport(input: BuildDiscoveryReportInput): PlayerStatsDiscoveryReport {
  const {
    savePath,
    gameDateIso,
    blockInventory,
    playerStatsBuf,
    playerStatsHistoryBuf,
    staffHistoryRows,
    players,
    clubCompsById,
    staffCompsById,
    staffById,
    expected = null,
  } = input

  const playerIds = new Set(players.map((p) => p.playerDatId))
  const occByPlayer =
    playerStatsBuf && playerStatsBuf.length
      ? collectPlayerDatIdOccurrences(playerStatsBuf, playerIds)
      : new Map<number, number[]>()

  const reportPlayers = players.map((p) => {
    const { rows, candidates: shCandidates, latestYearAtClub } = staffHistoryCandidates(
      staffHistoryRows,
      p.staffId,
      p.clubJobId,
    )

    const staffRec = staffById.get(p.staffId)
    const staffDat: StatCandidate | null = staffRec
      ? {
          source: 'staff.dat',
          file: 'staff.dat',
          offset: (p.staffRowOffset ?? 0) + STAFF_INT_APPS_ROW_OFFSET,
          apps: staffRec.int_apps,
          goals: staffRec.int_goals,
          assists: null,
          rating: null,
          staffId: p.staffId,
          playerDatId: p.playerDatId,
          field: `int_apps@+${STAFF_INT_APPS_ROW_OFFSET} int_goals@+${STAFF_INT_GOALS_ROW_OFFSET}`,
          note: 'International caps only — not club season stats',
        }
      : null

    let playerStatsSection: PlayerStatsDiscoveryReport['players'][0]['playerStatsDat'] = null
    const decoderSideBySide: StatCandidate[] = []
    const u8Candidates: StatCandidate[] = []
    let gridRows: DecodedPlayerStatsGridRow[] = []
    let anchors: ReturnType<typeof inspectSeniorClubAnchorsForPlayer> = []

    if (playerStatsBuf?.length) {
      const occ = occByPlayer.get(p.playerDatId) ?? []
      const idHitCount = occ.length
      gridRows = collectGridRowsForPlayer(playerStatsBuf, p.playerDatId, playerIds)
      anchors = inspectSeniorClubAnchorsForPlayer(playerStatsBuf, p.playerDatId, idHitCount)

      decoderSideBySide.push(...anchorDecoderCandidates(playerStatsBuf, p.playerDatId, idHitCount, occ))

      for (const anchor of occ) {
        u8Candidates.push(...scanU8CandidatesNearAnchor(playerStatsBuf, anchor, p.playerDatId, 64))
      }
      for (const r of gridRows) {
        u8Candidates.push(...scanU8CandidatesInGridRow(playerStatsBuf, r.rowStart, p.playerDatId))
      }
    }

    const gridCandidates = gridRows.map((r) => {
      const c = gridRowToCandidate(r, clubCompsById, staffCompsById)
      if (playerStatsBuf) fixGridCandidateHex(c, playerStatsBuf, GRID.stride)
      return c
    })

    const anchorSummaryFromInspect: StatCandidate[] = anchors.map((a) => ({
      source: 'player stats.dat:anchor_summary',
      file: 'player stats.dat',
      offset: a.anchor,
      idAnchor: a.anchor,
      playerDatId: p.playerDatId,
      apps: a.stats.apps,
      goals: a.stats.goals,
      assists: a.stats.assists,
      decoder: `inspect:${a.kind}`,
      field: `v4=${a.v4} rec@${a.recStart ?? '—'}`,
      note: a.passesCandidateFilter ? 'passes summary candidate filter' : 'decode only',
    }))

    if (playerStatsBuf?.length) {
      playerStatsSection = {
        byteLength: playerStatsBuf.length,
        idHitCount: occByPlayer.get(p.playerDatId)?.length ?? 0,
        gridRows,
        anchors,
        decoderSideBySide,
        u8Candidates,
      }
    }

    const historyTmp = probePlayerStatsHistoryTmp(playerStatsHistoryBuf, p.playerDatId)
    const historyCandidates: StatCandidate[] = []
    if (historyTmp) {
      historyCandidates.push({
        source: 'player stats history.tmp:header',
        file: 'player stats history.tmp',
        offset: 0,
        field: `first_${historyTmp.headerUint32.length}_uint32`,
        note: historyTmp.headerUint32.slice(0, 8).join(', '),
        playerDatId: p.playerDatId,
      })
      for (const hit of historyTmp.idHits) {
        historyCandidates.push({
          source: 'player stats history.tmp:id_hit',
          file: 'player stats history.tmp',
          offset: hit,
          playerDatId: p.playerDatId,
          hex: bufferToHex(playerStatsHistoryBuf!, hit - 32, 128),
        })
      }
    }

    const nonU8: StatCandidate[] = [
      ...shCandidates,
      ...(staffDat ? [staffDat] : []),
      ...gridCandidates,
      ...anchorSummaryFromInspect,
      ...decoderSideBySide,
      ...historyCandidates,
    ]

    tagExpectMatches(nonU8, expected ?? null)
    tagExpectMatches(u8Candidates, expected ?? null)

    const u8Expect = u8Candidates.filter((c) => c.matchesExpect)
    const u8Rest = u8Candidates.filter((c) => !c.matchesExpect)
    const u8Export = [
      ...u8Expect,
      ...u8Rest.slice(0, Math.max(0, MAX_U8_SCAN_CANDIDATES_EXPORT - u8Expect.length)),
    ]

    const candidates: StatCandidate[] = [...nonU8, ...u8Export]
    const expectMatches = candidates.filter((c) => c.matchesExpect)

    return {
      identity: {
        name: p.name,
        playerDatId: p.playerDatId,
        staffId: p.staffId,
        staffRowOffset: p.staffRowOffset,
        club: p.club,
        clubJobId: p.clubJobId,
      },
      staffHistory: {
        rows,
        latestYearAtClub,
        note: 'Assists and average rating are not stored in staff_history.dat (17-byte TStaffHistory).',
      },
      staffDat,
      playerStatsDat: playerStatsSection,
      playerStatsHistoryTmp: historyTmp,
      candidates,
      expectMatches,
    }
  })

  return {
    savePath,
    gameDateIso,
    blockInventory,
    expected: expected ?? null,
    players: reportPlayers,
  }
}

/** Flatten all candidates across players (for JSON export). */
export function flattenCandidates(report: PlayerStatsDiscoveryReport): StatCandidate[] {
  return report.players.flatMap((p) => p.candidates)
}

export function formatDiscoveryReportText(report: PlayerStatsDiscoveryReport): string {
  const lines: string[] = []
  lines.push(`\n=== CM0102 player stats discovery — ${report.savePath} ===`)
  lines.push(`gameDate: ${report.gameDateIso ?? '?'}`)
  if (report.expected) {
    lines.push(
      `expect: apps=${report.expected.apps ?? '—'} goals=${report.expected.goals ?? '—'} assists=${report.expected.assists ?? '—'} rating=${report.expected.rating ?? '—'}`,
    )
  }
  lines.push('\n── Save blocks ──')
  for (const b of report.blockInventory) {
    lines.push(`  ${b.present ? b.size.toString().padStart(10) : '     (missing)'}  ${b.name}`)
  }
  lines.push(
    '\nIn CM: Player profile → Stats → Senior club (combined league + cups). Compare apps / goals / assists / av. rating.\n',
  )

  for (const pl of report.players) {
    const id = pl.identity
    lines.push(`${'═'.repeat(72)}`)
    lines.push(`${id.name}`)
    lines.push(
      `  player.dat id=${id.playerDatId}  staff=${id.staffId}  club=${id.club || '?'}  staffRow@${id.staffRowOffset ?? '—'}`,
    )

    lines.push(`\n  ── staff_history.dat (${pl.staffHistory.rows.length} row(s)) ──`)
    lines.push(`  ${pl.staffHistory.note}`)
    if (pl.staffHistory.latestYearAtClub) {
      const ly = pl.staffHistory.latestYearAtClub
      lines.push(
        `  Latest year at club (${ly.year}): apps=${ly.apps} goals=${ly.goals} (${ly.rowCount} row(s))`,
      )
    }
    for (const r of pl.staffHistory.rows) {
      lines.push(
        `    year=${r.year} club=${r.clubId} loan=${r.onLoan} apps=${r.apps} goals=${r.goals}  [history id=${r.id}]`,
      )
    }

    if (pl.staffDat) {
      lines.push(`\n  ── staff.dat (international) ──`)
      lines.push(`    int_apps=${pl.staffDat.apps} int_goals=${pl.staffDat.goals}  (${pl.staffDat.note})`)
    }

    if (pl.playerStatsDat) {
      const ps = pl.playerStatsDat
      lines.push(`\n  ── player stats.dat (${ps.byteLength} bytes, id hits=${ps.idHitCount}) ──`)
      lines.push(`  Grid V0 rows with stats: ${ps.gridRows.length}`)
      lines.push(`  Senior-club anchor inspections: ${ps.anchors.length}`)
      lines.push(`  Decoder side-by-side entries: ${ps.decoderSideBySide.length}`)
      lines.push(`  U8 scan candidates: ${ps.u8Candidates.length}`)

      if (report.expected && pl.expectMatches.length) {
        lines.push(`\n  ★ EXPECT MATCHES (${pl.expectMatches.length}) ──`)
        for (const m of pl.expectMatches.slice(0, 40)) {
          lines.push(
            `    ${m.source} @${m.offset}  apps=${m.apps ?? '—'} g=${m.goals ?? '—'} a=${m.assists ?? '—'} rat=${m.rating ?? '—'}  ${m.decoder ?? m.field ?? ''}`,
          )
        }
        if (pl.expectMatches.length > 40) lines.push(`    ... ${pl.expectMatches.length - 40} more`)
      }

      lines.push(`\n  Grid rows (first 40 of ${ps.gridRows.length}):`)
      lines.push('  row@     compId  apps  g   a   rat')
      for (const r of ps.gridRows.slice(0, 40)) {
        const rat = r.averageRating != null ? r.averageRating.toFixed(2) : '—'
        lines.push(
          `  ${String(r.rowStart).padStart(7)}  ${String(r.competitionId ?? '—').padStart(6)}  ${String(r.apps ?? '—').padStart(3)} ${String(r.goals ?? '—').padStart(2)} ${String(r.assists ?? '—').padStart(2)}  ${rat.padStart(5)}`,
        )
      }
      if (ps.gridRows.length > 40) lines.push(`    ... ${ps.gridRows.length - 40} more`)

      lines.push(`\n  Anchor inspections (first 25 of ${ps.anchors.length}):`)
      lines.push('  anchor   kind            v4    apps  g   a')
      for (const a of ps.anchors.slice(0, 25)) {
        lines.push(
          `  ${String(a.anchor).padStart(7)}  ${a.kind.padEnd(14)}  ${String(a.v4).padStart(5)}  ${a.stats.apps} ${a.stats.goals} ${a.stats.assists}`,
        )
      }
    }

    if (pl.playerStatsHistoryTmp) {
      const h = pl.playerStatsHistoryTmp
      lines.push(`\n  ── player stats history.tmp (${h.byteLength} bytes) ──`)
      lines.push(`  id hits: ${h.idHits.length}`)
      lines.push(`  header u32[0..7]: ${h.headerUint32.slice(0, 8).join(', ')}`)
    }

    lines.push(`\n  Total candidates: ${pl.candidates.length}`)
  }

  lines.push('\nDone. Use --json for full candidate list with provenance.\n')
  return lines.join('\n')
}
