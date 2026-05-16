/**
 * `staff_history.dat` — one row per staff member per club per season-year.
 * Layout matches community tools (e.g. CM0102Patcher `TStaffHistory`, agevak/CM0102 `TStaffHistory`): 17 bytes, pack 1.
 * This is **not** split by competition (Premier League vs FA Cup); the game may aggregate league+cups per club-year here.
 * Assists and average match rating are **not** present in this structure (separate blocks / runtime — future work).
 */

export interface StaffHistoryRecord {
  id: number
  /** Join key to `staff.dat` row `id` (not staff array index). */
  staffId: number
  year: number
  clubId: number
  onLoan: number
  apps: number
  goals: number
}

export const STAFF_HISTORY_ROW_BYTES = 17

/**
 * Some index builds prefix `staff_history.dat` with 4 bytes so `(size - 4) % 17 === 0` while `size % 17 !== 0`.
 * CM0102Patcher `TStaffHistory` rows are always 17 bytes (pack 1).
 */
export function normalizeStaffHistoryBuffer(buf: Buffer): Buffer {
  if (!buf.length) return buf
  if (buf.length % STAFF_HISTORY_ROW_BYTES === 0) return buf
  if (buf.length >= 4 && (buf.length - 4) % STAFF_HISTORY_ROW_BYTES === 0) return buf.subarray(4)
  return buf
}

export function parseStaffHistoryData(data: Buffer): StaffHistoryRecord[] {
  const body = normalizeStaffHistoryBuffer(data)
  if (!body.length || body.length % STAFF_HISTORY_ROW_BYTES !== 0) return []
  const n = body.length / STAFF_HISTORY_ROW_BYTES
  const out: StaffHistoryRecord[] = []
  for (let i = 0; i < n; i++) {
    const o = i * STAFF_HISTORY_ROW_BYTES
    const slice = body.subarray(o, o + STAFF_HISTORY_ROW_BYTES)
    if (slice.length < STAFF_HISTORY_ROW_BYTES) break
    out.push({
      id: slice.readInt32LE(0),
      staffId: slice.readInt32LE(4),
      year: slice.readInt16LE(8),
      clubId: slice.readInt32LE(10),
      onLoan: slice.readInt8(14),
      /** TStaffHistory uses signed bytes; clamp so negative bytes do not display as huge unsigned values. */
      apps: Math.max(0, slice.readInt8(15)),
      goals: Math.max(0, slice.readInt8(16)),
    })
  }
  return out
}

/** Drop obvious mis-aligned rows when a block is not a clean TStaffHistory array (e.g. misread `.tmp` heap). */
export function isPlausibleStaffHistoryRow(r: StaffHistoryRecord, maxStaffId: number): boolean {
  if (r.staffId <= 0 || r.staffId > maxStaffId) return false
  if (r.year < 1950 || r.year > 2035) return false
  if (r.clubId < -1 || r.clubId > 500_000) return false
  if (r.apps < 0 || r.apps > 80) return false
  if (r.goals < 0 || r.goals > 80) return false
  return true
}

export function filterPlausibleStaffHistoryRows(
  rows: StaffHistoryRecord[],
  maxStaffId: number,
): StaffHistoryRecord[] {
  return rows.filter((r) => isPlausibleStaffHistoryRow(r, maxStaffId))
}

export function mergeStaffHistoryByStaffId(
  base: Map<number, StaffHistoryRecord[]> | undefined,
  extra: Map<number, StaffHistoryRecord[]>,
): Map<number, StaffHistoryRecord[]> {
  if (!base) return extra
  for (const [staffId, rows] of extra) {
    const list = base.get(staffId)
    if (list) list.push(...rows)
    else base.set(staffId, [...rows])
  }
  return base
}

/**
 * Parse a staff-history block. When the buffer is mostly garbage (mis-sized `.tmp`), keep only plausible rows.
 */
export function parseStaffHistoryBlock(raw: Buffer, maxStaffId: number): StaffHistoryRecord[] {
  const rows = parseStaffHistoryData(raw)
  if (!rows.length) return []
  const plausible = filterPlausibleStaffHistoryRows(rows, maxStaffId)
  if (rows.length > Math.max(maxStaffId * 30, 50_000) && plausible.length < rows.length * 0.02) {
    return plausible
  }
  return rows
}

export function indexStaffHistoryByStaffId(rows: StaffHistoryRecord[]): Map<number, StaffHistoryRecord[]> {
  const m = new Map<number, StaffHistoryRecord[]>()
  for (const r of rows) {
    const list = m.get(r.staffId)
    if (list) list.push(r)
    else m.set(r.staffId, [r])
  }
  return m
}

export function sumStaffHistoryCareerAndSeason(
  hist: readonly StaffHistoryRecord[] | undefined,
  highlightYear: number | null,
): { careerApps: number; careerGoals: number; seasonApps: number; seasonGoals: number } {
  let careerApps = 0
  let careerGoals = 0
  let seasonApps = 0
  let seasonGoals = 0
  if (!hist?.length) return { careerApps, careerGoals, seasonApps, seasonGoals }
  for (const h of hist) {
    careerApps += h.apps
    careerGoals += h.goals
    if (highlightYear != null && h.year === highlightYear) {
      seasonApps += h.apps
      seasonGoals += h.goals
    }
  }
  return { careerApps, careerGoals, seasonApps, seasonGoals }
}
