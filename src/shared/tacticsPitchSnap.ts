import type { TacticArrow, TacticPreset, TacticPresetId } from './tacticsCommunityPresets'
import { TACTIC_PRESETS } from './tacticsCommunityPresets'

export type PitchSlot = {
  id: string
  role: string
  x: number
  y: number
  arrow: TacticArrow
}

export type TacticsPlayerAssignment = {
  staffIndex: number
  name: string
  rolePercent: number | null
  cmScoutBp: number | null
}

/** CM0102-style horizontal lines (GK bottom → forwards top in the pitch widget). */
export type TacticalRowId = 'gk' | 'sw' | 'def' | 'dm' | 'mc' | 'am' | 'fwd'

export const TACTICAL_ROWS = [
  { id: 'gk' as const, label: 'Goalkeeper', y: 0.06, maxSlots: 1 },
  { id: 'sw' as const, label: 'Sweeper', y: 0.16, maxSlots: 5 },
  { id: 'def' as const, label: 'Defence', y: 0.28, maxSlots: 5 },
  { id: 'dm' as const, label: 'Def. midfield', y: 0.4, maxSlots: 5 },
  { id: 'mc' as const, label: 'Midfield', y: 0.52, maxSlots: 5 },
  { id: 'am' as const, label: 'Att. midfield', y: 0.64, maxSlots: 5 },
  { id: 'fwd' as const, label: 'Forward', y: 0.78, maxSlots: 5 },
] as const

export const TACTICAL_ROW_Y = TACTICAL_ROWS.map((r) => r.y)

/** @deprecated Drag still accepts legacy values; release snap uses {@link TACTICAL_ROW_Y} only. */
export const SNAP_Y = TACTICAL_ROW_Y

export const LINEUP_GROUPS = [
  { id: 'gk' as const, label: 'Goalkeeper', yMin: 0, yMax: 0.11 },
  { id: 'defence' as const, label: 'Defenders', yMin: 0.11, yMax: 0.36 },
  { id: 'midfield' as const, label: 'Midfielders', yMin: 0.36, yMax: 0.72 },
  { id: 'attack' as const, label: 'Attackers', yMin: 0.72, yMax: 1 },
] as const

export type LineupGroupId = (typeof LINEUP_GROUPS)[number]['id']

const ROW_ROLES: Record<TacticalRowId, Record<number, readonly string[]>> = {
  gk: { 1: ['GK'] },
  sw: { 1: ['SW'], 2: ['SW', 'SW'], 3: ['SW', 'SW', 'SW'], 4: ['SW', 'SW', 'SW', 'SW'], 5: ['SW', 'SW', 'SW', 'SW', 'SW'] },
  def: {
    1: ['DC'],
    2: ['DL', 'DR'],
    3: ['DL', 'DC', 'DR'],
    4: ['DL', 'DCL', 'DCR', 'DR'],
    5: ['DL', 'DCL', 'DC', 'DCR', 'DR'],
  },
  dm: {
    1: ['DMC'],
    2: ['DMCL', 'DMCR'],
    3: ['DMCL', 'DMC', 'DMCR'],
    4: ['DMCL', 'DMC', 'DMC', 'DMCR'],
    5: ['DMCL', 'DMC', 'DMC', 'DMC', 'DMCR'],
  },
  mc: {
    1: ['MC'],
    2: ['MCL', 'MCR'],
    3: ['ML', 'MC', 'MR'],
    4: ['ML', 'MCL', 'MCR', 'MR'],
    5: ['ML', 'MCL', 'MC', 'MCR', 'MR'],
  },
  am: {
    1: ['AMC'],
    2: ['AML', 'AMR'],
    3: ['AML', 'AMC', 'AMR'],
    4: ['AML', 'AMCL', 'AMCR', 'AMR'],
    5: ['AML', 'AMCL', 'AMC', 'AMCR', 'AMR'],
  },
  fwd: {
    1: ['ST'],
    2: ['STCL', 'STCR'],
    3: ['STCL', 'ST', 'STCR'],
    4: ['STCL', 'STC', 'STC', 'STCR'],
    5: ['STCL', 'STC', 'ST', 'STCR', 'STCR'],
  },
}

export function snapTo(n: number, arr: readonly number[]): number {
  let best = arr[0]!
  let bd = Infinity
  for (const v of arr) {
    const d = Math.abs(v - n)
    if (d < bd) {
      bd = d
      best = v
    }
  }
  return best
}

export function tacticalRowY(rowId: TacticalRowId): number {
  return TACTICAL_ROWS.find((r) => r.id === rowId)!.y
}

export function tacticalRowForY(y: number): TacticalRowId {
  const sy = snapTo(y, TACTICAL_ROW_Y)
  return TACTICAL_ROWS.find((r) => r.y === sy)!.id
}

/** Even spacing across the pitch width (fixes 5-man rows hugging the touchlines). */
export function evenRowXPositions(count: number, min = 0.1, max = 0.9): number[] {
  if (count <= 0) return []
  if (count === 1) return [0.5]
  const span = max - min
  return Array.from({ length: count }, (_, i) => min + (span * i) / (count - 1))
}

export function rolesForTacticalRow(rowId: TacticalRowId, count: number): string[] {
  const n = Math.min(Math.max(count, 1), 5)
  const table = ROW_ROLES[rowId][n]
  if (table) return [...table]
  return Array.from({ length: n }, () => ROW_ROLES[rowId][1]![0]!)
}

/** @deprecated Use {@link evenRowXPositions} — kept for tests migrating off role-based spread. */
export const CM_ROW_X_BY_COUNT: Record<number, readonly number[]> = {
  1: evenRowXPositions(1),
  2: evenRowXPositions(2),
  3: evenRowXPositions(3),
  4: evenRowXPositions(4),
  5: evenRowXPositions(5),
}

