import { staffDisplayName } from './database/parser'
import { otherAttrDisplay } from './database/attributes'
import type { NonPlayerRecord, ParsedDatabase, StaffRecord } from './database/types'
import { splitIntoThreeColumns } from './profileLayout'
import { staffJobForClubLabel } from '../shared/staffJobCatalog'
import { contractTypeLabel } from '../shared/contractTypes'
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

function nationLine(db: ParsedDatabase, firstId: number, secondId: number): string {
  const a = db.nationNames.get(firstId) ?? ''
  const b = secondId > 0 && secondId !== firstId ? (db.nationNames.get(secondId) ?? '') : ''
  return b ? `${a} / ${b}` : a
}

function toCell(key: string, label: string, raw: number, invert = false): AttrCell {
  const o = otherAttrDisplay(raw)
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

/** CM staff profile — left column (in-game order). */
const STAFF_MAIN_LEFT: { key: string; label: string; from: 'staff' | 'np'; field: string }[] = [
  { key: 'adaptability', label: 'Adaptability', from: 'staff', field: 'adaptability' },
  { key: 'coachingGks', label: 'Coaching goalkeepers', from: 'np', field: 'coachingGks' },
  { key: 'coaching', label: 'Coaching outfield players', from: 'np', field: 'coaching' },
  { key: 'determination', label: 'Determination', from: 'staff', field: 'determination' },
  { key: 'judgement', label: 'Judging player ability', from: 'np', field: 'judgement' },
  { key: 'judgingPotential', label: 'Judging player potential', from: 'np', field: 'judgingPotential' },
]

/** CM staff profile — right column (in-game order). */
const STAFF_MAIN_RIGHT: { key: string; label: string; from: 'staff' | 'np'; field: string }[] = [
  { key: 'discipline', label: 'Level of discipline', from: 'np', field: 'discipline' },
  { key: 'manHandling', label: 'Man management', from: 'np', field: 'manHandling' },
  { key: 'motivating', label: 'Motivating', from: 'np', field: 'motivating' },
  { key: 'tactics', label: 'Tactical knowledge', from: 'np', field: 'tactics' },
  { key: 'youngsters', label: 'Working with youngsters', from: 'np', field: 'youngsters' },
  { key: 'directness', label: 'Coaching style', from: 'np', field: 'directness' },
]

const MAIN_ATTR_KEYS = new Set([
  ...STAFF_MAIN_LEFT.map((x) => x.key),
  ...STAFF_MAIN_RIGHT.map((x) => x.key),
])

const NP_HIDDEN_EXTRA: { key: keyof NonPlayerRecord; label: string }[] = [
  { key: 'attacking', label: 'Attacking' },
  { key: 'business', label: 'Business' },
  { key: 'coachingTechnique', label: 'Coaching technique' },
  { key: 'freeRoles', label: 'Free roles' },
  { key: 'interference', label: 'Interference' },
  { key: 'marking', label: 'Marking' },
  { key: 'offside', label: 'Offside' },
  { key: 'patience', label: 'Patience' },
  { key: 'physiotherapy', label: 'Physiotherapy' },
  { key: 'pressing', label: 'Pressing' },
  { key: 'resources', label: 'Resources' },
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

const STAFF_MENTAL_HIDDEN: { key: keyof Pick<
  StaffRecord,
  'ambition' | 'loyalty' | 'pressure' | 'professionalism' | 'sportsmanship' | 'temperament'
>; label: string }[] = [
  { key: 'ambition', label: 'Ambition' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'sportsmanship', label: 'Sportsmanship' },
  { key: 'temperament', label: 'Temperament' },
]

function readMainCell(
  spec: (typeof STAFF_MAIN_LEFT)[number],
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
): AttrCell | null {
  if (spec.from === 'staff') {
    return toCell(spec.key, spec.label, s[spec.field as keyof StaffRecord] as number)
  }
  if (!np) return null
  return toCell(spec.key, spec.label, np[spec.field as keyof NonPlayerRecord] as number)
}

function buildMainColumns(
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
): [AttrCell[], AttrCell[], AttrCell[]] {
  const left = STAFF_MAIN_LEFT.map((spec) => readMainCell(spec, s, np)).filter((c): c is AttrCell => c != null)
  const right = STAFF_MAIN_RIGHT.map((spec) => readMainCell(spec, s, np)).filter((c): c is AttrCell => c != null)
  return [left, right, []]
}

function buildHiddenColumns(
  s: StaffRecord,
  np: NonPlayerRecord | undefined,
): [AttrCell[], AttrCell[], AttrCell[]] {
  const flat: AttrCell[] = []

  if (np) {
    for (const { key, label } of NP_HIDDEN_EXTRA) {
      if (MAIN_ATTR_KEYS.has(key)) continue
      flat.push(toCell(key, label, np[key] as number))
    }
    for (const { key, label } of NP_HIDDEN_POS_FIELDS) {
      flat.push(toCell(String(key), label, np[key] as number))
    }
  }

  for (const { key, label } of STAFF_MENTAL_HIDDEN) {
    flat.push(toCell(String(key), label, s[key] as number))
  }

  flat.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return splitIntoThreeColumns(flat)
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
  const attrColumns = buildMainColumns(s, np)
  const hiddenColumns = buildHiddenColumns(s, np)
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
          typeLabel: contractTypeLabel(c.contract_type),
        }
      : null,
  }
}
