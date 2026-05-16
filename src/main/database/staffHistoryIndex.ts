/**
 * Fast path: index `staff_history.dat` in one pass (avoids a 200k+ intermediate array).
 */
import { normalizeStaffHistoryBuffer, STAFF_HISTORY_ROW_BYTES, type StaffHistoryRecord } from './staffHistory'

export function indexStaffHistoryBuffer(raw: Buffer): Map<number, StaffHistoryRecord[]> {
  const body = normalizeStaffHistoryBuffer(raw)
  const m = new Map<number, StaffHistoryRecord[]>()
  if (!body.length || body.length % STAFF_HISTORY_ROW_BYTES !== 0) return m

  const n = body.length / STAFF_HISTORY_ROW_BYTES
  for (let i = 0; i < n; i++) {
    const o = i * STAFF_HISTORY_ROW_BYTES
    const staffId = body.readInt32LE(o + 4)
    if (staffId <= 0) continue
    const year = body.readInt16LE(o + 8)
    if (year < 1950 || year > 2035) continue
    const clubId = body.readInt32LE(o + 10)
    if (clubId < -1 || clubId > 500_000) continue
    const apps = Math.max(0, body.readInt8(o + 15))
    const goals = Math.max(0, body.readInt8(o + 16))
    if (apps > 80 || goals > 80) continue

    const rec: StaffHistoryRecord = {
      id: body.readInt32LE(o),
      staffId,
      year,
      clubId,
      onLoan: body.readInt8(o + 14),
      apps,
      goals,
    }
    const list = m.get(staffId)
    if (list) list.push(rec)
    else m.set(staffId, [rec])
  }
  return m
}
