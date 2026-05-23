/**
 * Regen detection uses two layers (see `regenBaseline.ts` for snapshot I/O):
 *
 * **1. GPF2-style snapshot (community “best” method)**
 * Same `staff.dat` id, name indices changed → predecessor name from snapshot.
 *
 * **2. Same-save heuristic (fallback)**
 * PA + nationalities + natural positions + DOB; prefers retired job (16), then CA/reputation proxy.
 */
import type { RegenBaselineFile } from './regenBaseline'
import type { PlayerRecord, UiPlayerRow } from './database/types'

const YOUNG_MAX_AGE = 23
const OLD_MIN_AGE = 30
const MIN_PA_CA_GAP = 5
const MAX_GROUP = 24
const MAX_AMBIG_OLD = 2
const MAX_AMBIG_YOUNG = 2
const MAX_GROUP_NULL_DOB_FALLBACK = 6
/** Elite PA buckets: no guess without DOB month/day or full match. */
const ELITE_PA_NO_GUESS = 170
const RETIRED_JOB_FOR_CLUB = 16

function clearRegenMarkers(rows: UiPlayerRow[]): void {
  for (const r of rows) {
    delete r.isRegenLikely
    delete r.regenOfName
    delete r.regenOfStaffIndex
    delete r.regenDetectionSource
  }
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Find predecessor still in the save (e.g. retired legend) by `player_id` from snapshot. */
export function findStaffIndexByPlayerId(
  rows: UiPlayerRow[],
  playerId: number,
  snapshotName?: string,
): number | undefined {
  if (playerId <= 0) return undefined
  const matches = rows.filter((r) => r.staffIndex >= 0 && r.staff.player_id === playerId)
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]!.staffIndex
  if (snapshotName) {
    const want = normName(snapshotName)
    const byName = matches.find((r) => normName(r.name) === want)
    if (byName) return byName.staffIndex
  }
  const retired = matches.filter((r) => r.staff.job_for_club === RETIRED_JOB_FOR_CLUB)
  if (retired.length === 1) return retired[0]!.staffIndex
  return matches.sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]!.staffIndex
}

export function applyBaselineRegenFromSnapshot(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile,
  pathKey: string,
): number {
  if (baseline.pathKey !== pathKey) return 0
  let n = 0
  for (const r of rows) {
    if (r.staffIndex < 0) continue
    const b = baseline.entries[String(r.staff.id)]
    if (!b) continue
    const s = r.staff
    const sameFace =
      s.first_name_id === b.firstNameId &&
      s.second_name_id === b.secondNameId &&
      s.common_name_id === b.commonNameId
    if (sameFace) continue
    r.isRegenLikely = true
    r.regenOfName = b.name
    r.regenDetectionSource = 'snapshot'
    r.regenOfStaffIndex =
      findStaffIndexByPlayerId(rows, b.playerId, b.name) ??
      (Number.isFinite(b.staffIndex) && b.staffIndex >= 0 ? b.staffIndex : undefined)
    n++
  }
  return n
}

/**
 * Match young regens to snapshot fingerprints (PA + nation + positions + DOB month/day).
 * Covers new `staff.dat` ids when the community fingerprint still matches a snapshot legend.
 */
export function applyBaselineFingerprintRegen(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile,
  pathKey: string,
): number {
  if (baseline.pathKey !== pathKey) return 0
  const claimed = new Set<string>()
  let n = 0
  for (const r of rows) {
    if (r.staffIndex < 0 || r.isRegenLikely) continue
    const pa = r.player.potential_ability
    if (pa < 1) continue
    if ((r.age ?? 99) > YOUNG_MAX_AGE || r.ca + MIN_PA_CA_GAP > r.pa) continue

    for (const [staffId, b] of Object.entries(baseline.entries)) {
      if (claimed.has(staffId) || !b.posSig) continue
      if (normName(r.name) === normName(b.name)) continue
      if (pa !== b.pa) continue
      if (r.staff.first_nation_id !== b.firstNationId) continue
      const sec =
        r.staff.second_nation_id > 0 && r.staff.second_nation_id !== r.staff.first_nation_id
          ? r.staff.second_nation_id
          : 0
      const bSec =
        b.secondNationId > 0 && b.secondNationId !== b.firstNationId ? b.secondNationId : 0
      if (sec !== bSec) continue
      const sig = posSig(r.player)
      if (sig !== b.posSig) continue
      if (!dobMonthDayMatch(r.staff.dob_iso, b.dobIso ?? null)) continue

      const slotRow = rows.find((x) => x.staffIndex >= 0 && String(x.staff.id) === staffId)
      const slotReused =
        slotRow != null && normName(slotRow.name) !== normName(b.name)
      const predecessorStillInSave =
        findStaffIndexByPlayerId(rows, b.playerId, b.name) != null || b.jobForClub === RETIRED_JOB_FOR_CLUB
      if (!slotReused && !predecessorStillInSave) continue

      r.isRegenLikely = true
      r.regenOfName = b.name
      r.regenDetectionSource = 'snapshot'
      r.regenOfStaffIndex =
        findStaffIndexByPlayerId(rows, b.playerId, b.name) ?? b.staffIndex
      claimed.add(staffId)
      n++
      break
    }
  }
  return n
}

