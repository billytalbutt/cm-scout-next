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

/** Five horizontal snap columns (incl. dead centre). */
export const SNAP_X = [0.1, 0.28, 0.5, 0.72, 0.9] as const

export const SNAP_Y = [
  0.06, 0.22, 0.28, 0.3, 0.32, 0.38, 0.4, 0.42, 0.44, 0.48, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.68,
  0.72, 0.8, 0.82, 0.84, 0.9,
] as const

/** CM0102-style horizontal spans per row size (full-width four, inner three, etc.). */
export const CM_ROW_X_BY_COUNT: Record<number, readonly number[]> = {
  1: [0.5],
  3: [0.28, 0.5, 0.72],
  4: [0.14, 0.38, 0.62, 0.86],
  5: [0.1, 0.28, 0.5, 0.72, 0.9],
}

/** Narrow central pair — strikers sit inside the outer columns of a three-man row above. */
export const CM_PAIR_NARROW = [0.38, 0.62] as const

/** DM / tucked AM pairs (4231, tree). */
export const CM_PAIR_DM = [0.35, 0.65] as const

/** Two central mids on one line (352 mid pair). */
export const CM_PAIR_MID = [0.32, 0.68] as const

/** Wide midfield pair (442 ML/MR). */
export const CM_PAIR_WIDE_MID = [0.22, 0.78] as const

/** Touchline pair (full-backs, wing-backs on same row). */
export const CM_PAIR_TOUCHLINE = [0.12, 0.88] as const

export const LINEUP_GROUPS = [
  { id: 'gk' as const, label: 'Goalkeeper', yMin: 0, yMax: 0.12 },
  { id: 'defence' as const, label: 'Defenders', yMin: 0.12, yMax: 0.38 },
  { id: 'midfield' as const, label: 'Midfielders', yMin: 0.38, yMax: 0.68 },
  { id: 'attack' as const, label: 'Attackers', yMin: 0.68, yMax: 1 },
] as const

export type LineupGroupId = (typeof LINEUP_GROUPS)[number]['id']

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

function roleUpper(role: string): string {
  return role.trim().toUpperCase()
}

/** Full-back / wing-back style roles on a two-man row. */
export function isTouchlineRole(role: string): boolean {
  const r = roleUpper(role)
  return /^(DL|DR|WBL|WBR|LWB|RWB|LB|RB)$/.test(r) || /^WB[LR]?$/.test(r)
}

/** ML/MR-style wide midfield on a two-man row. */
export function isHalfSpaceWideRole(role: string): boolean {
  const r = roleUpper(role)
  return /^(ML|MR|AML|AMR)$/.test(r) || /^(ML|MR|AML|AMR)/.test(r)
}

export function isStrikerRole(role: string): boolean {
  const r = roleUpper(role)
  return r.startsWith('ST') || r === 'SC' || r.startsWith('FC') || r === 'A'
}

export function isDmPairRole(role: string): boolean {
  const r = roleUpper(role)
  return r.startsWith('DM') && r !== 'DMC'
}

export function isCentralMidPairRole(role: string): boolean {
  const r = roleUpper(role)
  if (r.startsWith('AM')) return false
  return r.startsWith('MC') || r === 'MCL' || r === 'MCR' || (r.startsWith('M') && r.length <= 4)
}

function rowXSpread(slots: PitchSlot[]): number {
  if (slots.length < 2) return 0
  const xs = slots.map((s) => s.x)
  return Math.max(...xs) - Math.min(...xs)
}

/**
 * CM0102 row spacing: count + role + drag spread decide horizontal slots.
 * Two strikers use a narrow pair so they do not line up with the outer men in a three-man row above.
 */
