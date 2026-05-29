import { GRID_DEFAULT_COLUMN_ORDER, sanitizeGridColumnOrder } from '../../../shared/gridColumnCatalog'
import { MERLIN_LS } from '../../../shared/merlinStorageKeys'

const KEY = MERLIN_LS.gridColumns
const MERGE_IF_ABSENT = ['isRegen', 'regenOf'] as const

function ensureEffRatingAfterRating(order: string[]): void {
  if (order.includes('effRating')) return
  const ri = order.indexOf('rating')
  if (ri >= 0) order.splice(ri + 1, 0, 'effRating')
  else order.push('effRating')
}

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
    ensureEffRatingAfterRating(base)
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