export function snapXPositionsForRow(slots: PitchSlot[]): number[] {
  return evenRowXPositions(slots.length)
}

export function snapXPositionsForCount(n: number): number[] {
  return evenRowXPositions(n)
}

export function isGoalkeeperRow(y: number): boolean {
  return tacticalRowForY(y) === 'gk'
}

export function pitchRowKey(y: number): number {
  return tacticalRowY(tacticalRowForY(y))
}

function slotsOnRow(slots: PitchSlot[], rowId: TacticalRowId): PitchSlot[] {
  const y = tacticalRowY(rowId)
  return slots.filter((s) => tacticalRowForY(s.y) === rowId || Math.abs(s.y - y) < 0.001)
}

/** If more than one player snapped to GK, move extras to the defence line. */
function enforceSingleGoalkeeper(slots: PitchSlot[]): PitchSlot[] {
  const gkY = tacticalRowY('gk')
  const defY = tacticalRowY('def')
  const gkSlots = slots.filter((s) => tacticalRowForY(s.y) === 'gk')
  if (gkSlots.length <= 1) return slots
  const sorted = [...gkSlots].sort((a, b) => Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5))
  const keepId = sorted[0]!.id
  return slots.map((s) => {
    if (tacticalRowForY(s.y) === 'gk' && s.id !== keepId) {
      return { ...s, y: defY }
    }
    return s
  })
}

function redistributeRow(slots: PitchSlot[], rowId: TacticalRowId): PitchSlot[] {
  const y = tacticalRowY(rowId)
  const sorted = [...slots].sort((a, b) => a.x - b.x)
  const roles = rolesForTacticalRow(rowId, sorted.length)
  const xs = evenRowXPositions(sorted.length)
  return sorted.map((s, i) => ({
    ...s,
    y,
    x: xs[i] ?? 0.5,
    role: roles[i] ?? roles[0]!,
  }))
}

/** Snap each slot to the nearest tactical row, space evenly on X, and set CM role from the row. */
export function snapAndRedistributePitch(slots: PitchSlot[]): PitchSlot[] {
  const snappedY = slots.map((s) => ({
    ...s,
    y: tacticalRowY(tacticalRowForY(s.y)),
  }))
  const withGk = enforceSingleGoalkeeper(snappedY)
  const out: PitchSlot[] = []
  for (const row of TACTICAL_ROWS) {
    const rowSlots = withGk.filter((s) => tacticalRowForY(s.y) === row.id)
    if (rowSlots.length === 0) continue
    out.push(...redistributeRow(rowSlots, row.id))
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x)
}

export function lineupGroupForSlot(s: PitchSlot): LineupGroupId {
  const rowId = tacticalRowForY(s.y)
  if (rowId === 'gk') return 'gk'
  if (rowId === 'sw' || rowId === 'def') return 'defence'
  if (rowId === 'fwd') return 'attack'
  return 'midfield'
}

export function slotsInLineupGroup(slots: PitchSlot[], groupId: LineupGroupId): PitchSlot[] {
  return slots
    .filter((s) => lineupGroupForSlot(s) === groupId)
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export function cmScoutRoleIndexForPosition(role: string): number {
  const r = role.toUpperCase()
  if (!r || r === 'GK') return 0
  if (r.includes('WB') || r === 'WBL' || r === 'WBR') return 6
  if (r.startsWith('ST') || r === 'SC' || r === 'A' || r.startsWith('A')) return 5
  if (r.startsWith('AM') || r.includes('AM')) return 4
  if (r.startsWith('DM') || r.includes('DM')) return 2
  if (r.startsWith('M') && !r.startsWith('AM')) return 3
  if (r.startsWith('D') || r === 'SW' || r.includes('DC') || r.includes('DL') || r.includes('DR')) return 1
  return 3
}

export function pitchSlotsFromPreset(preset: TacticPreset): PitchSlot[] {
  return snapAndRedistributePitch(
    preset.slots.map((s, i) => ({
      id: `${preset.id}-${i}`,
      role: s.role,
      x: s.x,
      y: s.y,
      arrow: s.arrow ?? 'none',
    })),
  )
}

export function initialPitchSlots(presetId: TacticPresetId = '4132_press_short'): PitchSlot[] {
  const preset = TACTIC_PRESETS.find((x) => x.id === presetId)!
  return pitchSlotsFromPreset(preset)
}

export function teamRatingFromAssignments(
  slots: PitchSlot[],
  assignments: Partial<Record<string, TacticsPlayerAssignment | null>>,
): number | null {
  const used: number[] = []
  for (const s of slots) {
    if (!s.role) continue
    const a = assignments[s.id]
    if (!a) continue
    const pct = a.rolePercent ?? a.cmScoutBp
    if (pct != null && Number.isFinite(pct)) used.push(pct)
  }
  if (used.length === 0) return null
  return Math.round(used.reduce((a, b) => a + b, 0) / used.length)
}

/** Map a preset slot role onto the nearest tactical row before snap (wing-backs → def line, etc.). */
export function inferTacticalRowFromRole(role: string): TacticalRowId {
  const r = role.trim().toUpperCase()
  if (r === 'GK') return 'gk'
  if (r === 'SW') return 'sw'
  if (r.startsWith('ST') || r === 'SC' || r === 'FC' || r === 'A') return 'fwd'
  if (r.startsWith('AM')) return 'am'
  if (r.startsWith('DM') || r === 'DM') return 'dm'
  if (r.startsWith('M') && !r.startsWith('AM')) return 'mc'
  if (r.startsWith('D') || r.includes('WB') || r === 'WBL' || r === 'WBR') return 'def'
  return 'mc'
}
