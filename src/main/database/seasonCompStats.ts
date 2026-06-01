/**
 * Current-season player statistics from CM0102 per-competition blocks (`{Competition}_{id}.tmp`).
 *
 * Each such block contains a fixed array of **45-byte player records**. Verified against a real
 * save (golden: Meysam Javan @ Halmstad league 15/0/4/2 avg 7.73; Joe Cole @ Blackburn Charity
 * Shield 1/0/1 avg 9.00):
 *
 *   +0  u32  player.dat id
 *   +4  u32  staff.dat id        (record is valid iff staff[id].player_id === player.dat id)
 *   +8  u32  club.dat id
 *   +12 u16  appearances
 *   +14 u8   goals              (not u16 @16 — byte 16 is other data on real saves)
 *   +18 u8   assists
 *   +22 u8   man-of-the-match count
 *   +26 u16  rating sum          (average rating = ratingSum / apps, two decimals)
 *   +35 u8   dribbles total       (per game = dribbles / apps)
 *
 * Competitions are grouped into the same scopes CM shows on the player profile:
 *   League       — the player's domestic division (any club's `TClub.Division`, or a comp with a code)
 *   Cup          — domestic cups (nation-scoped, no league code)
 *   Continental  — continental competitions (`club_comp.nationId < 0`: Champions Cup, Super Cup, …)
 *   Senior club  — League + Cup + Continental (NOT international, NOT non-competitive friendlies)
 *
 * Note: leagues and most cups/continental comps expose this per-comp array; a few cups store their
 * player stats only in the per-match block, so a Senior-club total can occasionally undercount those.
 */
import type { ClubCompRecord } from './clubComp'
import {
  CM_STAT_SCOPE,
  PROFILE_SEASON_SCOPE_ORDER,
  type CmScopeStatRow,
  type CmStatScopeKey,
  type PlayerCompSeasonRow,
  type PlayerCurrentSeasonIndexed,
} from './playerStatsCurrentSeason'
import type { PlayerRecord, StaffRecord } from './types'

export const SEASON_COMP_RECORD_BYTES = 45

const REL = {
  playerDatId: 0,
  staffId: 4,
  clubId: 8,
  apps: 12,
  goals: 14,
  assists: 18,
  mom: 22,
  ratingSum: 26,
  dribbles: 35,
} as const

export type SeasonScope = 'league' | 'cup' | 'continental'

export interface SeasonCompBlock {
  compId: number
  buf: Buffer
}

interface SeasonCompRecord {
  compId: number
  scope: SeasonScope
  apps: number
  goals: number
  assists: number
  mom: number
  ratingSum: number
  dribbles: number
}

/** League if any club's division points to it, or it carries a competition code; continental if nationless; else cup. */
export function classifyCompScope(
  compId: number,
  clubComp: ClubCompRecord | undefined,
  leagueCompIds: ReadonlySet<number>,
): SeasonScope | null {
  if (leagueCompIds.has(compId)) return 'league'
  if (!clubComp) return null
  if (clubComp.threeLetter && /[A-Za-z0-9]/.test(clubComp.threeLetter)) return 'league'
  if (clubComp.nationId < 0) return 'continental'
  return 'cup'
}

/** Map `staff.dat` id → `player.dat` id, used to validate that a 45-byte record is a real player row. */
function buildPidByStaffId(staff: readonly StaffRecord[], players: readonly PlayerRecord[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const s of staff) {
    if (s.id <= 0) continue
    const p = players[s.player_id]
    if (p) m.set(s.id, p.id)
  }
  return m
}

function readRecord(
  buf: Buffer,
  off: number,
  pidByStaffId: Map<number, number>,
): { playerDatId: number; rec: Omit<SeasonCompRecord, 'compId' | 'scope'> } | null {
  if (off + SEASON_COMP_RECORD_BYTES > buf.length) return null
  const playerDatId = buf.readUInt32LE(off + REL.playerDatId)
  const staffId = buf.readUInt32LE(off + REL.staffId)
  if (pidByStaffId.get(staffId) !== playerDatId) return null
  const apps = buf.readUInt16LE(off + REL.apps)
  const goals = buf.readUInt8(off + REL.goals)
  const assists = buf.readUInt8(off + REL.assists)
  if (apps > 80 || goals > 80 || assists > 80) return null
  if (!plausibleSeasonRow(apps, goals, assists, buf.readUInt16LE(off + REL.ratingSum))) return null
  return {
    playerDatId,
    rec: {
      apps,
      goals,
      assists,
      mom: buf.readUInt8(off + REL.mom),
      ratingSum: buf.readUInt16LE(off + REL.ratingSum),
      dribbles: buf.readUInt8(off + REL.dribbles),
    },
  }
}

