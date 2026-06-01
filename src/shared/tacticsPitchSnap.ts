import type { TacticArrow, TacticPreset, TacticPresetId } from './tacticsCommunityPresets'
import { TACTIC_PRESETS } from './tacticsCommunityPresets'

export type PitchSlot = {
  id: string
  role: string
  x: number
  y: number
  arrow: TacticArrow
  /** Row the movement arrow points to. */
  arrowTargetRow?: TacticalRowId | null
  /** Horizontal target on that row (enables diagonal arrows). */
  arrowTargetX?: number | null
  /** When false, arrow ends on the plane centre (straight lane / between players). */
  arrowTargetAttachPlayer?: boolean | null
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

export type PitchColumnIndex = 0 | 1 | 2 | 3 | 4

/** Five fixed horizontal slots per row (L → R), matching CM0102 pitch positions. */
export const PITCH_COLUMNS = [0.1, 0.3, 0.5, 0.7, 0.9] as const

/** Narrow trio (e.g. three AMs) — centre-left, centre, centre-right. */
export const PITCH_NARROW_TRIO_X = [0.3, 0.5, 0.7] as const

/** Narrow pair (e.g. two CMs) — half-space between trio slots, not touchline-wide. */
export const PITCH_NARROW_PAIR_X = [0.4, 0.6] as const

/** CM role label for each column on a tactical row (GK uses centre column only). */
const COLUMN_ROLE: Record<TacticalRowId, readonly [string, string, string, string, string]> = {
  gk: ['GK', 'GK', 'GK', 'GK', 'GK'],
  sw: ['SW', 'SW', 'SW', 'SW', 'SW'],
  def: ['DL', 'DCL', 'DC', 'DCR', 'DR'],
  dm: ['DMCL', 'DMCL', 'DMC', 'DMCR', 'DMCR'],
  mc: ['ML', 'MCL', 'MC', 'MCR', 'MR'],
  am: ['AML', 'AMCL', 'AMC', 'AMCR', 'AMR'],
  fwd: ['STCL', 'STC', 'ST', 'STCR', 'STCR'],
}

export function pitchColumnX(col: PitchColumnIndex): number {
  return PITCH_COLUMNS[col]
}

export function nearestColumnIndex(x: number): PitchColumnIndex {
  let best: PitchColumnIndex = 0
  let bd = Infinity
  for (let i = 0; i < PITCH_COLUMNS.length; i++) {
    const d = Math.abs(PITCH_COLUMNS[i]! - x)
    if (d < bd) {
      bd = d
      best = i as PitchColumnIndex
    }
  }
  return best
}

export function roleForColumn(rowId: TacticalRowId, col: PitchColumnIndex): string {
  return COLUMN_ROLE[rowId][col]
}

function rowSpan(sorted: PitchSlot[]): number {
  if (sorted.length < 2) return 0
  return sorted[sorted.length - 1]!.x - sorted[0]!.x
}

function rowCenterMean(sorted: PitchSlot[]): number {
  if (sorted.length === 0) return 0.5
  return sorted.reduce((a, s) => a + s.x, 0) / sorted.length
}

/** True when players are grouped in the middle third (not a wide pair). */
function isCentralCluster(sorted: PitchSlot[]): boolean {
  const span = rowSpan(sorted)
  const mean = rowCenterMean(sorted)
  return span < 0.58 && mean > 0.2 && mean < 0.8
}

/** Three in ML–MC–MR / DL–DC–DR spread: both touchline columns deliberately occupied. */
export function wantsWideThree(sorted: PitchSlot[]): boolean {
  if (sorted.length !== 3) return false
  const xs = sorted.map((s) => s.x)
  return xs.some((x) => x < 0.14) && xs.some((x) => x > 0.86)
}

/** Two at full-back width only when both touchlines are used. */
export function wantsWideTwo(sorted: PitchSlot[]): boolean {
  if (sorted.length !== 2) return false
  const xs = sorted.map((s) => s.x)
  return xs.some((x) => x < 0.14) && xs.some((x) => x > 0.86)
}

/** @deprecated Use {@link wantsWideThree} */
function isWideSpread(sorted: PitchSlot[]): boolean {
  return wantsWideThree(sorted)
}

function isNarrowTrioXs(xs: number[]): boolean {
  if (xs.length !== 3) return false
  return xs.every((x, i) => Math.abs(x - PITCH_NARROW_TRIO_X[i]!) < 0.02)
}

/** X positions for N players on one row (sorted left → right). */
export function rowXPositionsForCount(sorted: PitchSlot[]): number[] {
  const n = sorted.length
  if (n <= 0) return []
  if (n === 1) return [0.5]
  if (n === 5) return [...PITCH_COLUMNS]
  if (n === 2) {
    return wantsWideTwo(sorted) ? [0.1, 0.9] : [...PITCH_NARROW_PAIR_X]
  }
  if (n === 3) {
    return wantsWideThree(sorted) ? [0.1, 0.5, 0.9] : [...PITCH_NARROW_TRIO_X]
  }
  if (n === 4) {
    return isCentralCluster(sorted) ? [0.2, 0.4, 0.6, 0.8] : [0.1, 0.3, 0.7, 0.9]
  }
  return assignColumnsOnRow(sorted).map((c) => PITCH_COLUMNS[c])
}

/** Role labels from final X positions (not legacy count-based DL/DC/DR spread). */
export function rolesForRowPositions(
  rowId: TacticalRowId,
  sorted: PitchSlot[],
  xs: number[],
): string[] {
  if (sorted.length === 3 && (isNarrowTrioXs(xs) || !wantsWideThree(sorted))) {
    if (rowId === 'def') return ['DC', 'DC', 'DC']
    if (rowId === 'sw') return ['SW', 'SW', 'SW']
    if (rowId === 'dm') return ['DMCL', 'DMC', 'DMCR']
    if (rowId === 'mc') return ['MCL', 'MC', 'MCR']
    if (rowId === 'am') return ['AMCL', 'AMC', 'AMCR']
    if (rowId === 'fwd') return ['STCL', 'ST', 'STCR']
  }
  return xs.map((x) => roleForColumn(rowId, nearestColumnIndex(x)))
}

/**
 * Movement arrow from drag target row/column (CM: same vertical line, any plane).
 */
export function computeMovementArrow(
  fromRow: TacticalRowId,
  toRow: TacticalRowId,
  fromX: number,
  toX: number,
): TacticArrow {
  if (fromRow === toRow) {
    const dx = toX - fromX
    if (Math.abs(dx) < 0.06) return 'none'
    return dx > 0 ? 'right' : 'left'
  }
  const dy = tacticalRowY(toRow) - tacticalRowY(fromRow)
  const dx = toX - fromX
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (ady < 0.03 && adx < 0.05) return 'none'
  const mostlyVertical = ady >= adx * 0.72
  const mostlyHorizontal = adx >= ady * 0.72
  if (mostlyVertical && adx < 0.18) {
    return dy > 0 ? 'forward' : 'back'
  }
  if (mostlyHorizontal && ady < 0.14) {
    return dx > 0 ? 'right' : 'left'
  }
  if (dy > 0 && dx > 0) return 'forward-right'
  if (dy > 0 && dx < 0) return 'forward-left'
  if (dy < 0 && dx > 0) return 'back-right'
  return 'back-left'
}

/**
 * Assign each slot a unique column on its row, preserving left-to-right order from drag position.
 */
export function assignColumnsOnRow(slots: PitchSlot[]): PitchColumnIndex[] {
  if (slots.length === 0) return []
  const sortedIdx = slots.map((_, i) => i).sort((a, b) => slots[a]!.x - slots[b]!.x)
  const used = new Set<number>()
  const result: PitchColumnIndex[] = new Array(slots.length)
  const columnOrder: PitchColumnIndex[] = [0, 1, 2, 3, 4]

  for (const idx of sortedIdx) {
    const x = slots[idx]!.x
    const candidates = [...columnOrder].sort(
      (a, b) => Math.abs(PITCH_COLUMNS[a] - x) - Math.abs(PITCH_COLUMNS[b] - x),
    )
    const col = candidates.find((c) => !used.has(c))!
    used.add(col)
    result[idx] = col
  }
  return result
}

/** @deprecated Count-based role table — use {@link roleForColumn} after column snap. */
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

/** @deprecated Use {@link PITCH_COLUMNS} and {@link assignColumnsOnRow}. */
export function evenRowXPositions(count: number, min = 0.1, max = 0.9): number[] {
  if (count <= 0) return []
  if (count === 1) return [PITCH_COLUMNS[2]]
  if (count >= 5) return [...PITCH_COLUMNS]
  const cols = assignColumnsOnRow(
    Array.from({ length: count }, (_, i) => ({
      id: String(i),
      role: '',
      x: min + ((max - min) * i) / (count - 1),
      y: 0,
      arrow: 'none' as const,
    })),
  )
  return cols.map((c) => PITCH_COLUMNS[c])
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
  return assignColumnsOnRow(slots).map((c) => PITCH_COLUMNS[c])
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
  if (rowId === 'gk') {
    const keep = slots[0]!
    return [{ ...keep, y, x: PITCH_COLUMNS[2], role: 'GK', arrowTargetRow: null, arrowTargetX: null, arrowTargetAttachPlayer: null }]
  }
  const order = slots.map((_, i) => i).sort((a, b) => slots[a]!.x - slots[b]!.x)
  const sorted = order.map((i) => slots[i]!)
  const xs = rowXPositionsForCount(sorted)
  const roles = rolesForRowPositions(rowId, sorted, xs)
  return slots.map((s, i) => {
    const sortedIdx = order.indexOf(i)
    return {
      ...s,
      y,
      x: xs[sortedIdx] ?? 0.5,
      role: roles[sortedIdx] ?? roles[0]!,
    }
  })
}

/** Snap each slot to the nearest tactical row and CM column (five per row, one GK centre). */
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
      arrowTargetRow: s.arrowTargetRow ?? null,
      arrowTargetX: s.arrowTargetX ?? null,
      arrowTargetAttachPlayer: s.arrowTargetAttachPlayer ?? null,
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
