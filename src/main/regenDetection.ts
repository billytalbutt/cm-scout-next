/**
 * Regen detection (see `regenBaseline.ts` for snapshot I/O):
 *
 * **1. GPF2 snapshot slot** — same `staff.dat` id, changed name → predecessor (community default).
 * **2. Snapshot fingerprint** — new id, young player, PA+nation+positions+DOB month/day match.
 * **3. Same-save heuristic** — fingerprint bucket fallback without snapshot.
 * **4. Elite prospects** — young high-PA players for scouting (link optional).
 */
import type { RegenBaselineEntry, RegenBaselineFile } from './regenBaseline'
import type { UiPlayerRow } from './database/types'
import {
  baselineFingerprintKey,
  heuristicRegenBucketKey,
  regenDobMonthDayMatch,
  regenMatchesSnapshotLegend,
  rowFingerprintKey,
  validRegenDob,
} from './regenFingerprint'
import { ELITE_PROSPECT_PA_MIN } from '../shared/regenConstants'

/** Indexes for O(1) staff / player lookups during regen passes. */
export type RegenRowLookup = {
  byPlayerId: Map<number, UiPlayerRow[]>
  byStaffId: Map<string, UiPlayerRow>
}

export function buildRegenRowLookup(rows: UiPlayerRow[]): RegenRowLookup {
  const byPlayerId = new Map<number, UiPlayerRow[]>()
  const byStaffId = new Map<string, UiPlayerRow>()
  for (const r of rows) {
    if (r.staffIndex < 0) continue
    byStaffId.set(String(r.staff.id), r)
    const pid = r.staff.player_id
    if (pid <= 0) continue
    let arr = byPlayerId.get(pid)
    if (!arr) {
      arr = []
      byPlayerId.set(pid, arr)
    }
    arr.push(r)
  }
  return { byPlayerId, byStaffId }
}

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
    delete r.isEliteProspect
  }
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function findStaffIndexByPlayerIdFromLookup(
  lookup: RegenRowLookup,
  playerId: number,
  snapshotName?: string,
): number | undefined {
  if (playerId <= 0) return undefined
  const matches = lookup.byPlayerId.get(playerId)
  if (!matches?.length) return undefined
  if (matches.length === 1) return matches[0]!.staffIndex
  if (snapshotName) {
    const want = normName(snapshotName)
    const byName = matches.find((r) => normName(r.name) === want)
    if (byName) return byName.staffIndex
  }
  const retired = matches.filter((r) => r.staff.job_for_club === RETIRED_JOB_FOR_CLUB)
  if (retired.length === 1) return retired[0]!.staffIndex
  return [...matches].sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]!.staffIndex
}

/** Find predecessor still in the save (e.g. retired legend) by `player_id` from snapshot. */
export function findStaffIndexByPlayerId(
  rows: UiPlayerRow[],
  playerId: number,
  snapshotName?: string,
): number | undefined {
  return findStaffIndexByPlayerIdFromLookup(buildRegenRowLookup(rows), playerId, snapshotName)
}

export function applyBaselineRegenFromSnapshot(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile,
  pathKey: string,
  lookup?: RegenRowLookup,
): number {
  if (baseline.pathKey !== pathKey) return 0
  const lu = lookup ?? buildRegenRowLookup(rows)
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
    r.regenDetectionSource = 'snapshot-slot'
    r.regenOfStaffIndex =
      findStaffIndexByPlayerIdFromLookup(lu, b.playerId, b.name) ??
      (Number.isFinite(b.staffIndex) && b.staffIndex >= 0 ? b.staffIndex : undefined)
    n++
  }
  return n
}

type BaselineFingerprintHit = { staffId: string; b: RegenBaselineEntry }

function buildBaselineFingerprintIndex(
  baseline: RegenBaselineFile,
): Map<string, BaselineFingerprintHit[]> {
  const index = new Map<string, BaselineFingerprintHit[]>()
  for (const [staffId, b] of Object.entries(baseline.entries)) {
    const key = baselineFingerprintKey(b)
    if (!key) continue
    let list = index.get(key)
    if (!list) {
      list = []
      index.set(key, list)
    }
    list.push({ staffId, b })
  }
  return index
}

