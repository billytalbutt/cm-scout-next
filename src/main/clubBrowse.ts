import { applyCmScoutRatings } from './cmScoutRating'
import { applyEffectivenessRatings } from './effectivenessRating'
import { buildUiPlayerRowAtIndex, isValidPlayerRow, staffDisplayName } from './database/parser'
import { nonPlayerForStaffLink } from './database/nonplayer'
import { tryExperimentalPitchFromTacticRow } from './database/tacticsDat'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { mapUiRowToGridPayload } from './gridRowPayload'
import type { GridPlayerRow } from '../shared/gridTypes'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { staffHeuristicDetail, staffRoleHeuristicScore } from './staffHeuristic'

export interface ClubListRow {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
}

export function filterClubListRows(db: ParsedDatabase, q: string): ClubListRow[] {
  const clubs = db.clubsById
  if (!clubs || clubs.size === 0) return []
  const ql = q.trim().toLowerCase()
  const out: ClubListRow[] = []
  for (const c of clubs.values()) {
    if (ql && !c.name.toLowerCase().includes(ql)) continue
    const nation = db.nationNames.get(c.nationId) ?? ''
    const comp = db.clubCompsById?.get(c.divisionCompId)
    const division = comp?.name ?? (c.divisionCompId ? `#${c.divisionCompId}` : '—')
    out.push({
      id: c.id,
      name: c.name,
      nation,
      division,
      reputation: c.reputation,
      cash: c.cash,
      stadiumId: c.stadiumId,
    })
  }
  out.sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name))
  return out
}

export interface ClubSquadPlayerRow {
  staffIndex: number
  name: string
  ca: number
  pa: number
  club: string
  cmScoutRatingBp?: number
  effPercent?: number | null
  effArchetype?: string
}

export interface ClubStaffRow {
  staffIndex: number
  name: string
  jobLabel: string
  score: number
  scoreDetail: string
  staffCa: number | null
}

/** `staff.club_job_id` and `contract.club_id` can disagree on some saves (see profilePayload). */
function staffEmployedAtClub(db: ParsedDatabase, staffIndex: number, clubId: number): boolean {
  const s = db.staff[staffIndex]
  if (!s) return false
  if (s.club_job_id === clubId) return true
  const contract = db.contractsByStaffIndex.get(staffIndex)
  return contract?.club_id === clubId
}

function uiRowEmployedAtClub(ui: UiPlayerRow, clubId: number): boolean {
  if (ui.staff.club_job_id === clubId) return true
  return ui.contract?.club_id === clubId
}

function appendSquadPlayerRow(
  db: ParsedDatabase,
  out: ClubSquadPlayerRow[],
  seen: Set<number>,
  staffIndex: number,
  clubId: number,
): void {
  if (seen.has(staffIndex)) return
  const s = db.staff[staffIndex]
  if (!s) return
  if (s.player_id < 0 || s.player_id >= db.players.length) return
  if (!staffEmployedAtClub(db, staffIndex, clubId)) return
  const built = buildUiPlayerRowAtIndex(db, staffIndex)
  if (!built || !uiRowEmployedAtClub(built, clubId)) return
  const name = built.name.trim()
  if (!name || name.startsWith('#')) return
  applyCmScoutRatings([built])
  applyEffectivenessRatings([built])
  seen.add(staffIndex)
  out.push({
    staffIndex,
    name,
    ca: built.ca,
    pa: built.pa,
    club: built.club,
    cmScoutRatingBp: built.cmScoutRatingBp,
    effPercent: built.effPercent ?? null,
    effArchetype: built.effArchetype,
  })
}

/**
 * All playable staff employed at the club (`club_job_id` or contract `club_id`).
 * Does not rely on `club.dat` squad slot lists — those often decode incomplete on real saves.
 */
export function buildClubSquadPlayerRows(db: ParsedDatabase, clubId: number): ClubSquadPlayerRow[] {
  const club = db.clubsById?.get(clubId)
  if (!club) return []
  const seen = new Set<number>()
  const out: ClubSquadPlayerRow[] = []

  for (let staffIndex = 0; staffIndex < db.staff.length; staffIndex++) {
    appendSquadPlayerRow(db, out, seen, staffIndex, clubId)
  }

  out.sort((a, b) => b.ca - a.ca || a.name.localeCompare(b.name))
  return out
}

/** Player-linked `job_for_club` roles (11–16) — listed under Squad, not Staff. */
export function isPlayerStaffJobRole(jobForClub: number): boolean {
  return jobForClub >= 11 && jobForClub <= 16
}

/**
 * Backroom staff employed at the club (coaches, scouts, manager, etc.).
 * Excludes squad players and player/manager hybrid job bytes.
 */
