import type { PreferencesEditorValues } from '../../shared/preferencesEditor'
import { PREFERENCES_SLOT_NONE, normalizePreferenceSlotId } from '../../shared/preferencesEditor'

/** `Preferences.dat` row (`TPreferences` in CM0102Patcher Structures.cs). */
export const PREFERENCES_ROW_BYTES = 52

export const FAVOURITE_CLUB_OFFSETS = [4, 8, 12] as const
export const DISLIKED_CLUB_OFFSETS = [16, 20, 24] as const
export const FAVOURITE_STAFF_OFFSETS = [28, 32, 36] as const
export const DISLIKED_STAFF_OFFSETS = [40, 44, 48] as const

/** `staff.dat` → `StaffPreferences` id (`TStaff` offset 0x65). */
export const STAFF_PREFERENCES_ID_OFFSET = 0x65

/** Byte range of preference rows inside a `Preferences.dat` archive block. */
export type PreferencesBlockSpan = {
  dataStart: number
  dataEnd: number
}

/** Many saves use an 8-byte block header before the row array (same pattern as other `.dat` tables). */
export function resolvePreferencesBlockSpan(blockPosition: number, blockSize: number): PreferencesBlockSpan {
  if (blockSize >= 8 && (blockSize - 8) % PREFERENCES_ROW_BYTES === 0) {
    return { dataStart: blockPosition + 8, dataEnd: blockPosition + blockSize }
  }
  return { dataStart: blockPosition, dataEnd: blockPosition + blockSize }
}

function findPreferenceRowsInSpan(
  buf: Buffer,
  span: PreferencesBlockSpan,
  staffPreferencesId: number,
  staffDatId: number,
): number[] {
  const want = new Set(preferenceIdsToClear(staffPreferencesId, staffDatId))
  const out: number[] = []
  if (want.size > 0) {
    for (let off = span.dataStart; off + PREFERENCES_ROW_BYTES <= span.dataEnd; off += PREFERENCES_ROW_BYTES) {
      if (want.has(buf.readInt32LE(off))) out.push(off)
    }
  }
  if (out.length === 0 && staffPreferencesId >= 0) {
    const byIndex = span.dataStart + staffPreferencesId * PREFERENCES_ROW_BYTES
    if (byIndex + PREFERENCES_ROW_BYTES <= span.dataEnd) out.push(byIndex)
  }
  return out
}

/** Clear disliked clubs/staff so CM stops showing future beef with manager/assistant/club. */
export function clearPreferencesDislikesAtRow(buf: Buffer, rowAbs: number): void {
  if (rowAbs < 0 || rowAbs + PREFERENCES_ROW_BYTES > buf.length) return
  for (const off of DISLIKED_CLUB_OFFSETS) buf.writeInt32LE(PREFERENCES_SLOT_NONE, rowAbs + off)
  for (const off of DISLIKED_STAFF_OFFSETS) buf.writeInt32LE(PREFERENCES_SLOT_NONE, rowAbs + off)
}

/** Scan every row whose id field matches (duplicate ids exist on real saves). */
export function clearPreferencesDislikesForId(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  preferencesId: number,
): number {
  if (preferencesId <= 0 || blockSize < PREFERENCES_ROW_BYTES) return 0
  const span = resolvePreferencesBlockSpan(blockPosition, blockSize)
  let cleared = 0
  for (let off = span.dataStart; off + PREFERENCES_ROW_BYTES <= span.dataEnd; off += PREFERENCES_ROW_BYTES) {
    if (buf.readInt32LE(off) !== preferencesId) continue
    clearPreferencesDislikesAtRow(buf, off)
    cleared++
  }
  return cleared
}

/** IDs to try when clearing dislikes — CM often keys rows by `StaffPreferences` or `staff.dat` id. */
export function preferenceIdsToClear(staffPreferencesId: number, staffDatId: number): number[] {
  const ids: number[] = []
  const add = (n: number) => {
    if (n > 0 && !ids.includes(n)) ids.push(n)
  }
  add(staffPreferencesId)
  add(staffDatId)
  return ids
}

