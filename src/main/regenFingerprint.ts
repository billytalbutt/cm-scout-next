/**
 * Regen identity fingerprint (community / Tapani best guess):
 * PA + primary nation (+ secondary if set) + natural position vector + DOB month/day.
 *
 * Same `staff.dat` id with a new name is necessary but not sufficient — CM can reuse ids;
 * without a matching fingerprint, linking e.g. Olisadebe → a Costa Rican regen is wrong.
 */
import type { UiPlayerRow } from './database/types'
import type { RegenBaselineEntry } from './regenBaseline'
import { playerPosSig } from './regenBaseline'

export function nationSecondaryId(firstNationId: number, secondNationId: number): number {
  return secondNationId > 0 && secondNationId !== firstNationId ? secondNationId : 0
}

export function validRegenDob(iso: string | null): iso is string {
  return iso != null && iso.length >= 10 && iso[4] === '-' && iso[7] === '-'
}

export function regenDobMonthDay(iso: string | null): string | null {
  if (!validRegenDob(iso)) return null
  return iso.slice(5, 10)
}

export function regenDobMonthDayMatch(a: string | null, b: string | null): boolean {
  const da = regenDobMonthDay(a)
  const db = regenDobMonthDay(b)
  if (!da || !db) return false
  return da === db
}

/** True when a current row could be the regen of a snapshot legend (strict). */
export function regenMatchesSnapshotLegend(row: UiPlayerRow, legend: RegenBaselineEntry): boolean {
  const pa = row.player.potential_ability
  if (pa < 1 || pa !== legend.pa) return false
  if (playerPosSig(row.player) !== legend.posSig) return false
  if (row.staff.first_nation_id !== legend.firstNationId) return false
  if (
    nationSecondaryId(row.staff.first_nation_id, row.staff.second_nation_id) !==
    nationSecondaryId(legend.firstNationId, legend.secondNationId)
  ) {
    return false
  }
  if (!regenDobMonthDayMatch(row.staff.dob_iso, legend.dobIso)) return false
  return true
}

export function baselineFingerprintKey(b: RegenBaselineEntry): string | null {
  if (!b.posSig || !validRegenDob(b.dobIso)) return null
  const sec = nationSecondaryId(b.firstNationId, b.secondNationId)
  return `${b.pa}|${b.firstNationId}|${sec}|${b.posSig}|${b.dobIso.slice(5, 10)}`
}

export function rowFingerprintKey(r: UiPlayerRow): string | null {
  if (!validRegenDob(r.staff.dob_iso)) return null
  const pa = r.player.potential_ability
  if (pa < 1) return null
  const sec = nationSecondaryId(r.staff.first_nation_id, r.staff.second_nation_id)
  return `${pa}|${r.staff.first_nation_id}|${sec}|${playerPosSig(r.player)}|${r.staff.dob_iso.slice(5, 10)}`
}

/** Heuristic bucket key — includes DOB month/day when known to avoid cross-legend false positives. */
export function heuristicRegenBucketKey(r: UiPlayerRow): string | null {
  const pa = r.player.potential_ability
  if (pa < 1) return null
  const sec = nationSecondaryId(r.staff.first_nation_id, r.staff.second_nation_id)
  const base = `${pa}|${r.staff.first_nation_id}|${sec}|${playerPosSig(r.player)}`
  const md = regenDobMonthDay(r.staff.dob_iso)
  return md ? `${base}|${md}` : `${base}|~`
}
