import { nonPlayerForStaffLink } from './database/nonplayer'
import type { NonPlayerRecord, ParsedDatabase, StaffRecord } from './database/types'
import { staffNpAttrInGame } from '../shared/cm0102StaffNpAttributeDisplay'
import { staffDisplayName, isValidPlayerRow } from './database/parser'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { staffHeuristicDetail, staffRoleHeuristicScore } from './staffHeuristic'
import {
  ALL_STAFF_ATTR_FILTERS,
  type StaffAttrFilterSpec,
} from '../shared/staffAttrCatalog'
import {
  contractTypeMatchesCategory,
  type ContractTypeCategoryId,
} from '../shared/contractTypes'
import { calendarDaysBetween, ageFromBirthYearOnly, ageOnGameDate } from './database/dates'
import {
  sanitizeStaffAbility,
  sanitizeStaffReputation,
  staffReputationDisplay,
  staffReputationRawFromNonPlayer,
} from '../shared/cm0102StaffMetrics'

export type StaffBrowseFilter = {
  q: string
  nation: string
  club: string
  /** When set, only rows with this `TStaff.JobForClub` byte. */
  jobForClub?: number
  includePlayers: boolean
  ageMin?: number
  ageMax?: number
  wageMin?: number
  wageMax?: number
  coachingCaMin?: number
  coachingCaMax?: number
  reputationMin?: number
  reputationMax?: number
  coachingPaMin?: number
  coachingPaMax?: number
  contractTypeCategory?: ContractTypeCategoryId
  contractExpiresWithinMonths?: number
  leavingOnBosman?: boolean
  euPassport?: boolean
  attrMins?: (number | null)[]
  attrMinMatchAtLeast?: number
}

export interface StaffGridRow {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  jobByte: number
  club: string
  nation: string
  reputationCurrent: number | null
  reputationLabel: string
  determination: number
  score: number
  scoreDetail: string
  staffCa: number | null
  staffPa: number | null
}

function isPlayerLinkedStaffRole(jobForClub: number): boolean {
  return jobForClub >= 11 && jobForClub <= 16
}

function staffReputationRaw(
  db: ParsedDatabase,
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
  nPlayers: number,
  firstNames: string[],
  secondNames: string[],
  commonNames: string[],
): number | null {
  if (np) {
    const fromNp = staffReputationRawFromNonPlayer(np)
    if (fromNp != null) return fromNp
  }
  if (
    isPlayerLinkedStaffRole(s.job_for_club) &&
    isValidPlayerRow(s, firstNames, secondNames, commonNames, nPlayers)
  ) {
    const p = db.players[s.player_id]
    if (p) return sanitizeStaffReputation(p.world_reputation)
  }
  return null
}

function staffCoachingCaRaw(np: NonPlayerRecord | undefined): number | null {
  return np ? sanitizeStaffAbility(np.currentAbility) : null
}

