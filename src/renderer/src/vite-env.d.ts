/// <reference types="vite/client" />

import type { GridPlayerRow } from '../../shared/gridTypes'
import type { EffectivenessFullResult, EffectivenessRunnerUp, EffectivenessWinnerDetail } from '../../shared/effectivenessEngine'

export {}

type OpenResult =
  | {
      ok: true
      path: string
      compressed: boolean
      gameDate: string | null
      playerCount: number
      staffDatRows: number
      playerBlobRows: number
      clubs: string[]
      nations: string[]
      regenBaseline: {
        active: boolean
        savedAt?: string
        entryCount?: number
        indexPath?: string
      }
    }
  | { ok: false; error: string }

type RegenBaselineMutationResult =
  | { ok: true; active: boolean; savedAt?: string; entryCount?: number; indexPath?: string }
  | { ok: false; error: string }

declare global {
  interface Window {
    cmapi: {
      openDatabase: () => Promise<OpenResult>
      getRows: (filter: Record<string, unknown>) => Promise<{
        total: number
        rows: GridPlayerRow[]
        offset?: number
        capped?: boolean
      }>
      getStaffRows: (filter: Record<string, unknown>) => Promise<{
        total: number
        rows: Array<Record<string, unknown>>
        offset: number
        capped: boolean
      }>
      getClubRows: (filter: Record<string, unknown>) => Promise<{
        total: number
        rows: Array<Record<string, unknown>>
        offset: number
        capped: boolean
      }>
      getClubDetail: (clubId: number) => Promise<Record<string, unknown> | null>
      getProfile: (staffIndex: number) => Promise<ProfilePayload | null>
      getStaffProfile: (staffIndex: number) => Promise<StaffProfilePayload | null>
      getEffectivenessDetail: (staffIndex: number) => Promise<EffectivenessFullResult | null>
      saveRegenBaseline: () => Promise<RegenBaselineMutationResult>
      clearRegenBaseline: () => Promise<RegenBaselineMutationResult>
    }
  }
}

export interface ProfileAttrCell {
  key: string
  label: string
  inGame: number
  inGameUncapped: number
  raw: number
  inMatch: number
  invert: boolean
  highlightTier?: 'primary' | 'secondary'
}

export interface ProfileSeasonStatsRow {
  year: number
  club: string
  onLoan: boolean
  apps: number
  goals: number
  /** From `staff_history.dat` only apps/goals exist; other columns reserved for save performance parsing. */
  assists?: number | null
  averageRating?: number | null
  tackles?: number | null
  passes?: number | null
  headers?: number | null
}

export interface ProfilePerCompetitionRow {
  competitionId: number
  competitionName: string
  apps: number
  goals: number
  assists?: number | null
  averageRating?: number | null
  tackles?: number | null
  passes?: number | null
  headers?: number | null
}

export interface ProfileSeasonStats {
  internationalCaps: { apps: number; goals: number }
  /** Calendar year of the in-game date (informational). */
  saveCalendarYear: number | null
  /** `staff_history.year` treated as the active season for totals + row tint. */
  highlightHistoryYear: number | null
  currentYearResolution: 'season_boundary' | 'calendar_fallback' | 'none'
  /** 1-based day-of-year boundary used for season tagging (nation.dat average or 1 Jul fallback). */
  boundaryDayOfYearUsed: number | null
  currentSeasonRows: ProfileSeasonStatsRow[]
  currentSeasonTotals: { apps: number; goals: number }
  careerTotals: { apps: number; goals: number }
  allSeasons: ProfileSeasonStatsRow[]
  /** Primary domestic league from `club.dat` division → `club_comp.dat` (name only). */
  inferredDomesticLeague: { competitionId: number; name: string } | null
  perCompetitionRows: ProfilePerCompetitionRow[]
  perCompetitionStatsInSave: boolean
  /** True when `staff_history.dat` was present and parsed for this save (this player may still have zero rows). */
  staffHistoryParsed: boolean
  /** Save contains `player stats.dat` block (decoded in a future release). */
  playerStatsDatPresent?: boolean
  /** Short explanation for performance columns (goals/assists/rating per competition). */
  savePerformanceHint?: string
}

