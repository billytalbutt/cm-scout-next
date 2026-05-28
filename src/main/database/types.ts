import type { StaffHistoryRecord } from './staffHistory'
import type { PlayerCurrentSeasonIndexed } from './playerStatsCurrentSeason'
import type { CompetitionNamesById } from './competitionNames'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'
import type { StaffCompHistoryRecord } from './staffCompHistory'
import type { TacticsIndexMeta } from './tacticsDat'
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
  /** `TStaff.PlayingSquad` — senior / reserve, etc. */
  playing_squad: number
  /** `TStaff.Classification` — player / non-player / both (see CM0102Patcher). */
  classification: number
  /** `TStaff.ClubValuation` */
  club_valuation: number
  /** `TStaff.StaffPreferences` id (favourite clubs/staff live in separate table). */
  staff_preferences_id: number
  /** Row index into `nonplayer.dat` for coaching / scout / physio attributes (not the row's `id` field). */
  non_player_id: number
  squad_selected_for: number
}

/** Backroom profile (`nonplayer.dat`, `TNonPlayer`). */
export interface NonPlayerRecord {
  id: number
  currentAbility: number
  potentialAbility: number
  homeReputation: number
  currentReputation: number
  worldReputation: number
  attacking: number
  business: number
  coaching: number
  coachingGks: number
  coachingTechnique: number
  directness: number
  discipline: number
  freeRoles: number
  interference: number
  judgement: number
  judgingPotential: number
  manHandling: number
  marking: number
  motivating: number
  offside: number
  patience: number
  physiotherapy: number
  pressing: number
  resources: number
  tactics: number
  youngsters: number
  goalKeeperPref: number
  sweeperPref: number
  defenderPref: number
  defensiveMidfielderPref: number
  midfielderPref: number
  attackingMidfielderPref: number
  attackerPref: number
  wingBackPref: number
  formation: number
}

/** Parsed `stadium.dat` row (`TStadiums`, 78 bytes). */
export interface StadiumRecord {
  id: number
  name: string
  cityId: number
  capacity: number
  seatingCapacity: number
  expansionCapacity: number
  nearbyStadiumId: number
  covered: number
  underSoilHeating: number
}

