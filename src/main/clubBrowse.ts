import { applyCmScoutRatings } from './cmScoutRating'
import { buildUiPlayerRowAtIndex, staffDisplayName } from './database/parser'
import { tryExperimentalPitchFromTacticRow } from './database/tacticsDat'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { mapUiRowToGridPayload } from './gridRowPayload'
import type { GridPlayerRow } from '../shared/gridTypes'

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
}

export function buildClubSquadPlayerRows(db: ParsedDatabase, clubId: number): ClubSquadPlayerRow[] {
  const club = db.clubsById?.get(clubId)
  if (!club) return []
  const { staff, players, clubNames, firstNames, secondNames, commonNames } = db
  const nPlayers = players.length
  const clubLabel = club.name
  const out: ClubSquadPlayerRow[] = []
  const seen = new Set<number>()
  for (const sid of club.squadStaffIds) {
    if (sid <= 0 || seen.has(sid)) continue
    seen.add(sid)
    const staffIndex = staff.findIndex((s) => s.id === sid)
    if (staffIndex < 0) continue
    const s = staff[staffIndex]!
    if (s.player_id < 0 || s.player_id >= nPlayers) continue
    const p = players[s.player_id]
    if (!p) continue
    const fn = firstNames[s.first_name_id] ?? ''
    const sn = secondNames[s.second_name_id] ?? ''
    const cn = commonNames[s.common_name_id] ?? ''
    const name = cn.trim() || `${fn} ${sn}`.trim() || `#${s.id}`
    out.push({
      staffIndex,
      name,
      ca: p.current_ability,
      pa: p.potential_ability,
      club: clubNames.get(s.club_job_id) ?? clubLabel,
    })
  }
  out.sort((a, b) => b.ca - a.ca || a.name.localeCompare(b.name))
  return out
}

/** Squad as grid rows (role7 for tactics lineup %). */
export function buildClubSquadGridRows(
  db: ParsedDatabase,
  clubId: number,
  uiRowsByStaffIndex?: readonly (UiPlayerRow | undefined)[],
): GridPlayerRow[] {
  const squad = buildClubSquadPlayerRows(db, clubId)
  const out: GridPlayerRow[] = []
  for (const s of squad) {
    let ui = uiRowsByStaffIndex?.[s.staffIndex]
    if (!ui) {
      const built = buildUiPlayerRowAtIndex(db, s.staffIndex)
      if (!built) continue
      applyCmScoutRatings([built])
      ui = built
    }
    out.push(mapUiRowToGridPayload(ui, { role7: true }))
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