function emptyTotals() {
  return { apps: 0, goals: 0, assists: 0, mom: 0, ratingSum: 0, dribbles: 0 }
}

/** Reject sliding-window false positives (e.g. 60 apps, zero rating sum). */
function plausibleSeasonRow(apps: number, goals: number, assists: number, ratingSum: number): boolean {
  if (apps === 0 && goals === 0 && assists === 0) return false
  if (goals > apps || assists > apps) return false
  if (apps > 50) return false
  if (apps > 0 && ratingSum > 0) {
    const avg = ratingSum / apps
    if (avg < 4.5 || avg > 10.5) return false
  } else if (apps > 3) return false
  return true
}

function recordPickScore(
  off: number,
  apps: number,
  goals: number,
  assists: number,
  ratingSum: number,
  blockAlignMod: number | null,
): number {
  let s = 0
  if (blockAlignMod != null && off % SEASON_COMP_RECORD_BYTES === blockAlignMod) s += 40
  if (apps > 0 && apps <= 50) s += 15
  if (goals <= apps && assists <= apps) s += 10
  if (apps > 0 && ratingSum > 0) {
    const avg = ratingSum / apps
    if (avg >= 5 && avg <= 10) s += 35
    else if (avg >= 4.5 && avg <= 10.5) s += 15
  } else if (apps > 0 && apps <= 3) s += 5
  else if (apps > 3) s -= 40
  if (apps > 35) s -= 50
  return s
}

/** Dominant `offset % 45` among validated rows in a competition block. */
function detectBlockAlignmentMod(buf: Buffer, pidByStaffId: Map<number, number>): number | null {
  const counts = new Map<number, number>()
  const last = buf.length - SEASON_COMP_RECORD_BYTES
  for (let off = 0; off <= last; off++) {
    const hit = readRecord(buf, off, pidByStaffId)
    if (!hit) continue
    const mod = off % SEASON_COMP_RECORD_BYTES
    counts.set(mod, (counts.get(mod) ?? 0) + 1)
  }
  let best: number | null = null
  let bestN = 0
  for (const [mod, n] of counts) {
    if (n > bestN) {
      bestN = n
      best = mod
    }
  }
  return bestN >= 3 ? best : null
}

function avg(ratingSum: number, apps: number): number | null {
  if (apps <= 0) return null
  return Math.round((ratingSum / apps) * 100) / 100
}

function perGame(total: number, apps: number): number | null {
  if (apps <= 0) return null
  return Math.round((total / apps) * 10) / 10
}

function scopeRow(
  key: CmStatScopeKey,
  label: string,
  t: ReturnType<typeof emptyTotals>,
): CmScopeStatRow {
  return {
    key,
    label,
    apps: t.apps,
    goals: t.goals,
    assists: t.assists,
    averageRating: avg(t.ratingSum, t.apps),
    mom: t.mom,
    dribbles: perGame(t.dribbles, t.apps),
    source: 'competition.tmp',
  }
}

/**
 * Build the current-season index keyed by `player.dat` id from per-competition `.tmp` blocks.
 */