/** Clear disliked clubs/staff on every matching preferences row for any candidate id. */
export function clearPreferencesDislikesForStaff(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  staffPreferencesId: number,
  staffDatId: number,
): number {
  const span = resolvePreferencesBlockSpan(blockPosition, blockSize)
  const rows = findPreferenceRowsInSpan(buf, span, staffPreferencesId, staffDatId)
  for (const off of rows) clearPreferencesDislikesAtRow(buf, off)
  return rows.length
}

function readSlotTriple(buf: Buffer, rowAbs: number, offsets: readonly number[]): [number, number, number] {
  return [
    buf.readInt32LE(rowAbs + offsets[0]),
    buf.readInt32LE(rowAbs + offsets[1]),
    buf.readInt32LE(rowAbs + offsets[2]),
  ]
}

function writeSlotTriple(
  buf: Buffer,
  rowAbs: number,
  offsets: readonly number[],
  values: [number, number, number],
): void {
  for (let i = 0; i < 3; i++) {
    buf.writeInt32LE(normalizePreferenceSlotId(values[i]), rowAbs + offsets[i])
  }
}

export function readPreferencesValuesAtRow(buf: Buffer, rowAbs: number): PreferencesEditorValues {
  return {
    favouriteClubs: readSlotTriple(buf, rowAbs, FAVOURITE_CLUB_OFFSETS),
    dislikedClubs: readSlotTriple(buf, rowAbs, DISLIKED_CLUB_OFFSETS),
    favouriteStaff: readSlotTriple(buf, rowAbs, FAVOURITE_STAFF_OFFSETS),
    dislikedStaff: readSlotTriple(buf, rowAbs, DISLIKED_STAFF_OFFSETS),
  }
}

export function writePreferencesValuesAtRow(
  buf: Buffer,
  rowAbs: number,
  values: PreferencesEditorValues,
): void {
  writeSlotTriple(buf, rowAbs, FAVOURITE_CLUB_OFFSETS, values.favouriteClubs)
  writeSlotTriple(buf, rowAbs, DISLIKED_CLUB_OFFSETS, values.dislikedClubs)
  writeSlotTriple(buf, rowAbs, FAVOURITE_STAFF_OFFSETS, values.favouriteStaff)
  writeSlotTriple(buf, rowAbs, DISLIKED_STAFF_OFFSETS, values.dislikedStaff)
}

/** Every 52-byte row keyed by row id, `staff.dat` id, or row index (duplicates possible). */
export function findPreferenceRowAbsOffsets(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  staffPreferencesId: number,
  staffDatId: number,
): number[] {
  if (blockSize < PREFERENCES_ROW_BYTES) return []
  const span = resolvePreferencesBlockSpan(blockPosition, blockSize)
  return findPreferenceRowsInSpan(buf, span, staffPreferencesId, staffDatId)
}

export function readPreferencesValuesForStaff(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  staffPreferencesId: number,
  staffDatId: number,
): { values: PreferencesEditorValues | null; rowCount: number } {
  const rows = findPreferenceRowAbsOffsets(buf, blockPosition, blockSize, staffPreferencesId, staffDatId)
  if (rows.length === 0) return { values: null, rowCount: 0 }
  return { values: readPreferencesValuesAtRow(buf, rows[0]), rowCount: rows.length }
}

export function writePreferencesValuesForStaff(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  staffPreferencesId: number,
  staffDatId: number,
  values: PreferencesEditorValues,
): { ok: true; rowsWritten: number } | { ok: false; error: string } {
  const rows = findPreferenceRowAbsOffsets(buf, blockPosition, blockSize, staffPreferencesId, staffDatId)
  if (rows.length === 0) {
    return { ok: false, error: 'No Preferences.dat row for this player (nothing to update).' }
  }
  for (const off of rows) writePreferencesValuesAtRow(buf, off, values)
  return { ok: true, rowsWritten: rows.length }
}