function staffCoachingPaRaw(np: NonPlayerRecord | undefined): number | null {
  return np ? sanitizeStaffAbility(np.potentialAbility) : null
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

function staffAttrRawValue(
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
  spec: StaffAttrFilterSpec,
): number | null {
  if (spec.source === 'staff' && spec.staffField) {
    return s[spec.staffField as keyof StaffRecord] as number
  }
  if (spec.source === 'np' && spec.npField) {
    if (!np) return null
    const raw = np[spec.npField as keyof NonPlayerRecord] as number
    return staffNpAttrInGame(spec.npField, raw, np.currentAbility)
  }
  return null
}

function passesStaffAttrMins(
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
  mins: (number | null | undefined)[],
  matchAtLeast?: number,
): boolean {
  if (!mins.length) return true
  const activeIdx: number[] = []
  for (let i = 0; i < ALL_STAFF_ATTR_FILTERS.length; i++) {
    const min = mins[i]
    if (min != null && min > 0) activeIdx.push(i)
  }
  if (activeIdx.length === 0) return true

  const need =
    matchAtLeast == null || !Number.isFinite(matchAtLeast) || matchAtLeast <= 0
      ? activeIdx.length
      : Math.min(Math.floor(matchAtLeast), activeIdx.length)

  let pass = 0
  for (const i of activeIdx) {
    const min = mins[i]!
    const v = staffAttrRawValue(s, np, ALL_STAFF_ATTR_FILTERS[i]!)
    if (v != null && v >= min) pass++
  }
  return pass >= need
}

function staffEuPassport(db: ParsedDatabase, s: StaffRecord): boolean {
  const { nationEuEligible } = db
  return (
    !!nationEuEligible.get(s.first_nation_id) ||
    (s.second_nation_id > 0 && !!nationEuEligible.get(s.second_nation_id))
  )
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
    nonPlayersByRowIndex,
    contractsByStaffIndex,
    gameDateIso,
  } = db
  const nPlayers = players.length
  const q = f.q.trim().toLowerCase()
  const nation = f.nation.trim().toLowerCase()
  const club = f.club.trim().toLowerCase()
  const jobForClub = f.jobForClub

  const out: StaffGridRow[] = []
  staff.forEach((s, staffIndex) => {
    if (!isValidStaffName(s, firstNames, secondNames, commonNames)) return
    // Only hide player duplicates when browsing all roles; a specific job filter should show everyone in that role (e.g. manager with a player link).
    if (
      f.jobForClub == null &&
      !f.includePlayers &&
      isValidPlayerRow(s, firstNames, secondNames, commonNames, nPlayers)
    ) {
      return
    }

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
    if (jobForClub != null && Number.isFinite(jobForClub) && s.job_for_club !== jobForClub) return

    const age =
      ageOnGameDate(s.dob_iso, gameDateIso) ?? ageFromBirthYearOnly(s.year_of_birth, gameDateIso)
    if (f.ageMin != null && (age == null || age < f.ageMin)) return
    if (f.ageMax != null && (age == null || age > f.ageMax)) return

    const contract = contractsByStaffIndex.get(staffIndex) ?? null
    if (f.wageMin != null && (!contract || contract.wage < f.wageMin)) return
    if (f.wageMax != null && (!contract || contract.wage > f.wageMax)) return
    if (f.contractTypeCategory) {
      if (!contract || !contractTypeMatchesCategory(contract.contract_type, f.contractTypeCategory)) return
    }
    if (f.leavingOnBosman === true && (!contract || contract.leaving_on_bosman <= 0)) return
    if (
      f.contractExpiresWithinMonths != null &&
      Number.isFinite(f.contractExpiresWithinMonths) &&
      f.contractExpiresWithinMonths >= 1 &&
      gameDateIso
    ) {
      const maxM = Math.min(120, Math.floor(f.contractExpiresWithinMonths))
      const maxDays = Math.ceil(maxM * 30.4375)
      const exp = contract?.contract_expires_iso
      if (!exp) return
      const d = calendarDaysBetween(gameDateIso, exp)
      if (d == null || d < 0 || d > maxDays) return
    }

    if (f.euPassport === true && !staffEuPassport(db, s)) return

    const np = nonPlayerForStaffLink(s.non_player_id, nonPlayersByRowIndex)
    const coachingCa = staffCoachingCaRaw(np)
    if (f.coachingCaMin != null) {
      if (coachingCa == null || coachingCa < f.coachingCaMin) return
    }
    if (f.coachingCaMax != null) {
      if (coachingCa == null || coachingCa > f.coachingCaMax) return
    }

    const reputation = staffReputationRaw(db, s, np, nPlayers, firstNames, secondNames, commonNames)
    if (f.reputationMin != null) {
      if (reputation == null || reputation < f.reputationMin) return
    }
    if (f.reputationMax != null) {
      if (reputation == null || reputation > f.reputationMax) return
    }

    const coachingPa = staffCoachingPaRaw(np)
    if (f.coachingPaMin != null) {
      if (coachingPa == null || coachingPa < f.coachingPaMin) return
    }
    if (f.coachingPaMax != null) {
      if (coachingPa == null || coachingPa > f.coachingPaMax) return
    }

    if (f.attrMins?.length) {
      if (!passesStaffAttrMins(s, np, f.attrMins, f.attrMinMatchAtLeast)) return
    }

    const score = staffRoleHeuristicScore(s.job_for_club, np) + Math.min(10, Math.max(0, s.determination - 10))
    const scoreDetail = staffHeuristicDetail(s.job_for_club, np)
    const repDisp = staffReputationDisplay(reputation)

    out.push({
      staffIndex,
      staffId: s.id,
      name,
      jobLabel,
      jobByte: s.job_for_club,
      club: clubName,
      nation: nationDisp,
      reputationCurrent: repDisp.raw,
      reputationLabel: repDisp.label,
      determination: s.determination,
      score: Math.min(100, score),
      scoreDetail,
      staffCa: coachingCa,
      staffPa: coachingPa,
    })
  })
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return out
}
