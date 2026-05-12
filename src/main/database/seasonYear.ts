/**
 * Map the save game calendar date to the `staff_history.dat` “season year” tag.
 * CM0102 stores `staff_history.year` as a season label (typically the year in which
 * that season starts), not always equal to the calendar year of the current game date.
 *
 * We prefer `nation.dat`’s `SeasonUpdateDay` (1-based day-of-year, agevak `TNation` @ 0x8C):
 * averaged across nations that set a plausible value — that approximates when leagues roll.
 * If nothing usable is found, we fall back to **1 July** (day 182 in a non-leap year; we use
 * the actual calendar for the game date’s year for leap correctness).
 */

function parseIsoParts(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso || iso.length < 10) return null
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (![y, m, d].every((n) => Number.isFinite(n))) return null
  return { y, m, d }
}

/** 1-based day-of-year in the calendar year of `y-m-d` (UTC). */
export function calendarDayOfYear1Based(y: number, m: number, d: number): number {
  const t = Date.UTC(y, m - 1, d)
  const jan1 = Date.UTC(y, 0, 1)
  return Math.floor((t - jan1) / 86400000) + 1
}

/**
 * Typical “new season starts” boundary as 1-based day-of-year.
 * When the game date is on or after this day in calendar year `Y`, staff_history rows
 * tagged `Y` are considered the “current” season; before that day, use `Y - 1`.
 */
export function pickSeasonBoundaryDayOfYear(sampledNationValues: readonly number[]): number | null {
  const ok = sampledNationValues.filter((v) => Number.isFinite(v) && v >= 1 && v <= 366)
  if (!ok.length) return null
  let sum = 0
  for (const v of ok) sum += v
  return Math.round(sum / ok.length)
}

export function defaultJulyFirstBoundaryDoy(year: number): number {
  return calendarDayOfYear1Based(year, 7, 1)
}

export type StaffHistoryYearPick = {
  /** Calendar year of the in-game date (ISO). */
  saveCalendarYear: number | null
  /** `staff_history.year` value we highlight as “current season”. */
  highlightHistoryYear: number | null
  /** How `highlightHistoryYear` was chosen. */
  resolution: 'season_boundary' | 'calendar_fallback' | 'none'
  /** Boundary actually used (1-based DOY), for UI/debug. */
  boundaryDayOfYearUsed: number | null
}

export function resolveStaffHistoryHighlightYear(
  gameDateIso: string | null,
  nationSeasonUpdateDays: readonly number[],
): StaffHistoryYearPick {
  const parts = parseIsoParts(gameDateIso)
  if (!parts) {
    return {
      saveCalendarYear: null,
      highlightHistoryYear: null,
      resolution: 'none',
      boundaryDayOfYearUsed: null,
    }
  }
  const { y, m, d } = parts
  const saveCalendarYear = y
  const doy = calendarDayOfYear1Based(y, m, d)
  const fromNation = pickSeasonBoundaryDayOfYear(nationSeasonUpdateDays)
  const boundary = fromNation ?? defaultJulyFirstBoundaryDoy(y)
  const seasonTaggedYear = doy >= boundary ? y : y - 1

  return {
    saveCalendarYear,
    highlightHistoryYear: seasonTaggedYear,
    resolution: 'season_boundary',
    boundaryDayOfYearUsed: boundary,
  }
}

/**
 * If no `staff_history` rows match `seasonTaggedYear`, fall back to matching the
 * **calendar year** (legacy behaviour) so lightly mis-tagged saves still show something.
 */
export function refineHighlightYearWithHistoryFallback(
  hist: readonly { year: number }[],
  pick: StaffHistoryYearPick,
): StaffHistoryYearPick {
  if (pick.highlightHistoryYear == null || pick.saveCalendarYear == null) return pick
  const ySeason = pick.highlightHistoryYear
  const yCal = pick.saveCalendarYear
  const hasSeason = hist.some((h) => h.year === ySeason)
  if (hasSeason) return pick
  const hasCal = hist.some((h) => h.year === yCal)
  if (!hasCal) return pick
  return {
    ...pick,
    highlightHistoryYear: yCal,
    resolution: 'calendar_fallback',
    boundaryDayOfYearUsed: pick.boundaryDayOfYearUsed,
  }
}