export function applyRegenPipeline(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile | null,
  pathKey: string,
): void {
  clearRegenMarkers(rows)
  if (baseline && baseline.pathKey === pathKey) {
    applyBaselineRegenFromSnapshot(rows, baseline, pathKey)
    applyBaselineFingerprintRegen(rows, baseline, pathKey)
  }
  applyHeuristicRegenHints(rows)
}

function posSig(p: PlayerRecord): string {
  return [
    p.goalkeeper,
    p.sweeper,
    p.defender,
    p.defensive_midfielder,
    p.midfielder,
    p.attacking_midfielder,
    p.attacker,
    p.wing_back,
    p.right_side,
    p.left_side,
    p.centre_side,
    p.free_role,
  ].join(',')
}

function regenKey(pa: number, firstNationId: number, secondNationId: number, p: PlayerRecord): string {
  const sec =
    secondNationId > 0 && secondNationId !== firstNationId ? secondNationId : 0
  return `${pa}|${firstNationId}|${sec}|${posSig(p)}`
}

function validDob(iso: string | null): iso is string {
  return iso != null && iso.length >= 10 && iso[4] === '-' && iso[7] === '-'
}

function dobFullMatch(a: string | null, b: string | null): boolean {
  if (!validDob(a) || !validDob(b)) return false
  return a === b
}

function dobMonthDayMatch(a: string | null, b: string | null): boolean {
  if (!validDob(a) || !validDob(b)) return false
  return a.slice(5, 10) === b.slice(5, 10)
}

function isRetiredPlayer(r: UiPlayerRow): boolean {
  return r.staff.job_for_club === RETIRED_JOB_FOR_CLUB
}

function scoreOldCandidate(a: UiPlayerRow, b: UiPlayerRow): number {
  const ar = isRetiredPlayer(a) ? 1000 : 0
  const br = isRetiredPlayer(b) ? 1000 : 0
  if (br !== ar) return br - ar
  if (b.ca !== a.ca) return b.ca - a.ca
  return (b.age ?? 0) - (a.age ?? 0)
}

function pickSourceForYoung(
  young: UiPlayerRow,
  olds: UiPlayerRow[],
  groupSize: number,
  pa: number,
): UiPlayerRow | null {
  const full = olds.filter((o) => dobFullMatch(o.staff.dob_iso, young.staff.dob_iso))
  const pool = full.length > 0 ? full : olds.filter((o) => dobMonthDayMatch(o.staff.dob_iso, young.staff.dob_iso))

  if (pool.length > 0) {
    return [...pool].sort(scoreOldCandidate)[0]!
  }

  if (validDob(young.staff.dob_iso)) return null

  if (pa >= ELITE_PA_NO_GUESS) return null

  if (olds.length === 1 && olds[0] && groupSize <= MAX_GROUP_NULL_DOB_FALLBACK) {
    return olds[0]
  }

  return null
}

export function applyHeuristicRegenHints(rows: UiPlayerRow[]): void {
  const dataRows = rows.filter((r) => r.staffIndex >= 0 && !r.isRegenLikely)
  if (dataRows.length < 2) return

  const byKey = new Map<string, UiPlayerRow[]>()
  for (const r of dataRows) {
    const pa = r.player.potential_ability
    if (pa < 1) continue
    const k = regenKey(pa, r.staff.first_nation_id, r.staff.second_nation_id, r.player)
    let arr = byKey.get(k)
    if (!arr) {
      arr = []
      byKey.set(k, arr)
    }
    arr.push(r)
  }

  for (const group of byKey.values()) {
    if (group.length < 2 || group.length > MAX_GROUP) continue

    const pa = group[0]!.player.potential_ability
    const olds = group.filter((r) => (r.age ?? -1) >= OLD_MIN_AGE)
    const youngs = group.filter(
      (r) =>
        (r.age ?? 99) <= YOUNG_MAX_AGE &&
        r.ca + MIN_PA_CA_GAP <= r.pa &&
        (r.age ?? 99) < OLD_MIN_AGE,
    )
    if (!olds.length || !youngs.length) continue

    if (olds.length > MAX_AMBIG_OLD && youngs.length > MAX_AMBIG_YOUNG) continue

    const nullDobYoungs = youngs.filter((y) => !validDob(y.staff.dob_iso))
    if (nullDobYoungs.length > 1) continue

    for (const y of youngs) {
      const source = pickSourceForYoung(y, olds, group.length, pa)
      if (!source) continue
      if (normName(y.name) === normName(source.name)) continue
      y.isRegenLikely = true
      y.regenOfName = source.name
      y.regenOfStaffIndex = source.staffIndex
      y.regenDetectionSource = 'heuristic'
    }
  }
}
