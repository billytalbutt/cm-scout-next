/**
 * Current-season totals for the profile UI.
 * Primary source: `staff_history.dat` (apps/goals per club per season-year; league+cups combined).
 * Assists / average rating are not in that structure — left null until a save block is mapped.
 */

import type { StaffHistoryRecord } from './staffHistory'
import {
  type StaffHistoryYearPick,
  refineHighlightYearWithHistoryFallback,
  resolveStaffHistoryHighlightYear,
} from './seasonYear'

export interface CurrentSeasonPerformance {
  /** Display label (club name or scope). */
  label: string
  apps: number
  goals: number
  assists: number | null
  averageRating: number | null
  /** Season tag from `staff_history.year` used for this row. */
  historyYear: number
  clubId: number
  source: 'staff_history'
}

function uniqueYearsDesc(hist: readonly StaffHistoryRecord[]): number[] {
  const s = new Set<number>()
  for (const h of hist) s.add(h.year)
  return [...s].sort((a, b) => b - a)
}

function candidateHistoryYears(
  hist: readonly StaffHistoryRecord[],
  pick: StaffHistoryYearPick,
): number[] {
  const out: number[] = []
  const add = (y: number | null | undefined) => {
    if (y == null || !Number.isFinite(y)) return
    if (!out.includes(y)) out.push(y)
  }
  add(pick.highlightHistoryYear)
  if (pick.highlightHistoryYear != null) add(pick.highlightHistoryYear - 1)
  add(pick.saveCalendarYear)
  if (pick.saveCalendarYear != null) add(pick.saveCalendarYear - 1)
  for (const y of uniqueYearsDesc(hist)) add(y)
  return out
}

function uniqueClubIds(...ids: Array<number | null | undefined>): number[] {
  const out: number[] = []
  for (const id of ids) {
    if (id == null || !Number.isFinite(id) || id <= 0) continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/**
 * Pick the best `staff_history` row(s) for “this season” at the player’s current club.
 * CM often tags `year` as season-start (e.g. 2004 for a game dated Sep 2005 in the 04/05 season).
 */
export function pickCurrentSeasonStaffHistoryAtClub(
  hist: readonly StaffHistoryRecord[],
  employerClubId: number,
  gameDateIso: string | null,
  nationSeasonUpdateDays: readonly number[],
  alternateClubIds: readonly number[] = [],
): { rows: StaffHistoryRecord[]; pick: StaffHistoryYearPick } {
  const rawPick = resolveStaffHistoryHighlightYear(gameDateIso, nationSeasonUpdateDays)
  const pick = refineHighlightYearWithHistoryFallback(hist, rawPick)

  if (!hist.length) return { rows: [], pick }

  const clubIds = uniqueClubIds(employerClubId, ...alternateClubIds)

  for (const y of candidateHistoryYears(hist, pick)) {
    for (const clubId of clubIds) {
      const atClub = hist.filter((h) => h.year === y && h.clubId === clubId)
      if (atClub.length) return { rows: atClub, pick: { ...pick, highlightHistoryYear: y } }
    }
  }

  for (const y of candidateHistoryYears(hist, pick)) {
    const any = hist.filter((h) => h.year === y)
    if (any.length) return { rows: any, pick: { ...pick, highlightHistoryYear: y } }
  }

  const maxYear = Math.max(...hist.map((h) => h.year))
  const latest = hist.filter((h) => h.year === maxYear)
  if (latest.length) {
    return {
      rows: latest,
      pick: { ...pick, highlightHistoryYear: maxYear, resolution: 'calendar_fallback' },
    }
  }

  return { rows: [], pick }
}

export function currentSeasonPerformanceFromRows(
  rows: readonly StaffHistoryRecord[],
  employerClubId: number,
  clubLabel: string,
  alternateClubIds: readonly number[] = [],
): CurrentSeasonPerformance | null {
  if (!rows.length) return null

  let apps = 0
  let goals = 0
  for (const h of rows) {
    apps += h.apps
    goals += h.goals
  }

  const historyYear = rows[0]!.year
  const clubIds = uniqueClubIds(employerClubId, ...alternateClubIds)
  const atCurrentClub = rows.every((h) => clubIds.includes(h.clubId))
  const clubId = rows.length === 1 ? rows[0]!.clubId : employerClubId
  const label = atCurrentClub
    ? clubLabel.trim() || `Club #${employerClubId}`
    : rows.length === 1
      ? clubLabel.trim() || `Club #${rows[0]!.clubId}`
      : `Season ${historyYear} (all clubs)`

  return {
    label,
    apps,
    goals,
    assists: null,
    averageRating: null,
    historyYear,
    clubId,
    source: 'staff_history',
  }
}

export function buildCurrentSeasonPerformance(
  hist: readonly StaffHistoryRecord[] | undefined,
  employerClubId: number,
  clubLabel: string,
  gameDateIso: string | null,
  nationSeasonUpdateDays: readonly number[],
  alternateClubIds: readonly number[] = [],
): CurrentSeasonPerformance | null {
  if (!hist?.length) return null

  const { rows } = pickCurrentSeasonStaffHistoryAtClub(
    hist,
    employerClubId,
    gameDateIso,
    nationSeasonUpdateDays,
    alternateClubIds,
  )
  return currentSeasonPerformanceFromRows(rows, employerClubId, clubLabel, alternateClubIds)
}
