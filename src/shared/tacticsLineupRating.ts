import type { GridPlayerRow } from './gridTypes'
import { cmScoutRoleIndexForPosition, type TacticsPlayerAssignment } from './tacticsPitchSnap'

/** CM Scout role % for a pitch slot label (GK, DC, ST, …). */
export function rolePercentForSlot(row: GridPlayerRow, slotRole: string): number | null {
  const idx = cmScoutRoleIndexForPosition(slotRole)
  const r7 = row.role7
  if (r7 && r7.length === 7 && Number.isFinite(r7[idx]!)) return r7[idx]!
  if (row.cmScoutRatingBp != null && Number.isFinite(row.cmScoutRatingBp)) return row.cmScoutRatingBp
  return null
}

export function assignmentFromSquadRow(row: GridPlayerRow, slotRole: string): TacticsPlayerAssignment {
  return {
    staffIndex: row.staffIndex,
    name: row.name,
    rolePercent: rolePercentForSlot(row, slotRole),
    cmScoutBp: row.cmScoutRatingBp ?? null,
  }
}

export function comparePlayersForSlot(a: GridPlayerRow, b: GridPlayerRow, slotRole: string): number {
  const ra = rolePercentForSlot(a, slotRole) ?? -1
  const rb = rolePercentForSlot(b, slotRole) ?? -1
  if (rb !== ra) return rb - ra
  if (b.ca !== a.ca) return b.ca - a.ca
  return a.name.localeCompare(b.name)
}
