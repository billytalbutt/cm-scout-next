import { calendarDaysBetween } from './database/dates'
import { compSeasonStat } from './database/playerStatsCurrentSeason'
import type { InjurySummary } from './database/injuryHistory'
import type { UiPlayerRow } from './database/types'
import { matchesEngineSniffer, type EngineSnifferId } from './engineSniffer'
import {
  listedForLoan,
  passesAttributeMins,
  transferListedByClub,
  transferListedByRequest,
} from './cmScoutRating'
import {
  contractTypeMatchesCategory,
  type ContractTypeCategoryId,
} from '../shared/contractTypes'
import {
  parsePositionRoleFilterIds,
  parsePositionSideFilterIds,
  passesPlayerPositionFilter,
  type PositionRoleFilterId,
  type PositionSideFilterId,
} from '../shared/playerPositionFilter'

/** Subset of the IPC payload from `get-rows` used for filtering (main process). */
export type GetRowsFilter = {
  q?: string
  nation?: string
  club?: string
  caMin?: number
  caMax?: number
  paMin?: number
  paMax?: number
  ageMin?: number
  ageMax?: number
  valueMin?: number
  valueMax?: number
  wageMin?: number
  wageMax?: number
  shCareerGoalsMin?: number
  shCareerGoalsMax?: number
  shSeasonGoalsMin?: number
  shSeasonGoalsMax?: number
  shCareerAppsMin?: number
  shSeasonAppsMin?: number
  /** CM save current season — Senior club (`player stats history.tmp` + `player stats.dat`). */
  csGoalsMin?: number
  csGoalsMax?: number
  csAssistsMin?: number
  csAssistsMax?: number
  csAppsMin?: number
  csAppsMax?: number
  /** League-only goals this save (scope decode). */
  csLeagueGoalsMin?: number
  csLeagueGoalsMax?: number
  csLeagueAssistsMin?: number
  csLeagueAssistsMax?: number
  /** `club_comp.dat` / `staff_comp.dat` id — filters per-competition stats for this save. */
  csCompetitionId?: number
  csCompGoalsMin?: number
  csCompGoalsMax?: number
  csCompAssistsMin?: number
  csCompAssistsMax?: number
  csCompAppsMin?: number
  csCompAppsMax?: number
  /** CM Scout–style contract category (not a single raw byte). */
  contractTypeCategory?: ContractTypeCategoryId
  transferListedClub?: boolean
  transferListedRequest?: boolean
  listedForLoan?: boolean
  euPassport?: boolean
  leavingOnBosman?: boolean
  contractExpiresWithinMonths?: number
  hasMinimumReleaseClause?: boolean
  attrMins?: (number | null)[]
  /** Among `attrMins` entries &gt; 0, require at least this many to pass (1 = any one). Empty / omitted = all must pass. */
  attrMinMatchAtLeast?: number
  /** When true, only rows flagged by the same-save regen heuristic (`regenDetection.ts`). */
  isRegenLikely?: boolean
  /** Forum-style CM0102 meta filter (see `engineSniffer.ts`). */
  engineSniffer?: EngineSnifferId
  /** CM Scout rating % (`cmScoutRatingBp` on grid rows). */
  cmScoutMin?: number
  cmScoutMax?: number
  /** Effectiveness % (`effPercent`; null / Unsure excluded when a bound is set). */
  effMin?: number
  effMax?: number
  /** Natural role lines (&gt;14) — player must match every selected role. */
  positionRoles?: PositionRoleFilterId[]
  /** Natural sides (&gt;14) — player must match every selected side. */
  positionSides?: PositionSideFilterId[]
  /** Only players with an active injury in `injury_history.tmp`. */
  injuredOnly?: boolean
}

function hasActiveAttrMins(mins?: (number | null)[] | undefined): boolean {
  if (!mins?.length) return false
  for (let i = 0; i < mins.length; i++) {
    const m = mins[i]
    if (m != null && m > 0) return true
  }
  return false
}

