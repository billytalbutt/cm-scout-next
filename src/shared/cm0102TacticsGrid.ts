import type { TacticArrow, TacticPreset, TacticPresetSlot } from './tacticsCommunityPresets'

/** CM0102 overview-style tactic rows (GK at bottom of pitch widget). */
export const CM0102_TACTIC_ROWS = [
  { id: 'attack', label: 'Strikers', pitchY: 0.84 },
  { id: 'am', label: 'Attacking midfield', pitchY: 0.68 },
  { id: 'mid', label: 'Midfield', pitchY: 0.54 },
  { id: 'dm', label: 'Defensive midfield', pitchY: 0.42 },
  { id: 'defence', label: 'Defence', pitchY: 0.3 },
  { id: 'sweeper', label: 'Sweeper', pitchY: 0.22 },
  { id: 'gk', label: 'Goalkeeper', pitchY: 0.06 },
] as const

export const CM0102_TACTIC_COLS = [
  { id: 'left', label: 'Left', pitchX: 0.12 },
  { id: 'lc', label: 'Left centre', pitchX: 0.37 },
  { id: 'rc', label: 'Right centre', pitchX: 0.63 },
  { id: 'right', label: 'Right', pitchX: 0.88 },
] as const

export type Cm0102TacticRowId = (typeof CM0102_TACTIC_ROWS)[number]['id']
export type Cm0102TacticColId = (typeof CM0102_TACTIC_COLS)[number]['id']

export type Cm0102GridSlotId = `${Cm0102TacticRowId}-${Cm0102TacticColId}`

export type Cm0102GridSlot = {
  id: Cm0102GridSlotId
  rowId: Cm0102TacticRowId
  colId: Cm0102TacticColId
  /** Position chip label (DL, DMC, ST, …). */
  role: string
  pitchX: number
  pitchY: number
  /** Formation uses this slot (empty slots stay on grid but dimmed). */
  active: boolean
  arrow: TacticArrow
}

export type TacticsPlayerAssignment = {
  staffIndex: number
  name: string
  /** CM Scout % for the slot’s mapped weight column. */
  rolePercent: number | null
  /** Grid BP when available. */
  cmScoutBp: number | null
}

const DEFAULT_ROLE_BY_ROW_COL: Partial<Record<Cm0102TacticRowId, string[]>> = {
  gk: ['GK', '', '', ''],
  sweeper: ['SW', '', '', ''],
  defence: ['DL', 'DC', 'DC', 'DR'],
  dm: ['', 'DMC', 'DMC', ''],
  mid: ['ML', 'MC', 'MC', 'MR'],
  am: ['AML', 'AMC', 'AMC', 'AMR'],
  attack: ['ST', 'ST', 'ST', 'ST'],
}

export function slotId(rowId: Cm0102TacticRowId, colId: Cm0102TacticColId): Cm0102GridSlotId {
  return `${rowId}-${colId}`
}

export function createEmptyCm0102Grid(): Cm0102GridSlot[] {
  const slots: Cm0102GridSlot[] = []
  for (const row of CM0102_TACTIC_ROWS) {
    const roles = DEFAULT_ROLE_BY_ROW_COL[row.id] ?? ['', '', '', '']
    CM0102_TACTIC_COLS.forEach((col, ci) => {
      slots.push({
        id: slotId(row.id, col.id),
        rowId: row.id,
        colId: col.id,
        role: roles[ci] ?? '',
        pitchX: col.pitchX,
        pitchY: row.pitchY,
        active: row.id === 'gk' && col.id === 'lc',
        arrow: 'none',
      })
    })
  }
  return slots
}

/** Map position text to CM Scout WeightsSet column (GK,D,DM,M,AM,A,WB). */
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

function nearestCol(x: number): Cm0102TacticColId {
  let best = CM0102_TACTIC_COLS[0]!
  let bd = Infinity
  for (const c of CM0102_TACTIC_COLS) {
    const d = Math.abs(c.pitchX - x)
    if (d < bd) {
      bd = d
      best = c
    }
  }
  return best.id
}

function nearestRow(y: number): Cm0102TacticRowId {
  let best = CM0102_TACTIC_ROWS[0]!
  let bd = Infinity
  for (const r of CM0102_TACTIC_ROWS) {
    const d = Math.abs(r.pitchY - y)
    if (d < bd) {
      bd = d
      best = r
    }
  }
  return best.id
}

/** Snap pitch slots onto the fixed CM0102 grid (snaps each chip to nearest row/column). */
export function applySlotsToCm0102Grid(
  pitchSlots: Pick<TacticPresetSlot, 'role' | 'x' | 'y' | 'arrow'>[],
  prev: Cm0102GridSlot[],
): Cm0102GridSlot[] {
  const byId = new Map(prev.map((s) => [s.id, { ...s, active: false, arrow: 'none' as TacticArrow }]))
  for (const base of byId.values()) {
    const roles = DEFAULT_ROLE_BY_ROW_COL[base.rowId] ?? ['', '', '', '']
    const ci = CM0102_TACTIC_COLS.findIndex((c) => c.id === base.colId)
    base.role = roles[ci] ?? ''
  }
  for (const ps of pitchSlots) {
    const rowId = nearestRow(ps.y)
    const colId = nearestCol(ps.x)
    const id = slotId(rowId, colId)
    const cell = byId.get(id)
    if (!cell) continue
    cell.active = true
    cell.role = ps.role
    cell.arrow = ps.arrow ?? 'none'
  }
  const gk = byId.get(slotId('gk', 'lc'))
  if (gk) {
    gk.active = true
    gk.role = 'GK'
  }
  return [...byId.values()]
}

/** Apply a community preset onto the fixed CM0102 grid (snaps each chip to nearest row/column). */
export function applyPresetToCm0102Grid(preset: TacticPreset, prev: Cm0102GridSlot[]): Cm0102GridSlot[] {
  return applySlotsToCm0102Grid(preset.slots, prev)
}

export function activeSlots(slots: Cm0102GridSlot[]): Cm0102GridSlot[] {
  return slots.filter((s) => s.active && s.role)
}

export function teamRatingFromAssignments(
  slots: Cm0102GridSlot[],
  assignments: Partial<Record<Cm0102GridSlotId, TacticsPlayerAssignment | null>>,
): number | null {
  const used: number[] = []
  for (const s of slots) {
    if (!s.active || !s.role) continue
    const a = assignments[s.id]
    if (!a) continue
    const pct = a.rolePercent ?? a.cmScoutBp
    if (pct != null && Number.isFinite(pct)) used.push(pct)
  }
  if (used.length === 0) return null
  return Math.round(used.reduce((a, b) => a + b, 0) / used.length)
}
