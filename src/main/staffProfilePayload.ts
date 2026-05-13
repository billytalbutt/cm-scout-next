import { staffDisplayName } from './database/parser'
import { otherAttrDisplay } from './database/attributes'
import type { NonPlayerRecord, ParsedDatabase, StaffRecord } from './database/types'
import { splitIntoThreeColumns } from './profileLayout'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { ageOnGameDate, ageFromBirthYearOnly } from './database/dates'

type AttrCell = {
  key: string
  label: string
  inGame: number
  inGameUncapped: number
  raw: number
  inMatch: number
  invert: boolean
  highlightTier?: 'primary' | 'secondary'
}

function nationLine(db: ParsedDatabase, firstId: number, secondId: number): string {  const a = db.nationNames.get(firstId) ?? ''
  const b = secondId > 0 && secondId !== firstId ? (db.nationNames.get(secondId) ?? '') : ''
  return b ? `${a} / ${b}` : a
}

function toCell(key: string, label: string, raw: number, invert = false): AttrCell {  const o = otherAttrDisplay(raw)
  return {
    key,
    label,
    inGame: o.inGame,
    inGameUncapped: o.inGameUncapped,
    raw: o.raw,
    inMatch: o.inMatch,
    invert,
  }
}

/** CM-style coaching order (non-player bytes) + determination first. */
const NP_MAIN_ATTRS: { key: keyof NonPlayerRecord; label: string }[] = [
  { key: 'attacking', label: 'Attacking' },
  { key: 'business', label: 'Business' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'coachingGks', label: 'Coaching GKs' },
  { key: 'coachingTechnique', label: 'Coaching technique' },
  { key: 'directness', label: 'Directness' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'freeRoles', label: 'Free roles' },
  { key: 'interference', label: 'Interference' },
  { key: 'judgement', label: 'Judgement' },
  { key: 'judgingPotential', label: 'Judging potential' },
  { key: 'manHandling', label: 'Man handling' },
  { key: 'marking', label: 'Marking' },
  { key: 'motivating', label: 'Motivating' },
  { key: 'offside', label: 'Offside' },
  { key: 'patience', label: 'Patience' },
  { key: 'physiotherapy', label: 'Physiotherapy' },
  { key: 'pressing', label: 'Pressing' },
  { key: 'resources', label: 'Resources' },
  { key: 'tactics', label: 'Tactics' },
  { key: 'youngsters', label: 'Youngsters' },
]

const NP_HIDDEN_POS_FIELDS: { key: keyof NonPlayerRecord; label: string }[] = [
  { key: 'goalKeeperPref', label: 'Goalkeeper preference' },
  { key: 'sweeperPref', label: 'Sweeper preference' },
  { key: 'defenderPref', label: 'Defender preference' },
  { key: 'defensiveMidfielderPref', label: 'Defensive midfielder preference' },
  { key: 'midfielderPref', label: 'Midfielder preference' },
  { key: 'attackingMidfielderPref', label: 'Attacking midfielder preference' },
  { key: 'attackerPref', label: 'Attacker preference' },
  { key: 'wingBackPref', label: 'Wing back preference' },
  { key: 'formation', label: 'Formation' },
]

const STAFF_MENTAL_ATTRS: { key: keyof Pick<
  StaffRecord,
  'adaptability' | 'ambition' | 'loyalty' | 'pressure' | 'professionalism' | 'sportsmanship' | 'temperament'
>; label: string }[] = [
  { key: 'adaptability', label: 'Adaptability' },
  { key: 'ambition', label: 'Ambition' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'temperament', label: 'Temperament' },
]

function buildAttrColumnsForNp(s: StaffRecord, np: NonPlayerRecord): [AttrCell[], AttrCell[], AttrCell[]] {
  const mainFlat: AttrCell[] = [    toCell('determination', 'Determination', s.determination),
    ...NP_MAIN_ATTRS.map(({ key, label }) => toCell(String(key), label, np[key] as number)),
  ]
  const [a, b, c] = splitIntoThreeColumns(mainFlat)
  return [a, b, c]
}

function buildHiddenForNp(np: NonPlayerRecord): [AttrCell[], AttrCell[], AttrCell[]] {  const flat = NP_HIDDEN_POS_FIELDS.map(({ key, label }) => toCell(String(key), label, np[key] as number))
  const [a, b, c] = splitIntoThreeColumns(flat)
  return [a, b, c]
}

function buildAttrColumnsStaffOnly(s: StaffRecord): [AttrCell[], AttrCell[], AttrCell[]] {
  const mainFlat: AttrCell[] = [    toCell('determination', 'Determination', s.determination),
    ...STAFF_MENTAL_ATTRS.map(({ key, label }) => toCell(String(key), label, s[key] as number)),
  ]
  const [a, b, c] = splitIntoThreeColumns(mainFlat)
  return [a, b, c]
}

export function buildStaffProfilePayload(db: ParsedDatabase, staffIndex: number) {
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

  const hasNonPlayer = !!np
  const attrColumns = np ? buildAttrColumnsForNp(s, np) : buildAttrColumnsStaffOnly(s)
  const hiddenColumns = np ? buildHiddenForNp(np) : ([[], [], []] as [AttrCell[], AttrCell[], AttrCell[]])
  const reputation = np
    ? {
        home: np.homeReputation,
        current: np.currentReputation,
        world: np.worldReputation,
      }
    : null

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
    hasNonPlayer,
    currentAbility: np?.currentAbility ?? null,
    potentialAbility: np?.potentialAbility ?? null,
    reputation,
    attrColumns,
    hiddenColumns,
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