export function buildClubStaffRows(db: ParsedDatabase, clubId: number): ClubStaffRow[] {
  const club = db.clubsById?.get(clubId)
  if (!club) return []
  const { staff, firstNames, secondNames, commonNames, nonPlayersByRowIndex } = db
  const nPlayers = db.players.length
  const out: ClubStaffRow[] = []

  for (let staffIndex = 0; staffIndex < staff.length; staffIndex++) {
    const s = staff[staffIndex]
    if (!s) continue
    if (!staffEmployedAtClub(db, staffIndex, clubId)) continue
    if (isPlayerStaffJobRole(s.job_for_club)) continue
    if (isValidPlayerRow(s, firstNames, secondNames, commonNames, nPlayers)) continue

    const name = staffDisplayName(s, firstNames, secondNames, commonNames)
    if (!name || name.startsWith('#')) continue

    const np = nonPlayerForStaffLink(s.non_player_id, nonPlayersByRowIndex)
    const score = staffRoleHeuristicScore(s.job_for_club, np) + Math.min(10, Math.max(0, s.determination - 10))
    out.push({
      staffIndex,
      name,
      jobLabel: staffJobForClubLabel(s.job_for_club),
      score: Math.min(100, score),
      scoreDetail: staffHeuristicDetail(s.job_for_club, np),
      staffCa: np?.currentAbility ?? null,
    })
  }

  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return out
}

/** Squad as grid rows (role7 + positions for tactics lineup). */
export function buildClubSquadGridRows(db: ParsedDatabase, clubId: number): GridPlayerRow[] {
  const squad = buildClubSquadPlayerRows(db, clubId)
  const out: GridPlayerRow[] = []
  for (const s of squad) {
    const built = buildUiPlayerRowAtIndex(db, s.staffIndex)
    if (!built || !uiRowEmployedAtClub(built, clubId)) continue
    applyCmScoutRatings([built])
    applyEffectivenessRatings([built])
    out.push(mapUiRowToGridPayload(built, { role7: true, positions: true }))
  }
  return out
}

function hexPrefix(buf: Buffer, maxBytes: number): string {
  const n = Math.min(maxBytes, buf.length)
  return buf.subarray(0, n).toString('hex')
}

/** Full club detail for IPC / tactics lab (stadium + `tactics.dat` wire when present). */
export function buildClubDetailPayload(db: ParsedDatabase, clubId: number): Record<string, unknown> | null {
  const club = db.clubsById?.get(clubId)
  if (!club) return null
  const nation = db.nationNames.get(club.nationId) ?? ''
  const comp = db.clubCompsById?.get(club.divisionCompId)
  const squad = buildClubSquadPlayerRows(db, clubId)
  const staffRows = buildClubStaffRows(db, clubId)
  const stadiumRec = db.stadiumsById?.get(club.stadiumId)
  const stadium = stadiumRec
    ? {
        name: stadiumRec.name,
        cityId: stadiumRec.cityId,
        capacity: stadiumRec.capacity,
        seatingCapacity: stadiumRec.seatingCapacity,
        expansionCapacity: stadiumRec.expansionCapacity,
        nearbyStadiumId: stadiumRec.nearbyStadiumId,
        covered: stadiumRec.covered !== 0,
        underSoilHeating: stadiumRec.underSoilHeating !== 0,
      }
    : null

  const tacticRow = db.tacticsIndex?.byId.get(club.tacticSelectedId)
  const experimentalSlots = tacticRow ? tryExperimentalPitchFromTacticRow(tacticRow) : null

  const xiNames: { staffId: number; name: string }[] = []
  const { staff, firstNames, secondNames, commonNames } = db
  for (const sid of club.teamSelectedStaffIds) {
    if (sid <= 0 || xiNames.length >= 11) continue
    const staffIndex = staff.findIndex((s) => s.id === sid)
    if (staffIndex < 0) {
      xiNames.push({ staffId: sid, name: `#${sid}` })
      continue
    }
    const s = staff[staffIndex]!
    xiNames.push({
      staffId: sid,
      name: staffDisplayName(s, firstNames, secondNames, commonNames).trim() || `#${sid}`,
    })
  }

  return {
    id: club.id,
    name: club.name,
    nation,
    division: comp?.name ?? (club.divisionCompId ? `#${club.divisionCompId}` : '—'),
    reputation: club.reputation,
    cash: club.cash,
    stadiumId: club.stadiumId,
    attendance: club.attendance,
    training: club.training,
    squad,
    staff: staffRows,
    stadium,
    tacticSelectedId: club.tacticSelectedId,
    tacticTrainingIds: club.tacticTrainingIds,
    teamSelectedStaffIds: club.teamSelectedStaffIds,
    tacticsWire: {
      tacticsBlockPresent: !!db.tacticsIndex,
      tacticsRowBytes: db.tacticsIndex?.rowBytes ?? null,
      tacticsRowCount: db.tacticsIndex?.rowCount ?? null,
      tacticRowFound: !!tacticRow,
      tacticRowHexPrefix: tacticRow ? hexPrefix(tacticRow, 64) : null,
      experimentalSlots,
    },
    xiNames,
  }
}