export function snapXPositionsForRow(slots: PitchSlot[]): number[] {
  const n = slots.length
  if (n <= 0) return []
  const fixed = CM_ROW_X_BY_COUNT[n]
  if (fixed) return [...fixed]

  if (n === 2) {
    const roles = slots.map((s) => roleUpper(s.role))
    if (roles.every(isTouchlineRole)) return [...CM_PAIR_TOUCHLINE]
    if (roles.every(isHalfSpaceWideRole)) return [...CM_PAIR_WIDE_MID]
    if (roles.every(isStrikerRole)) return [...CM_PAIR_NARROW]
    if (roles.every(isDmPairRole)) return [...CM_PAIR_DM]
    if (roles.every(isCentralMidPairRole)) return [...CM_PAIR_MID]
    if (roles.every((r) => r.startsWith('AM') && !isHalfSpaceWideRole(r))) return [...CM_PAIR_DM]

    const spread = rowXSpread(slots)
    if (spread >= 0.62) return [...CM_PAIR_TOUCHLINE]
    if (spread >= 0.48) return [...CM_PAIR_WIDE_MID]
    if (spread >= 0.32) return [...CM_PAIR_MID]
    return [...CM_PAIR_NARROW]
  }

  return [...SNAP_X].slice(0, n)
}

/** @deprecated Use snapXPositionsForRow — kept for simple count-only callers. */
export function snapXPositionsForCount(n: number): number[] {
  return snapXPositionsForRow(
    Array.from({ length: n }, (_, i) => ({
      id: String(i),
      role: n === 2 ? 'ST' : 'MC',
      x: 0.5,
      y: 0.5,
      arrow: 'none' as const,
    })),
  )
}

export function isGoalkeeperRow(y: number): boolean {
  return snapTo(y, SNAP_Y) <= 0.12
}

/** Buckets snapped Y for tests / lineup helpers (coarse band). */
export function pitchRowKey(y: number): number {
  const sy = snapTo(y, SNAP_Y)
  return Math.round(sy * 20) / 20
}

/** Max vertical span for one tactical row after Y snap (352 CBs, slight preset offsets). */
const ROW_Y_MAX_SPAN = 0.08

function rowYSpan(row: PitchSlot[]): number {
  const ys = row.map((s) => s.y)
  return Math.max(...ys) - Math.min(...ys)
}

/** Merge slots into rows while the row’s Y span stays within ROW_Y_MAX_SPAN. */
export function clusterPitchRows(slots: PitchSlot[]): PitchSlot[][] {
  const sorted = [...slots].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: PitchSlot[][] = []
  for (const s of sorted) {
    const last = rows[rows.length - 1]
    if (last && rowYSpan([...last, s]) <= ROW_Y_MAX_SPAN) {
      last.push(s)
    } else {
      rows.push([s])
    }
  }
  return rows
}

/** After drag, snap Y then redistribute X within each row (GK always centre). */
export function snapAndRedistributePitch(slots: PitchSlot[]): PitchSlot[] {
  const withY = slots.map((s) => ({
    ...s,
    y: snapTo(s.y, SNAP_Y),
  }))

  const out: PitchSlot[] = []
  for (const rowSlots of clusterPitchRows(withY)) {
    const sorted = [...rowSlots].sort((a, b) => a.x - b.x)
    if (sorted.length === 1 && isGoalkeeperRow(sorted[0]!.y)) {
      out.push({ ...sorted[0]!, x: 0.5 })
      continue
    }
    const xs = snapXPositionsForRow(sorted)
    sorted.forEach((s, i) => {
      out.push({ ...s, x: xs[i] ?? 0.5 })
    })
  }
  return out
}


export function lineupGroupForSlot(s: PitchSlot): LineupGroupId {
  const y = snapTo(s.y, SNAP_Y)
  for (const g of LINEUP_GROUPS) {
    if (y >= g.yMin && y < g.yMax) return g.id
  }
  return 'attack'
}

export function slotsInLineupGroup(slots: PitchSlot[], groupId: LineupGroupId): PitchSlot[] {
  return slots
    .filter((s) => lineupGroupForSlot(s) === groupId)
    .sort((a, b) => a.x - b.x)
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
