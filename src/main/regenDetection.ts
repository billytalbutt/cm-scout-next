/**
 * Same-save “regen” hints (no historical saves, no retired rows unless still in `staff.dat`).
 *
 * Community checks (champman0102.net, CM wiki, scout threads): regens typically reuse the
 * retired player’s **PA**, **nationality**, **natural-position suitability**, and especially
 * **date of birth** (same calendar date, or at least same month/day vs the lineage player).
 * `TPlayer` / `TStaff` in vanilla CM0102 index blocks do **not** include height/weight in the
 * 70 / 110-byte rows we parse — those live outside this path in other tools, so we cannot match
 * on height/weight without a separate layout investigation.
 *
 * Algorithm (hardened vs PA+nation+pos only):
 * 1. Bucket active players by `PA + first nation + second nation (when set) + full natural-position vector`.
 * 2. Within a bucket, require at least one **old** (age ≥ OLD_MIN) and one **young** (age ≤ YOUNG_MAX,
 *    still developing: CA + MIN_PA_CA_GAP ≤ PA).
 * 3. **Source assignment** (must pass name-dup guard):
 *    - Prefer **full `dob_iso` match** between young and an old in the bucket (strongest community signal).
 *    - Else **month–day match** on valid ISO strings (wiki’s “day and month” emphasis).
 *    - Else if the young row has **no DOB** and the bucket has **exactly one** old, use legacy single-source
 *      behaviour (very narrow; avoids dropping everyone when DOB bytes are unset).
 * 4. Among eligible olds for that young, pick the **oldest by age** as `regenOf`.
 * 5. Skip huge buckets and highly ambiguous many-old × many-young groups.
 */
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

export function applyRegenHints(rows: UiPlayerRow[]): void {
  for (const r of rows) {
    delete r.isRegenLikely
    delete r.regenOfName
    delete r.regenOfStaffIndex
  }

  const dataRows = rows.filter((r) => r.staffIndex >= 0)
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
