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

/** CM-style: 3 CBs use inner three columns; 4 across use full width; 1 uses centre only. */
export function snapXPositionsForCount(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [0.5]
  if (n === 2) return [0.28, 0.72]
  if (n === 3) return [0.28, 0.5, 0.72]
  if (n === 4) return [0.1, 0.37, 0.63, 0.9]
  return [...SNAP_X]
}

export function isGoalkeeperRow(y: number): boolean {
  return snapTo(y, SNAP_Y) <= 0.12
}

/** After drag, snap Y then redistribute X within each row (GK always centre). */
export function snapAndRedistributePitch(slots: PitchSlot[]): PitchSlot[] {
  const snapped = slots.map((s) => ({
    ...s,
    y: snapTo(s.y, SNAP_Y),
    x: snapTo(s.x, SNAP_X),
  }))

  const byRow = new Map<number, PitchSlot[]>()
  for (const s of snapped) {
    const ry = s.y
    const list = byRow.get(ry) ?? []
    list.push(s)
    byRow.set(ry, list)
  }

  const out: PitchSlot[] = []
  for (const [, rowSlots] of byRow) {
    const sorted = [...rowSlots].sort((a, b) => a.x - b.x)
    if (sorted.length === 1 && isGoalkeeperRow(sorted[0]!.y)) {
      out.push({ ...sorted[0]!, x: 0.5 })
      continue
    }
    const xs = snapXPositionsForCount(sorted.length)
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
