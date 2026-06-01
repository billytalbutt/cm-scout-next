/** `Preferences.dat` row (`TPreferences` in CM0102Patcher Structures.cs). */
export const PREFERENCES_ROW_BYTES = 52

const DISLIKED_CLUB_OFFSETS = [16, 20, 24] as const
const DISLIKED_STAFF_OFFSETS = [40, 44, 48] as const

/** `staff.dat` → `StaffPreferences` id (`TStaff` offset 0x65). */
export const STAFF_PREFERENCES_ID_OFFSET = 0x65

/** Clear disliked clubs/staff so CM stops showing future beef with manager/assistant/club. */
export function clearPreferencesDislikesAtRow(buf: Buffer, rowAbs: number): void {
  if (rowAbs < 0 || rowAbs + PREFERENCES_ROW_BYTES > buf.length) return
  for (const off of DISLIKED_CLUB_OFFSETS) buf.writeInt32LE(-1, rowAbs + off)
  for (const off of DISLIKED_STAFF_OFFSETS) buf.writeInt32LE(-1, rowAbs + off)
}

/** Scan every `{id}` row in `Preferences.dat` (duplicate ids exist on real saves). */
export function clearPreferencesDislikesForId(
  buf: Buffer,
  blockPosition: number,
  blockSize: number,
  preferencesId: number,
): number {
  if (preferencesId <= 0 || blockSize < PREFERENCES_ROW_BYTES) return 0
  const end = blockPosition + blockSize
  let cleared = 0
  for (let off = blockPosition; off + PREFERENCES_ROW_BYTES <= end; off += PREFERENCES_ROW_BYTES) {
    if (buf.readInt32LE(off) !== preferencesId) continue
    clearPreferencesDislikesAtRow(buf, off)
    cleared++
  }
  return cleared
}
