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
      /** Stored as byte; use unsigned so values above 127 are not shown as negative. */
      apps: slice.readUInt8(15),
      goals: slice.readUInt8(16),
    })
  }
  return out
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
