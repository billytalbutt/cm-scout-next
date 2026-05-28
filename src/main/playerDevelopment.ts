import { CM_SCOUT_ATTR_LABELS } from '../shared/cmScoutAttrLabels'
import type {
  AttrDevelopmentDelta,
  PlayerDevelopmentSummary,
} from '../shared/playerDevelopmentTypes'
import { developmentDisplayVector48, resolveSnapshotDisplay48 } from './developmentDisplay'
import type { UiPlayerRow } from './database/types'
import type { RegenBaselineEntry, RegenBaselineFile } from './regenBaseline'

/** Lower raw values are better (injury proneness, dirtiness). */
export const ATTR_INVERT_INDICES = new Set([23, 38])

export function compareAttr48(before: number[], after: number[]): AttrDevelopmentDelta[] {
  const deltas: AttrDevelopmentDelta[] = []
  for (let i = 0; i < 48; i++) {
    const b = before[i] ?? 0
    const a = after[i] ?? 0
    if (b === a) continue
    const delta = a - b
    const invert = ATTR_INVERT_INDICES.has(i)
    const improved = invert ? delta < 0 : delta > 0
    deltas.push({
      index: i,
      label: CM_SCOUT_ATTR_LABELS[i] ?? `Attr ${i}`,
      before: b,
      after: a,
      delta,
      improved,
    })
  }
  return deltas
}

export function buildPlayerDevelopmentSummary(
  row: UiPlayerRow,
  entry: RegenBaselineEntry,
  beforeDisplay48: number[],
  currentDisplay48: number[],
): PlayerDevelopmentSummary | null {
  if (beforeDisplay48.length !== 48 || currentDisplay48.length !== 48) return null
  const deltas = compareAttr48(beforeDisplay48, currentDisplay48)
  const attrsUp = deltas.filter((d) => d.improved).length
  const attrsDown = deltas.filter((d) => !d.improved).length
  const netAttrPoints = deltas.reduce(
    (s, d) => s + (d.improved ? Math.abs(d.delta) : -Math.abs(d.delta)),
    0,
  )
  const sortedGains = [...deltas]
    .filter((d) => d.improved)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const sortedLosses = [...deltas]
    .filter((d) => !d.improved)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return {
    staffId: row.staffId,
    staffIndex: row.staffIndex,
    name: row.name,
    club: row.club,
    age: row.age,
    caBefore: entry.ca,
    caAfter: row.ca,
    caDelta: row.ca - entry.ca,
    paBefore: entry.pa,
    paAfter: row.pa,
    paDelta: row.pa - entry.pa,
    attrsUp,
    attrsDown,
    netAttrPoints,
    topGains: sortedGains.slice(0, 5),
    topLosses: sortedLosses.slice(0, 5),
    deltas,
  }
}

export function baselineTracksDevelopment(baseline: RegenBaselineFile | null): boolean {
  if (!baseline) return false
  if (baseline.version >= 2) return true
  const first = Object.values(baseline.entries)[0]
  return !!(first?.attr48 && first.attr48.length === 48)
}

export function buildAllDevelopmentSummaries(
  rows: UiPlayerRow[],
  baseline: RegenBaselineFile,
): PlayerDevelopmentSummary[] {
  if (!baselineTracksDevelopment(baseline)) return []
  const out: PlayerDevelopmentSummary[] = []
  for (const r of rows) {
    if (r.staffIndex < 0) continue
    const entry = baseline.entries[String(r.staff.id)]
    if (!entry?.attr48) continue
    const before = resolveSnapshotDisplay48(entry)
    if (!before) continue
    const current = developmentDisplayVector48(r.player, r.staff)
    const sum = buildPlayerDevelopmentSummary(r, entry, before, current)
    if (sum) out.push(sum)
  }
  return out
}

export type DevelopmentRowsFilter = {
  q?: string
  club?: string
  onlyChanged?: boolean
  sortBy?: 'net' | 'name' | 'ca' | 'gains'
}

export function filterAndSortDevelopmentRows(
  rows: PlayerDevelopmentSummary[],
  filter: DevelopmentRowsFilter,
): PlayerDevelopmentSummary[] {
  let out = rows
  const q = (filter.q ?? '').trim().toLowerCase()
  if (q) out = out.filter((r) => r.name.toLowerCase().includes(q))
  const club = (filter.club ?? '').trim().toLowerCase()
  if (club) out = out.filter((r) => r.club.toLowerCase().includes(club))
  if (filter.onlyChanged) {
    out = out.filter((r) => r.deltas.length > 0 || r.caDelta !== 0 || r.paDelta !== 0)
  }
  const sortBy = filter.sortBy ?? 'net'
  out = [...out].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'ca':
        return b.caDelta - a.caDelta
      case 'gains':
        return b.attrsUp - a.attrsUp || b.netAttrPoints - a.netAttrPoints
      case 'net':
      default:
        return b.netAttrPoints - a.netAttrPoints || b.caDelta - a.caDelta
    }
  })
  return out
}

export function developmentTotals(rows: PlayerDevelopmentSummary[]) {
  let withChanges = 0
  let attrsImproved = 0
  let attrsDeclined = 0
  for (const r of rows) {
    if (r.deltas.length > 0 || r.caDelta !== 0 || r.paDelta !== 0) withChanges++
    attrsImproved += r.attrsUp
    attrsDeclined += r.attrsDown
  }
  return {
    inSnapshot: rows.length,
    withChanges,
    attrsImproved,
    attrsDeclined,
  }
}