export interface StaffProfilePayload {
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
  /** True when `nonplayer.dat` row is linked — coaching grid + hidden position prefs. */
  hasNonPlayer: boolean
  currentAbility: number | null
  potentialAbility: number | null
  reputation: { home: number; current: number; world: number } | null
  attrColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  hiddenColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  contract: null | {
    wage: number
    dateStarted: string | null
    contractExpires: string | null
    type: number
  }
}

export interface ProfilePayload {
  isDemo?: boolean
  name: string
  nation: string
  secondNation: string
  nationDisplay: string
  club: string
  /** Whole years on loaded game date when derivable (see `buildUiRows`). */
  age: number | null
  dobIso: string | null
  euPassport: boolean
  positionLabel: string
  /** From `player.dat` — useful for scouting profile vs media perception. */
  reputation: { home: number; current: number; world: number }
  ca: number
  pa: number
  /** Grid column: max % among “suitable” roles (CM Scout weights on in-game CA18 + raw mentals) */
  cmScoutRatingBp?: number
  /** Effectiveness % (best archetype); bracket label on grid. Null when naturals matched no recipe — show Unsure. */
  effPercent?: number | null
  effArchetype?: string
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
  effWinnerDetail?: EffectivenessWinnerDetail | null
  effRunnerUp?: EffectivenessRunnerUp | null
  effRatingDisclaimer?: string
  /** True when natural lines matched none of the eight recipes — Eff % is not computed (use CM Scout %). */
  effRelaxedNaturalGate?: boolean
  /** Length 7: GK, D, DM, M, AM, A, WB — weighted attribute % per WeightsSet_CMScout column */
  cmScoutRolePercents?: number[]
  /** Same order as cmScoutRolePercents — role counts toward BP max */
  cmScoutRoleSuitable?: boolean[]
  /** Same scale as grid “Value” (`staff.dat`). */
  transfer: {
    value: number
    listedByClub: boolean
    listedByRequest: boolean
    listedForLoan: boolean
    futureTransferToClubId: number | null
    futureTransferToClubName: string | null
  }
  attrColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  feetMorale: {
    left: {
      label: string
      inGame: number
      inGameUncapped: number
      raw: number
      inMatch: number
      highlightTier?: 'primary' | 'secondary'
    }
    right: {
      label: string
      inGame: number
      inGameUncapped: number
      raw: number
      inMatch: number
      highlightTier?: 'primary' | 'secondary'
    }
    morale: {
      label: string
      inGame: number
      inGameUncapped: number
      raw: number
      inMatch: number
      highlightTier?: 'primary' | 'secondary'
    }
  }
  hiddenColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  highlightRolesLabel: string
  seasonStats: ProfileSeasonStats
  /** Meta-profile DNA tags from `engineMetaProfiles` (grid filter + profile). */
  engineMetaProfiles: { id: string; label: string }[]
  /** Free-role database preference + roaming attribute signal. */
  freeRoleHint: {
    recommend: boolean
    headline: string
    detail: string
  }
  /** Heuristic CM0102 individual-instruction hints (not from decompiled EXE). */
  tacticalInstructionHints: {
    id: string
    label: string
    tier: 'strong' | 'ok' | 'avoid'
    reason: string
  }[]
  contract: {
    wage: number
    clubId: number
    goalBonus: number
    assistBonus: number
    releaseFee: number
    type: number
    dateStarted: string | null
    contractExpires: string | null
    leavingOnBosman: boolean
    minimumReleaseClause: boolean
    nonPromotionClause: boolean
    nonPlayingClause: boolean
    relegationClause: boolean
  } | null
}
