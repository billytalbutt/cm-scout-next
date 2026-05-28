import { applyCmScoutRatings } from './cmScoutRating'
import { buildUiPlayerRowAtIndex } from './database/parser'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { applyEffectivenessRatings } from './effectivenessRating'
import { applyEngineMetaProfiles } from './engineMetaProfiles'
import type { GridIncludeFlags, GridPlayerRow } from '../shared/gridTypes'
import { filterUiPlayerRows, parseGetRowsFilter, type GetRowsFilter } from './gridRowFilter'
import { mapUiRowToGridPayload } from './gridRowPayload'
import {
  filterStaffGridRows,
  parseStaffBrowseFilter,
  type StaffBrowseFilter,
  type StaffGridRow,
} from './staffBrowse'

export type LoadedShortlistContext = {
  db: ParsedDatabase
  rows: UiPlayerRow[]
}

export function uiPlayerRowsForStaffIndices(
  loaded: LoadedShortlistContext,
  staffIndices: number[],
): UiPlayerRow[] {
  const out: UiPlayerRow[] = []
  const seen = new Set<number>()
  for (const idx of staffIndices) {
    if (!Number.isFinite(idx) || idx < 0 || seen.has(idx)) continue
    seen.add(idx)
    let ui = loaded.rows.find((r) => r.staffIndex === idx)
    if (!ui) {
      const built = buildUiPlayerRowAtIndex(loaded.db, idx)
      if (!built) continue
      applyCmScoutRatings([built])
      applyEffectivenessRatings([built])
      applyEngineMetaProfiles([built])
      ui = built
    }
    out.push(ui)
  }
  return out
}

export function shortlistPlayerGridRows(
  loaded: LoadedShortlistContext,
  staffIndices: number[],
  filterRaw?: Record<string, unknown>,
  inc: GridIncludeFlags = { role7: true },
): GridPlayerRow[] {
  const uiRows = uiPlayerRowsForStaffIndices(loaded, staffIndices)
  let filtered = uiRows
  if (filterRaw && Object.keys(filterRaw).length > 0) {
    const filter = parseGetRowsFilter(filterRaw) as GetRowsFilter
    const gameDateIso = loaded.db.gameDateIso ?? null
    filtered = filterUiPlayerRows(uiRows, filter, { gameDateIso })
  }
  return filtered.map((r) => mapUiRowToGridPayload(r, inc))
}

export function shortlistStaffGridRows(
  db: ParsedDatabase,
  staffIndices: number[],
  filterRaw?: Record<string, unknown>,
): StaffGridRow[] {
  const allowed = new Set(
    staffIndices.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0),
  )
  if (allowed.size === 0) return []
  let filter: StaffBrowseFilter = {
    q: '',
    nation: '',
    club: '',
    includePlayers: false,
  }
  if (filterRaw && Object.keys(filterRaw).length > 0) {
    filter = parseStaffBrowseFilter(filterRaw)
  }
  const all = filterStaffGridRows(db, filter)
  return all.filter((r) => allowed.has(r.staffIndex))
}

export function parseShortlistStaffIndices(payload: unknown): number[] {
  if (Array.isArray(payload)) {
    return payload.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0)
  }
  if (payload && typeof payload === 'object') {
    const raw = payload as Record<string, unknown>
    const arr = raw.staffIndices
    if (Array.isArray(arr)) {
      return arr.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0)
    }
  }
  return []
}

export function parseShortlistFilterRaw(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const raw = payload as Record<string, unknown>
  const filter = raw.filter
  if (filter && typeof filter === 'object' && !Array.isArray(filter)) {
    return filter as Record<string, unknown>
  }
  return undefined
}