/** Parsed `club.dat` row (581 bytes). */
export interface ClubRecord {
  id: number
  name: string
  nationId: number
  divisionCompId: number
  cash: number
  stadiumId: number
  attendance: number
  training: number
  reputation: number
  /** `TClub.Squad` — staff ids (same id space as `StaffRecord.id`). */
  squadStaffIds: number[]
  /** `TClub.TeamSelected` — 20 ints (match selection / team state; often includes XI staff ids). */
  teamSelectedStaffIds: number[]
  /** `TClub.TacticTraining` — four tactic ids used for scheduled training rotations. */
  tacticTrainingIds: number[]
  /** `TClub.TacticSelected` — active tactic id into `tactics.dat` rows when that block exists. */
  tacticSelectedId: number
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

/** One competition slice from structured `player stats.dat` (grid V0). */
export interface PlayerStatsPerCompetitionRow {
  competitionId: number
  competitionName: string
  apps: number
  goals: number
  assists: number | null
  averageRating: number | null
  tackles: number | null
  passes: number | null
  headers: number | null
}

/** `player stats.dat` row summary (keyed by `PlayerRecord.id`). */
export interface PlayerSavePerformanceStats {
  apps: number | null
  goals: number | null
  assists: number | null
  averageRating?: number | null
  tackles?: number | null
  passes?: number | null
  headers?: number | null
  layout: 'zeroedPrefix' | 'chainPrevId' | 'default' | 'gridV0' | 'summaryV1'
  /** Present when `layout === 'gridV0'` — primary domestic / picked competition row. */
  competitionId?: number | null
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
  /** Path to `staff_history.dat` used when career history loaded (external Data file or embedded). */
  staffHistorySourcePath?: string
  /** Raw `SeasonUpdateDay` samples from nation.dat (1–366); used for staff_history season tagging. */
  nationSeasonUpdateDaySamples: number[]
  /** Optional `club_comp.dat` (domestic league / cup competition definitions). */
  clubCompsById?: Map<number, ClubCompRecord>
  /** Optional `staff_comp.dat` (international competition definitions). */
  staffCompsById?: Map<number, StaffCompRecord>
  /** Merged competition id → name (`club_comp` + `staff_comp`). */
  competitionNamesById?: CompetitionNamesById
  /** Current-season per-competition rows from `player stats.dat`, keyed by `staff.dat` id. */
  staffCompHistoryByStaffId?: Map<number, StaffCompHistoryRecord[]>
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
  /** True when the loaded archive contains a `player stats.dat` block (typical of `.sav`; not decoded yet). */
  playerStatsDatPresent?: boolean
  /**
   * Heuristic decode of `player stats.dat` keyed by `player.dat` row `id` (`PlayerRecord.id`).
   * Undefined when the block is missing or parsing failed.
   */
  savePerformanceByPlayerDatId?: Map<number, PlayerSavePerformanceStats>
  /** Grid V0: all decoded per-competition rows per `player.dat` id. */
  savePerformancePerCompByPlayerDatId?: Map<number, PlayerStatsPerCompetitionRow[]>
  /** Decompressed `player stats history.tmp` (CM History tab per-scope rows). */
  playerStatsHistoryBuf?: Buffer
  /** Decompressed `player stats.dat` (Senior club embedded totals). */
  playerStatsDatBuf?: Buffer
  /** CM History-tab current season (all players with data in this save). */
  currentSeasonByPlayerDatId?: Map<number, PlayerCurrentSeasonIndexed>
  /** `nonplayer.dat` rows in file order; `StaffRecord.non_player_id` indexes this array. */
  nonPlayersByRowIndex?: NonPlayerRecord[]
  /** Full `club.dat` rows keyed by club id (includes squad staff ids). */
  clubsById?: Map<number, ClubRecord>
  /** Optional `stadium.dat` keyed by stadium id (`TClub.Stadium`). */
  stadiumsById?: Map<number, StadiumRecord>
  /** Optional parsed `tactics.dat` index (row size inferred). */
  tacticsIndex?: TacticsIndexMeta
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
  /** Availability risks (UI only — not used in Eff % formula). */
  injuryRisk?: boolean
  disciplineRisk?: boolean
  lowConsistencyRisk?: boolean
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
   * Uncapped CA18-style + raw bytes (same 48 order as `cmAttrNorm`) for filters when minimum is above 20:
   * CA18 uses `inGameCa18Uncapped`; others use on-disk intrinsic (can exceed 20 in edited saves).
   */
  cmAttrFilter48?: number[]
  /**
   * Regen hint: with a **snapshot** (`regenBaseline.ts`), same `staff.dat` **id** and changed name-id triple →
   * GPF2-style match; **Regen of** is the snapshot display name. Without a snapshot, same-save PA + nationalities +
   * positions + DOB heuristic (`regenDetection.ts`). Not proof — no height/weight in parsed vanilla rows.
   */
  isRegenLikely?: boolean
  /** Predecessor display name (snapshot) or older player in-bucket name (heuristic). */
  regenOfName?: string
  regenOfStaffIndex?: number
  regenDetectionSource?: 'snapshot' | 'heuristic'
  /** Optional rows from `staff_history.dat` for this staff `id`. */
  staffHistory?: StaffHistoryRecord[]
  /** Totals from `staff_history.dat` (career = all rows; season = rows whose `year` matches resolved highlight year). */
  staffHistCareerApps: number
  staffHistCareerGoals: number
  staffHistSeasonApps: number
  staffHistSeasonGoals: number
  /** Current season from per-competition `player stats.dat` rows (sum across competitions). */
  curSeasonApps: number
  curSeasonGoals: number
  curSeasonAssists: number | null
  curSeasonAvgRating: number | null
  /** Career apps/goals: prior staff_history years + current season comp totals. */
  careerAppsTotal: number
  careerGoalsTotal: number
  /** Per-competition current-season rows for this staff id. */
  staffCompHistory?: StaffCompHistoryRecord[]
  /**
   * Season-style counters from `player stats.dat` when the heuristic decoder found a row
   * for this `player.dat` id (may be partial — e.g. assists-only on some layouts).
   */
  savePerformance?: PlayerSavePerformanceStats | null
  /**
   * CM `player stats history.tmp` + `player stats.dat` decode for this save date
   * (Senior club + League/Cup/Continental/International scopes).
   */
  cmSeason?: PlayerCurrentSeasonIndexed | null
  /** Meta-profile DNA tags (`engineMetaProfiles.ts`) — filled after load. */
  engineMetaProfileIds?: readonly string[]
  /** joined player blob for profile */
  player: PlayerRecord
  staff: StaffRecord
  contract: ContractRecord | null
}
