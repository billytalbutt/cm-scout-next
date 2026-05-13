import { staffDisplayName } from './database/parser'
import type { ParsedDatabase } from './database/types'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { ageOnGameDate, ageFromBirthYearOnly } from './database/dates'

export type StaffProfileAttrRow = { label: string; value: number }

function nationLine(db: ParsedDatabase, firstId: number, secondId: number): string {
  const a = db.nationNames.get(firstId) ?? ''
  const b = secondId > 0 && secondId !== firstId ? (db.nationNames.get(secondId) ?? '') : ''
  return b ? `${a} / ${b}` : a
}

function nonPlayerCoachingRows(np: import('./database/types').NonPlayerRecord): StaffProfileAttrRow[] {
  return [
    { label: 'Current ability', value: np.currentAbility },
    { label: 'Potential ability', value: np.potentialAbility },
    { label: 'Home reputation', value: np.homeReputation },
    { label: 'Current reputation', value: np.currentReputation },
    { label: 'World reputation', value: np.worldReputation },
    { label: 'Attacking', value: np.attacking },
    { label: 'Business', value: np.business },
    { label: 'Coaching', value: np.coaching },
    { label: 'Coaching GKs', value: np.coachingGks },
    { label: 'Coaching technique', value: np.coachingTechnique },
    { label: 'Directness', value: np.directness },
    { label: 'Discipline', value: np.discipline },
    { label: 'Free roles', value: np.freeRoles },
    { label: 'Interference', value: np.interference },
    { label: 'Judgement', value: np.judgement },
    { label: 'Judging potential', value: np.judgingPotential },
    { label: 'Man handling', value: np.manHandling },
    { label: 'Marking', value: np.marking },
    { label: 'Motivating', value: np.motivating },
    { label: 'Offside', value: np.offside },
    { label: 'Patience', value: np.patience },
    { label: 'Physiotherapy', value: np.physiotherapy },
    { label: 'Pressing', value: np.pressing },
    { label: 'Resources', value: np.resources },
    { label: 'Tactics', value: np.tactics },
    { label: 'Youngsters', value: np.youngsters },
  ]
}

function nonPlayerPositionPrefs(np: import('./database/types').NonPlayerRecord): StaffProfileAttrRow[] {
  return [
    { label: 'Goalkeeper', value: np.goalKeeperPref },
    { label: 'Sweeper', value: np.sweeperPref },
    { label: 'Defender', value: np.defenderPref },
    { label: 'Defensive midfielder', value: np.defensiveMidfielderPref },
    { label: 'Midfielder', value: np.midfielderPref },
    { label: 'Attacking midfielder', value: np.attackingMidfielderPref },
    { label: 'Attacker', value: np.attackerPref },
    { label: 'Wing back', value: np.wingBackPref },
    { label: 'Formation (byte)', value: np.formation },
  ]
}

export type StaffProfilePayload = {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  jobForClub: number
  club: string
  nation: string
  dobIso: string | null
  age: number | null
  determination: number
  staffMentals: StaffProfileAttrRow[]
  nonPlayer: null | {
    coachingAttrs: StaffProfileAttrRow[]
    positionPrefs: StaffProfileAttrRow[]
  }
  contract: null | {
    wage: number
    dateStarted: string | null
    contractExpires: string | null
    type: number
  }
}

export function buildStaffProfilePayload(db: ParsedDatabase, staffIndex: number): StaffProfilePayload | null {
  const { staff, clubNames, firstNames, secondNames, commonNames, contractsByStaffIndex, gameDateIso } = db
  if (staffIndex < 0 || staffIndex >= staff.length) return null
  const s = staff[staffIndex]!
  const name = staffDisplayName(s, firstNames, secondNames, commonNames)
  const nation = nationLine(db, s.first_nation_id, s.second_nation_id)
  const club = clubNames.get(s.club_job_id) ?? ''
  const ageFromDob = ageOnGameDate(s.dob_iso, gameDateIso)
  const age = ageFromDob != null ? ageFromDob : ageFromBirthYearOnly(s.year_of_birth, gameDateIso)
  const np = s.non_player_id > 0 ? db.nonPlayersById?.get(s.non_player_id) : undefined
  const c = contractsByStaffIndex.get(staffIndex) ?? null

  const staffMentals: StaffProfileAttrRow[] = [
    { label: 'Adaptability', value: s.adaptability },
    { label: 'Ambition', value: s.ambition },
    { label: 'Loyalty', value: s.loyalty },
    { label: 'Pressure', value: s.pressure },
    { label: 'Professionalism', value: s.professionalism },
    { label: 'Sportsmanship', value: s.sportsmanship },
    { label: 'Temperament', value: s.temperament },
  ]

  return {
    staffIndex,
    staffId: s.id,
    name,
    jobLabel: staffJobForClubLabel(s.job_for_club),
    jobForClub: s.job_for_club,
    club,
    nation,
    dobIso: s.dob_iso,
    age,
    determination: s.determination,
    staffMentals,
    nonPlayer: np
      ? {
          coachingAttrs: nonPlayerCoachingRows(np),
          positionPrefs: nonPlayerPositionPrefs(np),
        }
      : null,
    contract: c
      ? {
          wage: c.wage,
          dateStarted: c.date_started_iso,
          contractExpires: c.contract_expires_iso,
          type: c.contract_type,
        }
      : null,
  }
}
