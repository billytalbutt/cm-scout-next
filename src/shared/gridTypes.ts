/** Which optional blocks to attach to each grid row (IPC). Keeps payloads small until those columns are visible. */
export type GridIncludeFlags = {
  attr48?: boolean
  role7?: boolean
  contract?: boolean
  positions?: boolean
  reputation?: boolean
  misc?: boolean
  staffCore?: boolean
}

/** Base + optional fields returned by get-rows (renderer `Row` type). */
export type GridPlayerRow = {
  staffId: number
  staffIndex: number
  name: string
  nation: string
  secondNation?: string
  club: string
  ca: number
  pa: number
  wage: number
  value: number
  age: number | null
  euPassport?: boolean
  cmScoutRatingBp?: number
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
  isDemo?: boolean
  attr48?: number[]
  role7?: number[]
  cClubId?: number | null
  cGoalBonus?: number | null
  cAssistBonus?: number | null
  cCleanSheetBonus?: number | null
  cReleaseFee?: number | null
  cDateStarted?: string | null
  cDateExpires?: string | null
  cType?: number | null
  cBosman?: boolean
  cMinFeeRc?: boolean
  cNonPromoRc?: boolean
  cNonPlayingRc?: boolean
  cRelegationRc?: boolean
  cTransferStatus?: number | null
  cSquadStatus?: number | null
  cTransferArranged?: number | null
  cTlClub?: boolean
  cTlRequest?: boolean
  cLoanListed?: boolean
  repHome?: number
  repCurrent?: number
  repWorld?: number
  playerId?: number
  squadNumber?: number
  leftFoot?: number
  rightFoot?: number
  morale?: number
  staffYob?: number
  posGk?: number
  posSw?: number
  posD?: number
  posDm?: number
  posM?: number
  posAm?: number
  posAtt?: number
  posWb?: number
  posRight?: number
  posLeft?: number
  posCentre?: number
  posFreeRole?: number
  stAdaptability?: number
  stAmbition?: number
  stDetermination?: number
  stLoyalty?: number
  stPressure?: number
  stProfessionalism?: number
  stSportsmanship?: number
  stTemperament?: number
  /** Heuristic regen flag (see `regenDetection.ts`) */
  isRegenLikely?: boolean
  /** Older player name when `isRegenLikely` */
  regenOf?: string
  /** From `staff_history.dat` — career totals (all rows). */
  staffHistCareerApps: number
  staffHistCareerGoals: number
  /** Rows whose `year` matches resolved “current season” staff_history tag. */
  staffHistSeasonApps: number
  staffHistSeasonGoals: number
  /** Current season totals (per-competition save rows when available). */
  curSeasonApps: number
  curSeasonGoals: number
  curSeasonAssists: number | null
  curSeasonAvgRating: number | null
  /** Career apps/goals (staff_history + current season). */
  careerAppsTotal: number
  careerGoalsTotal: number
  /** Heuristic `player stats.dat` (save) — when decoded for this `player.dat` id. */
  spfApps?: number | null
  spfGoals?: number | null
  spfAst?: number | null
}