function rowMatches(
  r: UiPlayerRow,
  f: GetRowsFilter,
  ctx: { gameDateIso: string | null; injuryByStaffId?: Map<number, InjurySummary> },
): boolean {
  const q = (f.q ?? '').trim().toLowerCase()
  if (q && !r.name.toLowerCase().includes(q)) return false

  if (f.nation?.trim()) {
    const n = f.nation.trim().toLowerCase()
    if (
      !r.nation.toLowerCase().includes(n) &&
      !(r.secondNation && r.secondNation.toLowerCase().includes(n))
    ) {
      return false
    }
  }

  if (f.club?.trim()) {
    const c = f.club.trim().toLowerCase()
    if (!r.club.toLowerCase().includes(c)) return false
  }

  if (f.caMin != null && r.ca < f.caMin) return false
  if (f.caMax != null && r.ca > f.caMax) return false
  if (f.paMin != null && r.pa < f.paMin) return false
  if (f.paMax != null && r.pa > f.paMax) return false
  if (f.ageMin != null && (r.age == null || r.age < f.ageMin)) return false
  if (f.ageMax != null && (r.age == null || r.age > f.ageMax)) return false
  if (f.valueMin != null && r.value < f.valueMin) return false
  if (f.valueMax != null && r.value > f.valueMax) return false
  if (f.wageMin != null && r.wage < f.wageMin) return false
  if (f.wageMax != null && r.wage > f.wageMax) return false
  if (f.shCareerGoalsMin != null && r.staffHistCareerGoals < f.shCareerGoalsMin) return false
  if (f.shCareerGoalsMax != null && r.staffHistCareerGoals > f.shCareerGoalsMax) return false
  if (f.shSeasonGoalsMin != null && r.staffHistSeasonGoals < f.shSeasonGoalsMin) return false
  if (f.shSeasonGoalsMax != null && r.staffHistSeasonGoals > f.shSeasonGoalsMax) return false
  if (f.shCareerAppsMin != null && r.staffHistCareerApps < f.shCareerAppsMin) return false
  if (f.shSeasonAppsMin != null && r.staffHistSeasonApps < f.shSeasonAppsMin) return false

  const cs = r.cmSeason
  if (
    f.csGoalsMin != null ||
    f.csGoalsMax != null ||
    f.csAssistsMin != null ||
    f.csAssistsMax != null ||
    f.csAppsMin != null ||
    f.csAppsMax != null ||
    f.csLeagueGoalsMin != null ||
    f.csLeagueGoalsMax != null ||
    f.csLeagueAssistsMin != null ||
    f.csLeagueAssistsMax != null
  ) {
    if (!cs?.available) return false
    if (f.csGoalsMin != null && cs.seniorGoals < f.csGoalsMin) return false
    if (f.csGoalsMax != null && cs.seniorGoals > f.csGoalsMax) return false
    if (f.csAssistsMin != null && cs.seniorAssists < f.csAssistsMin) return false
    if (f.csAssistsMax != null && cs.seniorAssists > f.csAssistsMax) return false
    if (f.csAppsMin != null && cs.seniorApps < f.csAppsMin) return false
    if (f.csAppsMax != null && cs.seniorApps > f.csAppsMax) return false
    if (f.csLeagueGoalsMin != null && cs.leagueGoals < f.csLeagueGoalsMin) return false
    if (f.csLeagueGoalsMax != null && cs.leagueGoals > f.csLeagueGoalsMax) return false
    if (f.csLeagueAssistsMin != null && cs.leagueAssists < f.csLeagueAssistsMin) return false
    if (f.csLeagueAssistsMax != null && cs.leagueAssists > f.csLeagueAssistsMax) return false
  }

  if (f.csCompetitionId != null) {
    const comp = compSeasonStat(cs, f.csCompetitionId)
    const hasStatBound =
      f.csCompGoalsMin != null ||
      f.csCompGoalsMax != null ||
      f.csCompAssistsMin != null ||
      f.csCompAssistsMax != null ||
      f.csCompAppsMin != null ||
      f.csCompAppsMax != null
    if (!hasStatBound) {
      if (!comp) return false
    } else {
      if (!comp) return false
      if (f.csCompGoalsMin != null && comp.goals < f.csCompGoalsMin) return false
      if (f.csCompGoalsMax != null && comp.goals > f.csCompGoalsMax) return false
      if (f.csCompAssistsMin != null && comp.assists < f.csCompAssistsMin) return false
      if (f.csCompAssistsMax != null && comp.assists > f.csCompAssistsMax) return false
      if (f.csCompAppsMin != null && comp.apps < f.csCompAppsMin) return false
      if (f.csCompAppsMax != null && comp.apps > f.csCompAppsMax) return false
    }
  }

  if (f.cmScoutMin != null) {
    if (r.cmScoutRatingBp == null || r.cmScoutRatingBp < f.cmScoutMin) return false
  }
  if (f.cmScoutMax != null) {
    if (r.cmScoutRatingBp == null || r.cmScoutRatingBp > f.cmScoutMax) return false
  }
  if (f.effMin != null) {
    if (r.effPercent == null || r.effPercent < f.effMin) return false
  }
  if (f.effMax != null) {
    if (r.effPercent == null || r.effPercent > f.effMax) return false
  }

  if (
    (f.positionRoles?.length ?? 0) > 0 ||
    (f.positionSides?.length ?? 0) > 0
  ) {
    if (
      !passesPlayerPositionFilter(
        r.player,
        f.positionRoles ?? [],
        f.positionSides ?? [],
      )
    ) {
      return false
    }
  }

  if (f.contractTypeCategory) {
    if (!r.contract || !contractTypeMatchesCategory(r.contract.contract_type, f.contractTypeCategory)) {
      return false
    }
  }

  const wantTl =
    f.transferListedClub === true || f.transferListedRequest === true || f.listedForLoan === true
  if (wantTl) {
    const c = r.contract
    if (!c) return false
    const ts = c.transfer_status
    let ok = false
    if (f.transferListedClub && transferListedByClub(ts)) ok = true
    if (f.transferListedRequest && transferListedByRequest(ts)) ok = true
    if (f.listedForLoan && listedForLoan(ts)) ok = true
    if (!ok) return false
  }

  if (f.euPassport === true && !r.euPassport) return false
  if (f.leavingOnBosman === true && (!r.contract || r.contract.leaving_on_bosman <= 0)) return false
  if (f.hasMinimumReleaseClause === true && (!r.contract || r.contract.minimum_fee_rc <= 0)) return false

  if (
    f.contractExpiresWithinMonths != null &&
    Number.isFinite(f.contractExpiresWithinMonths) &&
    f.contractExpiresWithinMonths >= 1 &&
    ctx.gameDateIso
  ) {
    const maxM = Math.min(120, Math.floor(f.contractExpiresWithinMonths))
    const maxDays = Math.ceil(maxM * 30.4375)
    const exp = r.contract?.contract_expires_iso
    if (!exp) return false
    const d = calendarDaysBetween(ctx.gameDateIso, exp)
    if (d == null || d < 0 || d > maxDays) return false
  }

  if (f.attrMins?.length) {
    if (!passesAttributeMins(r, f.attrMins, { matchAtLeast: f.attrMinMatchAtLeast })) return false
  }

  if (f.isRegenLikely === true && r.isRegenLikely !== true) return false

  if (f.injuredOnly === true) {
    const inj = ctx.injuryByStaffId?.get(r.staffId)
    if (!inj || inj.typeId <= 0) return false
  }

  // Engine sniffer and attribute bars use overlapping criteria. When any attribute min is active (including
  // sniffer-filled presets), rely on attribute filters only — otherwise nobody passes (AND was far stricter than N-of-M).
  if (f.engineSniffer != null && !hasActiveAttrMins(f.attrMins)) {
    if (!matchesEngineSniffer(r, f.engineSniffer)) return false
  }

  return true
}

/** Single-pass filter — avoids chaining `.filter()` which allocates many intermediate arrays. */
export function filterUiPlayerRows(
  source: readonly UiPlayerRow[],
  f: GetRowsFilter,
  ctx: { gameDateIso: string | null; injuryByStaffId?: Map<number, InjurySummary> },
): UiPlayerRow[] {
  const out: UiPlayerRow[] = []
  for (const r of source) {
    if (rowMatches(r, f, ctx)) out.push(r)
  }
  return out
}
