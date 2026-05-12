import { readLatin1String } from './cmBinaryReader'

/** `club_comp.dat` row (`TComp` in agevak CM0102 Structures.cs), pack 1. */
export const CLUB_COMP_ROW_BYTES = 107

export interface ClubCompRecord {
  id: number
  name: string
  shortName: string
  threeLetter: string
  nationId: number
  reputation: number
}

/** `staff_comp.dat` row (`TStaffComp`) — international / staff competition definitions. */
export const STAFF_COMP_ROW_BYTES = 101

export interface StaffCompRecord {
  id: number
  name: string
  shortName: string
  nationId: number
  reputation: number
}

export function parseClubCompData(data: Buffer): Map<number, ClubCompRecord> {
  const m = new Map<number, ClubCompRecord>()
  if (!data.length || data.length % CLUB_COMP_ROW_BYTES !== 0) return m
  const n = Math.floor(data.length / CLUB_COMP_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const o = i * CLUB_COMP_ROW_BYTES
    const row = data.subarray(o, o + CLUB_COMP_ROW_BYTES)
    const id = row.readInt32LE(0)
    const name = readLatin1String(row.subarray(4, 55), 51).trim()
    const shortName = readLatin1String(row.subarray(56, 82), 26).trim()
    const threeLetter = readLatin1String(row.subarray(83, 87), 4).trim()
    const nationId = row.readInt32LE(93)
    const reputation = row.readInt16LE(105)
    m.set(id, { id, name, shortName, threeLetter, nationId, reputation })
  }
  return m
}

export function parseStaffCompData(data: Buffer): Map<number, StaffCompRecord> {
  const m = new Map<number, StaffCompRecord>()
  if (!data.length || data.length % STAFF_COMP_ROW_BYTES !== 0) return m
  const n = Math.floor(data.length / STAFF_COMP_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const o = i * STAFF_COMP_ROW_BYTES
    const row = data.subarray(o, o + STAFF_COMP_ROW_BYTES)
    const id = row.readInt32LE(0)
    const name = readLatin1String(row.subarray(4, 55), 51).trim()
    const shortName = readLatin1String(row.subarray(56, 82), 26).trim()
    const nationId = row.readInt32LE(87)
    const reputation = row.readInt16LE(99)
    m.set(id, { id, name, shortName, nationId, reputation })
  }
  return m
}

/** `club.dat`: primary domestic league / division pointer (`TClub.Division` @ byte 0x57). */
const CLUB_DIVISION_COMP_ID_OFF = 0x57

export function parseClubPrimaryDivisionIds(data: Buffer): Map<number, number> {
  const ROW = 581
  const m = new Map<number, number>()
  if (!data.length) return m
  const n = Math.floor(data.length / ROW)
  for (let i = 0; i < n; i++) {
    const row = data.subarray(i * ROW, (i + 1) * ROW)
    if (row.length < CLUB_DIVISION_COMP_ID_OFF + 4) continue
    const clubId = row.readInt32LE(0)
    const compId = row.readInt32LE(CLUB_DIVISION_COMP_ID_OFF)
    m.set(clubId, compId)
  }
  return m
}
