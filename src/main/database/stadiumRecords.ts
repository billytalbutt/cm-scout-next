/**
 * `stadium.dat` rows — `TStadiums` in CM0102Patcher SaveChanger/Structures.cs (78 bytes, Pack=1).
 */
import { readLatin1String } from './cmBinaryReader'
import type { StadiumRecord } from './types'

export const STADIUM_ROW_BYTES = 78

export function parseStadiumRecords(data: Buffer): Map<number, StadiumRecord> {
  const m = new Map<number, StadiumRecord>()
  const n = Math.floor(data.length / STADIUM_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const off = i * STADIUM_ROW_BYTES
    const row = data.subarray(off, off + STADIUM_ROW_BYTES)
    if (row.length < STADIUM_ROW_BYTES) continue
    const id = row.readInt32LE(0)
    const name = readLatin1String(row.subarray(4, 55), 51)
    const cityId = row.readInt32LE(56)
    const capacity = row.readInt32LE(60)
    const seatingCapacity = row.readInt32LE(64)
    const expansionCapacity = row.readInt32LE(68)
    const nearbyStadiumId = row.readInt32LE(72)
    const covered = row.readUInt8(76)
    const underSoilHeating = row.readUInt8(77)
    m.set(id, {
      id,
      name,
      cityId,
      capacity,
      seatingCapacity,
      expansionCapacity,
      nearbyStadiumId,
      covered,
      underSoilHeating,
    })
  }
  return m
}
