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
      getRows: (filter: Record<string, unknown>) => Promise<
        | {
            total: number
            rows: GridPlayerRow[]
            capped?: boolean
          }
        | Array<GridPlayerRow>
      >
      getProfile: (staffIndex: number) => Promise<ProfilePayload | null>
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
}

export interface ProfilePerCompetitionRow {
  competitionId: number
  competitionName: string
  apps: number
  goals: number
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
  /** Grid column: max % among “suitable” roles (Intrinsic BP rule) */
  cmScoutRatingBp?: number
  /** Effectiveness % (best archetype); bracket label on grid */
  effPercent?: number
  effArchetype?: string
  effWinnerDetail?: EffectivenessWinnerDetail
  effRunnerUp?: EffectivenessRunnerUp | null
  effRatingDisclaimer?: string
  /** No natural line matched any recipe — Eff used all eight recipes once. */
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
