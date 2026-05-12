/**
 * Heuristic “regen” hints for a single index.dat snapshot (no historical saves).
 *
 * Community wisdom (champman0102.net, etc.): regens often reuse the retired player’s
 * potential ability, primary nationality, and natural-position suitability bytes; names differ.
 *
 * We cannot see truly retired non-player staff cleanly in this loader, so we approximate:
 * group all **active** named players by `PA + first nation id + full natural-position vector`.
 * Within a group, if there is at least one **older** player (age ≥ OLD_MIN) and at least one
 * **young** player (age ≤ 23, still developing vs PA), we flag each young player as a
 * likely regen of the **oldest** player in that group (by age). Ambiguous megagroups
 * (many old and many young) are skipped to reduce false positives.
 */
import type { PlayerRecord, UiPlayerRow } from './database/types'

const YOUNG_MAX_AGE = 23
const OLD_MIN_AGE = 30
/** Require young players to still be notably below their PA (typical regen / youth). */
const MIN_PA_CA_GAP = 5
/** Skip huge collision buckets (unrelated players sharing a signature). */
const MAX_GROUP = 12
const MAX_AMBIG_OLD = 2
const MAX_AMBIG_YOUNG = 2

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

function regenKey(pa: number, firstNationId: number, p: PlayerRecord): string {
  return `${pa}|${firstNationId}|${posSig(p)}`
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
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
    const k = regenKey(pa, r.staff.first_nation_id, r.player)
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

    const source = [...olds].sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]!
    const srcName = normName(source.name)

    for (const y of youngs) {
      if (normName(y.name) === srcName) continue
      y.isRegenLikely = true
      y.regenOfName = source.name
      y.regenOfStaffIndex = source.staffIndex
    }
  }
}
