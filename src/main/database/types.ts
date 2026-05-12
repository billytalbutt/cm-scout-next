import type { StaffHistoryRecord } from './staffHistory'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'

export interface BlockInfo {
  position: number
  size: number
  name: string
}

export interface PlayerRecord {
  id: number
  squad_number: number
  current_ability: number
  potential_ability: number
  home_reputation: number
  current_reputation: number
  world_reputation: number
  goalkeeper: number
  sweeper: number
  defender: number
  defensive_midfielder: number
  midfielder: number
  attacking_midfielder: number
  attacker: number
  wing_back: number
  right_side: number
  left_side: number
  centre_side: number
  free_role: number
  acceleration: number
  aggression: number
  agility: number
  anticipation: number
  balance: number
  bravery: number
  consistency: number
  corners: number
  crossing: number
  decisions: number
  dirtiness: number
  dribbling: number
  finishing: number
  flair: number
  free_kicks: number
  handling: number
  heading: number
  important_matches: number
  injury_proneness: number
  jumping: number
  influence: number
  left_foot: number
  long_shots: number
  marking: number
  off_the_ball: number
  natural_fitness: number
  one_on_ones: number
  pace: number
  passing: number
  penalties: number
  positioning: number
  reflexes: number
  right_foot: number
  stamina: number
  strength: number
  tackling: number
  teamwork: number
  technique: number
  throw_ins: number
  versatility: number
  creativity: number
  work_rate: number
  morale: number
}

export interface StaffRecord {
  id: number
  first_name_id: number
  second_name_id: number
  common_name_id: number
  /** TCMDate at staff+0x10 (day-of-year + year); null if unset / invalid */
  dob_iso: string | null
  year_of_birth: number
  first_nation_id: number
  second_nation_id: number
  /** International caps (byte at staff+0x22) */
  int_apps: number
  /** International goals (byte at staff+0x23) */
  int_goals: number
  club_job_id: number
  job_for_club: number
  player_id: number
  wage: number
  value: number
  adaptability: number
  ambition: number
  determination: number
  loyalty: number
  pressure: number
  professionalism: number
  sportsmanship: number
  temperament: number
}

export interface ContractRecord {
  staffIndex: number
  club_id: number
  wage: number
  goal_bonus: number
  assist_bonus: number
  clean_sheet_bonus: number
  /** Release-clause / contract-option bytes (see CM0102Patcher TContract) */
  non_promotion_rc: number
  minimum_fee_rc: number
  non_playing_rc: number
  relegation_rc: number
  manager_job_rc: number
  release_fee: number
  /** TCMDate — contract start */
  date_started_iso: string | null
  /** TCMDate — contract end */
  contract_expires_iso: string | null
  contract_type: number
  /** Leaving on Bosman / free (byte at contract+0x49 in 80-byte row) */
  leaving_on_bosman: number
  transfer_arranged_for: number
  transfer_status: number
  squad_status: number
}

export interface ParsedDatabase {
  compressed: boolean
  blocks: BlockInfo[]
  /** Optional: keyed by `staff.dat` row `id` (same as `StaffRecord.id`). */
  staffHistoryByStaffId?: Map<number, StaffHistoryRecord[]>
  /**
   * True when `staff_history.dat` exists in the index and was parsed into a map (possibly empty).
   * False when the block is missing, empty, or the decompressed size is not a valid row multiple even after optional 4-byte prefix skip.
   */
  staffHistoryParsed?: boolean
  /** Raw `SeasonUpdateDay` samples from nation.dat (1–366); used for staff_history season tagging. */
  nationSeasonUpdateDaySamples: number[]
  /** Optional `club_comp.dat` (domestic league / cup competition definitions). */
  clubCompsById?: Map<number, ClubCompRecord>
  /** Optional `staff_comp.dat` (international competition definitions). */
  staffCompsById?: Map<number, StaffCompRecord>
  /** `club.dat` → primary `club_comp` id (`TClub.Division`). */
  clubDivisionCompIdByClubId: Map<number, number>
  nationNames: Map<number, string>
  /** `GroupMembership == 2` in nation.dat — same rule as community loaders (EU / free movement) */
  nationEuEligible: Map<number, boolean>
  clubNames: Map<number, string>
  firstNames: string[]
  secondNames: string[]
  commonNames: string[]
  players: PlayerRecord[]
  staff: StaffRecord[]
  contractsByStaffIndex: Map<number, ContractRecord>
  gameDateIso: string | null
}

export interface UiPlayerRow {
  staffId: number
  staffIndex: number
  name: string
  nation: string
  /** Second nationality name if set */
  secondNation: string
  club: string
  ca: number
  pa: number
  wage: number
  value: number
  /** Age from DOB vs game date when possible; else year-of-birth fallback */
  age: number | null
  /** True if first or second nation has EU-style GroupMembership (value 2) */
  euPassport: boolean
  /** CM Scout–style % (best natural role, WeightsSet_CMScout on in-game CA18 + raw vector) */
  cmScoutRatingBp?: number
  /**
   * Custom “engine effectiveness” % from raw intrinsics — best of fixed archetypes (GK, DC, WB,
   * DMC, MC, AM, AMC, ST); `effArchetype` is which recipe won (may differ from natural position).
   */
  /** Set when effectiveness ran; `null` when naturals matched no recipe (UI: Unsure). */
  effPercent?: number | null
  effArchetype?: string
  effArchetypeId?: string
  eliteEngineBadgeKind?:
    | 'finisher'
    | 'playmaker'
    | 'defender'
    | 'sweeper'
    | 'anchor_dm'
    | 'wing_back'
    | 'goalkeeper'
    | 'wide_attacker'
  eliteEngineBadgeTitle?: string
  eliteEngineBadgeDetail?: string
  /** CM Scout % per weight column (GK, D, DM, M, AM, A, WB), length 7 */
  cmScoutRolePercents?: number[]
  /** Cached 1–20 vector for CM Scout % + attribute filters (in-game CA18 + clamped raw) */
  cmAttrNorm?: number[]
  /**
   * Regen hint: with a **snapshot** (`regenBaseline.ts`), same `staff.dat` **id** and changed name-id triple →
   * GPF2-style match; **Regen of** is the snapshot display name. Without a snapshot, same-save PA + nationalities +
   * positions + DOB heuristic (`regenDetection.ts`). Not proof — no height/weight in parsed vanilla rows.
   */
  isRegenLikely?: boolean
  /** Predecessor display name (snapshot) or older player in-bucket name (heuristic). */
  regenOfName?: string
  regenOfStaffIndex?: number
  /** Optional rows from `staff_history.dat` for this staff `id`. */
  staffHistory?: StaffHistoryRecord[]
  /** Totals from `staff_history.dat` (career = all rows; season = rows whose `year` matches resolved highlight year). */
  staffHistCareerApps: number
  staffHistCareerGoals: number
  staffHistSeasonApps: number
  staffHistSeasonGoals: number
  /** joined player blob for profile */
  player: PlayerRecord
  staff: StaffRecord
  contract: ContractRecord | null
}
