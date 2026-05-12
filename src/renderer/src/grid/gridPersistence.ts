import { GRID_DEFAULT_COLUMN_ORDER, sanitizeGridColumnOrder } from '../../../shared/gridColumnCatalog'

const KEY = 'cm-scout-next-grid-columns-v2'
const MERGE_IF_ABSENT = ['isRegen', 'regenOf'] as const

export function loadGridColumnOrder(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    let base: string[]
    if (!raw) base = [...GRID_DEFAULT_COLUMN_ORDER]
    else {
      const j = JSON.parse(raw) as { order?: unknown }
      const o = sanitizeGridColumnOrder(Array.isArray(j.order) ? (j.order as string[]) : [])
      base = o.length > 0 ? o : [...GRID_DEFAULT_COLUMN_ORDER]
    }
    for (const id of MERGE_IF_ABSENT) {
      if (!base.includes(id)) base.push(id)
    }
    return base
  } catch {
    return [...GRID_DEFAULT_COLUMN_ORDER]
  }
}

export function saveGridColumnOrder(order: string[]) {
  localStorage.setItem(KEY, JSON.stringify({ order: sanitizeGridColumnOrder(order) }))
}
