import type { GridPlayerRow } from './gridTypes'
import { lineupGroupForSlot, type LineupGroupId, type PitchSlot } from './tacticsPitchSnap'

/** CM natural-position threshold (same as profile / CM Scout suitability). */
export const TACTICS_POSITION_SUIT_CUT = 14

export type NaturalPosRole = 'GK' | 'SW' | 'D' | 'WB' | 'DM' | 'M' | 'AM' | 'ST'

const GROUP_ROLES: Record<LineupGroupId, readonly NaturalPosRole[]> = {
  gk: ['GK'],
  defence: ['D', 'SW', 'WB'],
  midfield: ['DM', 'M', 'AM'],
  attack: ['ST'],
}

function posVal(row: GridPlayerRow, role: NaturalPosRole): number {
  switch (role) {
    case 'GK':
      return row.posGk ?? 0
    case 'SW':
      return row.posSw ?? 0
    case 'D':
      return row.posD ?? 0
    case 'WB':
      return row.posWb ?? 0
    case 'DM':
      return row.posDm ?? 0
    case 'M':
      return row.posM ?? 0
    case 'AM':
      return row.posAm ?? 0
    case 'ST':
      return row.posAtt ?? 0
  }
}

function bestFallbackRole(row: GridPlayerRow): NaturalPosRole {
  const order: NaturalPosRole[] = ['ST', 'AM', 'M', 'DM', 'WB', 'D', 'SW', 'GK']
  let best: NaturalPosRole = 'M'
  let bestV = -1
  for (const id of order) {
    const v = posVal(row, id)
    if (v > bestV) {
      bestV = v
      best = id
    }
  }
  return best
}

/** Natural CM positions (suitability &gt; 14), or single best-rated role when none qualify. */
export function naturalPositionRoles(row: GridPlayerRow): NaturalPosRole[] {
  const roles: NaturalPosRole[] = []
  const all: NaturalPosRole[] = ['GK', 'SW', 'D', 'WB', 'DM', 'M', 'AM', 'ST']
  for (const id of all) {
    if (posVal(row, id) > TACTICS_POSITION_SUIT_CUT) roles.push(id)
  }
  if (roles.length) return roles
  return [bestFallbackRole(row)]
}

export function playerEligibleForLineupGroup(row: GridPlayerRow, groupId: LineupGroupId): boolean {
  const allowed = GROUP_ROLES[groupId]
  return naturalPositionRoles(row).some((r) => allowed.includes(r))
}

export function filterSquadRowsForPitchSlot(squadRows: GridPlayerRow[], slot: PitchSlot): GridPlayerRow[] {
  const groupId = lineupGroupForSlot(slot)
  return squadRows.filter((r) => playerEligibleForLineupGroup(r, groupId))
}
