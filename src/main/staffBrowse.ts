import type { ParsedDatabase, StaffRecord } from './database/types'
import { staffDisplayName, isValidPlayerRow } from './database/parser'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { staffHeuristicDetail, staffRoleHeuristicScore } from './staffHeuristic'

export type StaffBrowseFilter = {
  q: string
  nation: string
  club: string
  job: string
  includePlayers: boolean
}

export interface StaffGridRow {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  jobByte: number
  club: string
  nation: string
  determination: number
  score: number
  scoreDetail: string
  nonPlayerCa: number | null
}

/** Exported for IPC — same name check as player grid. */
export function isValidStaffName(
  s: StaffRecord,
  firstNames: string[],
  secondNames: string[],
  commonNames: string[],
): boolean {
  const fn = firstNames[s.first_name_id] ?? ''
  const sn = secondNames[s.second_name_id] ?? ''
  const cn = commonNames[s.common_name_id] ?? ''
  return !!(fn || sn || cn)
}

export function filterStaffGridRows(db: ParsedDatabase, f: StaffBrowseFilter): StaffGridRow[] {
  const {
    staff,
    players,
    clubNames,
    nationNames,
    firstNames,
    secondNames,
    commonNames,
    nonPlayersById,
  } = db
  const nPlayers = players.length
  const q = f.q.trim().toLowerCase()
  const nation = f.nation.trim().toLowerCase()
  const club = f.club.trim().toLowerCase()
  const job = f.job.trim().toLowerCase()

  const out: StaffGridRow[] = []
  staff.forEach((s, staffIndex) => {
    if (!isValidStaffName(s, firstNames, secondNames, commonNames)) return
    if (!f.includePlayers && isValidPlayerRow(s, firstNames, secondNames, commonNames, nPlayers)) return

    const name = staffDisplayName(s, firstNames, secondNames, commonNames)
    if (q && !name.toLowerCase().includes(q)) return

    const nat = nationNames.get(s.first_nation_id) ?? ''
    const nat2 =
      s.second_nation_id > 0 && s.second_nation_id !== s.first_nation_id
        ? (nationNames.get(s.second_nation_id) ?? '')
        : ''
    const nationDisp = nat2 ? `${nat} / ${nat2}` : nat
    if (nation) {
      const nlow = nationDisp.toLowerCase()
      if (!nlow.includes(nation) && !nat.toLowerCase().includes(nation) && !nat2.toLowerCase().includes(nation)) return
    }

    const clubName = clubNames.get(s.club_job_id) ?? ''
    if (club && !clubName.toLowerCase().includes(club)) return

    const jobLabel = staffJobForClubLabel(s.job_for_club)
    if (job && !jobLabel.toLowerCase().includes(job) && !String(s.job_for_club).includes(job)) return

    const np = s.non_player_id > 0 ? nonPlayersById?.get(s.non_player_id) : undefined
    const score = staffRoleHeuristicScore(s.job_for_club, np) + Math.min(10, Math.max(0, s.determination - 10))
    const scoreDetail = staffHeuristicDetail(s.job_for_club, np)

    out.push({
      staffIndex,
      staffId: s.id,
      name,
      jobLabel,
      jobByte: s.job_for_club,
      club: clubName,
      nation: nationDisp,
      determination: s.determination,
      score: Math.min(100, score),
      scoreDetail,
      nonPlayerCa: np?.currentAbility ?? null,
    })
  })
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return out
}
