import { describe, expect, it } from 'vitest'
import {
  PREFERENCES_ROW_BYTES,
  clearPreferencesDislikesForId,
  clearPreferencesDislikesForStaff,
  resolvePreferencesBlockSpan,
} from './staffPreferencesDiskLayout'

describe('clearPreferencesDislikesForId', () => {
  it('clears disliked club/staff ints on every matching row', () => {
    const blockPos = 0
    const row0 = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
    row0.writeInt32LE(42, 0)
    row0.writeInt32LE(999, 16)
    row0.writeInt32LE(888, 40)
    const row1 = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
    row1.writeInt32LE(42, 0)
    row1.writeInt32LE(777, 24)
    row1.writeInt32LE(666, 48)
    const buf = Buffer.concat([row0, row1])
    const n = clearPreferencesDislikesForId(buf, blockPos, buf.length, 42)
    expect(n).toBe(2)
    expect(buf.readInt32LE(16)).toBe(-1)
    expect(buf.readInt32LE(40)).toBe(-1)
    expect(buf.readInt32LE(24 + PREFERENCES_ROW_BYTES)).toBe(-1)
    expect(buf.readInt32LE(48 + PREFERENCES_ROW_BYTES)).toBe(-1)
  })

  it('resolvePreferencesBlockSpan skips 8-byte header when present', () => {
    const row = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
    row.writeInt32LE(42, 0)
    const buf = Buffer.concat([Buffer.alloc(8), row])
    const span = resolvePreferencesBlockSpan(0, buf.length)
    expect(span.dataStart).toBe(8)
    expect(buf.readInt32LE(span.dataStart)).toBe(42)
  })

  it('clearPreferencesDislikesForStaff falls back to staff.dat id when StaffPreferences link is 0', () => {
    const row = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
    row.writeInt32LE(6408, 0)
    row.writeInt32LE(111, 40)
    const buf = Buffer.concat([row])
    const n = clearPreferencesDislikesForStaff(buf, 0, buf.length, 0, 6408)
    expect(n).toBe(1)
    expect(buf.readInt32LE(40)).toBe(-1)
  })
})