/**
 * Match young regens to snapshot fingerprints (PA + nation + positions + DOB month/day).
 * Covers new `staff.dat` ids when the community fingerprint still matches a snapshot legend.
 */
export function applyBaselineFingerprintRegen(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile,
  pathKey: string,
  lookup?: RegenRowLookup,
): number {
  if (baseline.pathKey !== pathKey) return 0
  const lu = lookup ?? buildRegenRowLookup(rows)
  const index = buildBaselineFingerprintIndex(baseline)
  const claimed = new Set<string>()
  let n = 0
  for (const r of rows) {
    if (r.staffIndex < 0 || r.isRegenLikely) continue
    const pa = r.player.potential_ability
    if (pa < 1) continue
    if ((r.age ?? 99) > YOUNG_MAX_AGE || r.ca + MIN_PA_CA_GAP > r.pa) continue

    const key = rowFingerprintKey(r)
    if (!key) continue
    const candidates = index.get(key)
    if (!candidates?.length) continue

    for (const { staffId, b } of candidates) {
      if (claimed.has(staffId)) continue
      if (normName(r.name) === normName(b.name)) continue
      if (!regenMatchesSnapshotLegend(r, b)) continue

      const slotRow = lu.byStaffId.get(staffId)
      const slotReused = slotRow != null && normName(slotRow.name) !== normName(b.name)
      const predecessorStillInSave =
        findStaffIndexByPlayerIdFromLookup(lu, b.playerId, b.name) != null ||
        b.jobForClub === RETIRED_JOB_FOR_CLUB
      if (!slotReused && !predecessorStillInSave) continue

      r.isRegenLikely = true
      r.regenOfName = b.name
      r.regenDetectionSource = 'snapshot-fingerprint'
      r.regenOfStaffIndex =
        findStaffIndexByPlayerIdFromLookup(lu, b.playerId, b.name) ?? b.staffIndex
      claimed.add(staffId)
      n++
      break
    }
  }
  return n
}

/** Mark young high-PA players for the Regens tab (scouting gems even without a link). */
export function applyEliteProspectMarkers(
  rows: UiPlayerRow[],
  paMin: number = ELITE_PROSPECT_PA_MIN,
): number {
  let n = 0
  for (const r of rows) {
    if (r.staffIndex < 0) continue
    const pa = r.player.potential_ability
    if (pa < paMin) continue
    if ((r.age ?? 99) > YOUNG_MAX_AGE) continue
    if (r.ca + MIN_PA_CA_GAP > pa) continue
    r.isEliteProspect = true
    n++
  }
  return n
}

export function applyRegenPipeline(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile | null,
  pathKey: string,
): void {
  clearRegenMarkers(rows)
  const lookup = buildRegenRowLookup(rows)
  if (baseline && baseline.pathKey === pathKey) {
    applyBaselineRegenFromSnapshot(rows, baseline, pathKey, lookup)
    applyBaselineFingerprintRegen(rows, baseline, pathKey, lookup)
  }
  applyHeuristicRegenHints(rows)
  applyEliteProspectMarkers(rows)
}

function dobFullMatch(a: string | null, b: string | null): boolean {
  if (!validRegenDob(a) || !validRegenDob(b)) return false
  return a === b
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
  const pool =
    full.length > 0 ? full : olds.filter((o) => regenDobMonthDayMatch(o.staff.dob_iso, young.staff.dob_iso))

  if (pool.length > 0) {
    return [...pool].sort(scoreOldCandidate)[0]!
  }

  if (validRegenDob(young.staff.dob_iso)) return null

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
    const k = heuristicRegenBucketKey(r)
    if (!k) continue
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

    const nullDobYoungs = youngs.filter((y) => !validRegenDob(y.staff.dob_iso))
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