export function buildSeasonCompIndex(
  compBlocks: readonly SeasonCompBlock[],
  staff: readonly StaffRecord[],
  players: readonly PlayerRecord[],
  clubCompsById: Map<number, ClubCompRecord> | undefined,
  leagueCompIds: ReadonlySet<number>,
): Map<number, PlayerCurrentSeasonIndexed> {
  const out = new Map<number, PlayerCurrentSeasonIndexed>()
  if (!compBlocks.length) return out
  const pidByStaffId = buildPidByStaffId(staff, players)
  if (!pidByStaffId.size) return out

  const byPlayer = new Map<number, SeasonCompRecord[]>()
  for (const { compId, buf } of compBlocks) {
    const scope = classifyCompScope(compId, clubCompsById?.get(compId), leagueCompIds)
    if (!scope) continue
    const blockAlignMod = detectBlockAlignmentMod(buf, pidByStaffId)
    const bestByPlayer = new Map<number, { rec: Omit<SeasonCompRecord, 'compId' | 'scope'>; score: number }>()
    const last = buf.length - SEASON_COMP_RECORD_BYTES
    for (let off = 0; off <= last; off++) {
      const hit = readRecord(buf, off, pidByStaffId)
      if (!hit) continue
      const score = recordPickScore(
        off,
        hit.rec.apps,
        hit.rec.goals,
        hit.rec.assists,
        hit.rec.ratingSum,
        blockAlignMod,
      )
      const prev = bestByPlayer.get(hit.playerDatId)
      if (!prev || score > prev.score) bestByPlayer.set(hit.playerDatId, { rec: hit.rec, score })
    }
    for (const [playerDatId, { rec }] of bestByPlayer) {
      const list = byPlayer.get(playerDatId)
      const row: SeasonCompRecord = { compId, scope, ...rec }
      if (list) list.push(row)
      else byPlayer.set(playerDatId, [row])
    }
  }

  for (const [playerDatId, recs] of byPlayer) {
    const scopeTotals: Record<SeasonScope, ReturnType<typeof emptyTotals>> = {
      league: emptyTotals(),
      cup: emptyTotals(),
      continental: emptyTotals(),
    }
    const byCompetition: PlayerCompSeasonRow[] = []
    for (const r of recs) {
      const t = scopeTotals[r.scope]
      t.apps += r.apps
      t.goals += r.goals
      t.assists += r.assists
      t.mom += r.mom
      t.ratingSum += r.ratingSum
      t.dribbles += r.dribbles
      byCompetition.push({
        competitionId: r.compId,
        competitionName: clubCompsById?.get(r.compId)?.name ?? `#${r.compId}`,
        apps: r.apps,
        goals: r.goals,
        assists: r.assists,
        averageRating: avg(r.ratingSum, r.apps),
        mom: r.mom,
        dribbles: perGame(r.dribbles, r.apps),
      })
    }

    const senior = emptyTotals()
    for (const s of ['league', 'cup', 'continental'] as const) {
      senior.apps += scopeTotals[s].apps
      senior.goals += scopeTotals[s].goals
      senior.assists += scopeTotals[s].assists
      senior.mom += scopeTotals[s].mom
      senior.ratingSum += scopeTotals[s].ratingSum
      senior.dribbles += scopeTotals[s].dribbles
    }

    const scopeRowsByKey: Record<CmStatScopeKey, CmScopeStatRow> = {
      nonCompetitive: scopeRow('nonCompetitive', 'Non Competitive', emptyTotals()),
      league: scopeRow('league', 'League', scopeTotals.league),
      cup: scopeRow('cup', 'Cup', scopeTotals.cup),
      continental: scopeRow('continental', 'Continental', scopeTotals.continental),
      international: scopeRow('international', 'International', emptyTotals()),
      seniorClub: scopeRow('seniorClub', 'Senior club', senior),
    }

    byCompetition.sort((a, b) => a.competitionName.localeCompare(b.competitionName))

    const available =
      senior.apps > 0 || senior.goals > 0 || senior.assists > 0 || byCompetition.length > 0

    out.set(playerDatId, {
      scopes: PROFILE_SEASON_SCOPE_ORDER.map((k) => scopeRowsByKey[k]),
      byCompetition,
      seniorApps: senior.apps,
      seniorGoals: senior.goals,
      seniorAssists: senior.assists,
      seniorAvgRating: avg(senior.ratingSum, senior.apps),
      leagueApps: scopeTotals.league.apps,
      leagueGoals: scopeTotals.league.goals,
      leagueAssists: scopeTotals.league.assists,
      cupApps: scopeTotals.cup.apps,
      cupGoals: scopeTotals.cup.goals,
      cupAssists: scopeTotals.cup.assists,
      continentalApps: scopeTotals.continental.apps,
      continentalGoals: scopeTotals.continental.goals,
      continentalAssists: scopeTotals.continental.assists,
      internationalApps: 0,
      internationalGoals: 0,
      internationalAssists: 0,
      available,
    })
  }

  return out
}

/** Collect `{Competition}_{id}.tmp` blocks (club competitions only) for season-stat decoding. */
export function collectSeasonCompBlocks(
  blockNames: readonly string[],
  readBlock: (name: string) => Buffer | null,
  isClubComp: (compId: number) => boolean,
): SeasonCompBlock[] {
  const out: SeasonCompBlock[] = []
  for (const name of blockNames) {
    const m = /_(\d+)\.tmp$/.exec(name)
    if (!m) continue
    const compId = Number(m[1])
    if (!Number.isFinite(compId) || !isClubComp(compId)) continue
    const buf = readBlock(name)
    if (buf && buf.length >= SEASON_COMP_RECORD_BYTES) out.push({ compId, buf })
  }
  return out
}
