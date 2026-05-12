/**
 * Regen detection uses two layers (see `regenBaseline.ts` for snapshot I/O):
 *
 * **1. GPF2-style snapshot (community “best” method)**  
 * [GPF2 / Generated Player Finder 2](https://champman0102.net/viewtopic.php?t=2941) and similar save tools work by
 * comparing an **early snapshot** of the uncompressed save to a **later** load: the same `staff.dat` person
 * **id** keeps the same slot while **name indices** change when the game replaces a retiring player with a regen.
 * We mirror that: save a baseline after you load a save (ideally before many retirements), then reload later —
 * anyone whose `(first_name_id, second_name_id, common_name_id)` changed vs baseline is flagged; **Regen of**
 * shows the **snapshot display name** (the identity before the name change).
 *
 * **2. Same-save heuristic (fallback)**  
 * When no baseline exists for this file path, we use PA + nationalities + natural positions + DOB rules as a
 * weaker single-snapshot guess (see comments on `applyHeuristicRegenHints`). This cannot match GPF2’s accuracy
 * without two points in time.
 *
 * `TPlayer` / `TStaff` in vanilla CM0102 index blocks do **not** include height/weight in the 70 / 110-byte rows
 * we parse — other tools may read additional structures.
 */
import type { RegenBaselineFile } from './regenBaseline'
import type { PlayerRecord, UiPlayerRow } from './database/types'

const YOUNG_MAX_AGE = 23
const OLD_MIN_AGE = 30
/** Require young players to still be notably below their PA (typical regen / youth). */
const MIN_PA_CA_GAP = 5
/** With DOB / MD matching, collisions are rarer — allow slightly larger buckets before skipping. */
const MAX_GROUP = 24
const MAX_AMBIG_OLD = 2
const MAX_AMBIG_YOUNG = 2
/** Legacy fallback: only when young has no DOB and the bucket is tiny with a single old. */
const MAX_GROUP_NULL_DOB_FALLBACK = 6

function clearRegenMarkers(rows: UiPlayerRow[]): void {
  for (const r of rows) {
    delete r.isRegenLikely
    delete r.regenOfName
    delete r.regenOfStaffIndex
  }
}

/**
 * Same `staff.dat` **id** as baseline, but name-id triple changed → treated like GPF2 “name changed at same id”.
 * `regenOfName` is the predecessor’s display name from the snapshot (not necessarily still in the DB).
 */
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
    delete r.regenOfStaffIndex
    n++
  }
  return n
}

/** Clear markers, apply snapshot rules if baseline matches `pathKey`, then heuristic for everyone not yet flagged. */
export function applyRegenPipeline(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile | null,
  pathKey: string,
): void {
  clearRegenMarkers(rows)
  if (baseline && baseline.pathKey === pathKey) {
    applyBaselineRegenFromSnapshot(rows, baseline, pathKey)
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

/** Second nation only when distinct from first — tightens unrelated PA+nation collisions. */
function regenKey(pa: number, firstNationId: number, secondNationId: number, p: PlayerRecord): string {
  const sec =
    secondNationId > 0 && secondNationId !== firstNationId ? secondNationId : 0
  return `${pa}|${firstNationId}|${sec}|${posSig(p)}`
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function validDob(iso: string | null): iso is string {
  return iso != null && iso.length >= 10 && iso[4] === '-' && iso[7] === '-'
}

function dobFullMatch(a: string | null, b: string | null): boolean {
  if (!validDob(a) || !validDob(b)) return false
  return a === b
}

/** Month–day (wiki: same day/month as lineage); ignores birth year. */
function dobMonthDayMatch(a: string | null, b: string | null): boolean {
  if (!validDob(a) || !validDob(b)) return false
  return a.slice(5, 10) === b.slice(5, 10)
}

/**
 * Pick the lineage “source” old for this young row: DOB-first, then month–day, then tiny-bucket fallback.
 */
function pickSourceForYoung(young: UiPlayerRow, olds: UiPlayerRow[], groupSize: number): UiPlayerRow | null {
  const full = olds.filter((o) => dobFullMatch(o.staff.dob_iso, young.staff.dob_iso))
  const pool = full.length > 0 ? full : olds.filter((o) => dobMonthDayMatch(o.staff.dob_iso, young.staff.dob_iso))

  if (pool.length > 0) {
    return [...pool].sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]!
  }

  if (
    !validDob(young.staff.dob_iso) &&
    olds.length === 1 &&
    olds[0] &&
    groupSize <= MAX_GROUP_NULL_DOB_FALLBACK
  ) {
    return olds[0]
  }

  return null
}

/** Single-snapshot fingerprinting — skipped for rows already marked by a GPF2-style baseline. */
function applyHeuristicRegenHints(rows: UiPlayerRow[]): void {
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
      const source = pickSourceForYoung(y, olds, group.length)
      if (!source) continue
      if (normName(y.name) === normName(source.name)) continue
      y.isRegenLikely = true
      y.regenOfName = source.name
      y.regenOfStaffIndex = source.staffIndex
    }
  }
}
