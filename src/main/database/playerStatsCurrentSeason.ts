/**
 * CM History tab — current-season stats by scope (League / Cup / Continental / …).
 * Golden match: Joe Cole @ Blackburn save (Aug 2005).
 *
 * `player stats history.tmp` row (player.dat id @ +0):
 *   apps +4, goals +5, assists +6, scope category u8 @ +12
 *   scope: 1=Cup, 2=Continental, 3=League (4=Senior-club duplicate in history — prefer player stats.dat)
 *
 * `player stats.dat` embedded record (Cole-style, rec @ anchor−40):
 *   Senior club totals: apps +65, goals +66, assists +104, rating u8 +64 (÷10)
 */

import { embeddedIdRecordStart } from './playerStatsSummary'
import { collectPlayerDatIdOccurrences, pickPlayerStatsAnchor } from './playerStatsDat'
import type { PlayerRecord } from './types'

export const PLAYER_STATS_HISTORY_RECORD = {
  playerDatIdRel: 0,
  appsRel: 4,
  goalsRel: 5,
  assistsRel: 6,
  scopeRel: 12,
} as const

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

const EMBEDDED_SENIOR = {
  appsRel: 65,
  goalsRel: 66,
  assistsRel: 104,
  ratingRel: 64,
  ratingScale: 0.1,
} as const

function readU8(buf: Buffer, base: number, rel: number): number | null {
  const i = base + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function ratingFromU8(v: number | null): number | null {
  if (v == null || v < 50 || v > 100) return null
  return Math.round(v * EMBEDDED_SENIOR.ratingScale * 100) / 100
}

function plausibleTriple(apps: number, goals: number, assists: number): boolean {
  if (apps > 60 || goals > 40 || assists > 40) return false
  if (goals > apps || assists > apps) return false
  return true
}

function decodeHistoryRecord(buf: Buffer, rowStart: number): {
  playerDatId: number
  apps: number
  goals: number
  assists: number
  scope: number
} | null {
  if (rowStart + R.scopeRel + 1 > buf.length) return null
  const playerDatId = buf.readInt32LE(rowStart + R.playerDatIdRel)
  const apps = readU8(buf, rowStart, R.appsRel)
  const goals = readU8(buf, rowStart, R.goalsRel)
  const assists = readU8(buf, rowStart, R.assistsRel)
  const scope = readU8(buf, rowStart, R.scopeRel)
  if (apps == null || goals == null || assists == null || scope == null) return null
  if (!plausibleTriple(apps, goals, assists)) return null
  return { playerDatId, apps, goals, assists, scope }
}

function pushHistoryRow(
  out: Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>>,
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

/** One pass over `player stats history.tmp` (4-byte step at id @ +0). */
export function indexPlayerStatsHistoryByPlayerDatId(
  buf: Buffer,
  playerIds?: ReadonlySet<number>,
): Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>> {
  const out = new Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>>()
  if (!buf.length) return out

  const max = buf.length - R.scopeRel
  for (let rowStart = 0; rowStart <= max; rowStart += 4) {
    if (playerIds) {
      const maybeId = buf.readInt32LE(rowStart)
      if (!playerIds.has(maybeId)) continue
    }
    const rec = decodeHistoryRecord(buf, rowStart)
    if (!rec) continue
    if (playerIds && !playerIds.has(rec.playerDatId)) continue
    pushHistoryRow(out, rec)
  }
  return out
}

function readEmbeddedSeniorClub(
  statsBuf: Buffer,
  playerDatId: number,
): CmScopeStatRow | null {
  const occ = collectPlayerDatIdOccurrences(statsBuf, new Set([playerDatId])).get(playerDatId) ?? []
  const anchor = pickPlayerStatsAnchor(statsBuf, playerDatId, occ)
  if (anchor == null) return null
  const rec = embeddedIdRecordStart(statsBuf, anchor, playerDatId)
  if (rec == null) return null
  const apps = readU8(statsBuf, rec, EMBEDDED_SENIOR.appsRel)
  const goals = readU8(statsBuf, rec, EMBEDDED_SENIOR.goalsRel)
  const assists = readU8(statsBuf, rec, EMBEDDED_SENIOR.assistsRel)
  if (apps == null || goals == null || assists == null) return null
  if (!plausibleTriple(apps, goals, assists)) return null
  return {
    key: 'seniorClub',
    label: 'Senior club',
    apps,
    goals,
    assists,
    averageRating: ratingFromU8(readU8(statsBuf, rec, EMBEDDED_SENIOR.ratingRel)),
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
): PlayerCurrentSeasonStats {
  const histRows =
    historyByPlayer?.get(playerDatId) ??
    (historyBuf?.length ? historyRowsForPlayer(historyBuf, playerDatId) : [])
  const seniorClub = statsBuf?.length ? readEmbeddedSeniorClub(statsBuf, playerDatId) : null

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

export function indexAllPlayersHistory(
  historyBuf: Buffer | null | undefined,
  players: readonly PlayerRecord[],
): Map<number, Array<{ apps: number; goals: number; assists: number; scope: number }>> | undefined {
  if (!historyBuf?.length) return undefined
  const ids = new Set(players.map((p) => p.id))
  return indexPlayerStatsHistoryByPlayerDatId(historyBuf, ids)
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
  /** True when Senior club or any scope row has decoded data for this save. */
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

export function indexedFromDecoded(decoded: PlayerCurrentSeasonStats): PlayerCurrentSeasonIndexed {
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
    international.assists > 0

  return {
    scopes: decoded.scopes,
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
): Map<number, PlayerCurrentSeasonIndexed> {
  const out = new Map<number, PlayerCurrentSeasonIndexed>()
  if (!historyBuf?.length && !statsBuf?.length) return out

  const historyByPlayer = historyBuf?.length
    ? indexAllPlayersHistory(historyBuf, players)
    : undefined

  const intlByPlayerId = new Map<number, { apps: number; goals: number }>()
  for (const s of staff) {
    const pid = players[s.player_id]?.id
    if (pid != null) intlByPlayerId.set(pid, { apps: s.int_apps, goals: s.int_goals })
  }

  const seen = new Set<number>()
  for (const s of staff) {
    const pid = players[s.player_id]?.id
    if (pid == null || seen.has(pid)) continue
    seen.add(pid)
    const decoded = decodePlayerCurrentSeasonStats(
      pid,
      null,
      statsBuf,
      historyByPlayer,
      intlByPlayerId.get(pid) ?? null,
    )
    const indexed = indexedFromDecoded(decoded)
    if (indexed.available) out.set(pid, indexed)
  }
  return out
}
