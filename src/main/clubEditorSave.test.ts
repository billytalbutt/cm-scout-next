import { describe, expect, it } from 'vitest'
import { CLUB_ROW_BYTES } from './database/clubRecords'
import { STADIUM_ROW_BYTES } from './database/stadiumRecords'
import { CLUB_CASH_OFF, CLUB_TRAINING_OFF } from './database/clubStadiumDiskLayout'
import type { BlockInfo } from './database/types'
import { buildPatchedArchiveForClubEdits } from './clubEditorSave'

describe('buildPatchedArchiveForClubEdits', () => {
  it('applies a second save on top of the first patched buffer (not the original)', () => {
    const clubId = 42
    const stadiumId = 7
    const archive = Buffer.alloc(4000)
    const clubBlockPos = 100
    const stadiumBlockPos = 1200
    const clubRow = 0
    const stadiumRow = 0
    const clubBase = clubBlockPos + clubRow * CLUB_ROW_BYTES
    const stadiumBase = stadiumBlockPos + stadiumRow * STADIUM_ROW_BYTES

    archive.writeInt32LE(clubId, clubBase)
    archive.writeInt32LE(5_000_000, clubBase + CLUB_CASH_OFF)
    archive.writeInt32LE(stadiumId, clubBase + 105)
    archive.writeInt32LE(stadiumId, stadiumBase)
    archive.writeInt32LE(40_000, stadiumBase + 60)

    const blocks: BlockInfo[] = [
      { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 2, compressed: false },
      { name: 'stadium.dat', position: stadiumBlockPos, size: STADIUM_ROW_BYTES * 2, compressed: false },
    ]

    const db = {
      compressed: false,
      blocks,
      clubsById: new Map([
        [
          clubId,
          {
            id: clubId,
            name: 'Test FC',
            nationId: 1,
            divisionCompId: 1,
            cash: 5_000_000,
            stadiumId,
            attendance: 10_000,
            training: 10,
            reputation: 5000,
            squadStaffIds: [],
            teamSelectedStaffIds: [],
            tacticTrainingIds: [],
            tacticSelectedId: 0,
          },
        ],
      ]),
      stadiumsById: new Map([
        [
          stadiumId,
          {
            id: stadiumId,
            name: 'Test Stadium',
            cityId: 1,
            capacity: 40_000,
            seatingCapacity: 30_000,
            expansionCapacity: 0,
            nearbyStadiumId: 0,
            covered: 0,
            underSoilHeating: 0,
          },
        ],
      ]),
    } as import('./database/types').ParsedDatabase

    const first = buildPatchedArchiveForClubEdits(archive, blocks, false, db, clubId, {
      stadium_capacity: 80_000,
      cash: 100_000_000,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = buildPatchedArchiveForClubEdits(first.buffer, blocks, false, db, clubId, {
      stadium_capacity: 88_000,
      cash: 2_000_000_000,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(second.buffer.readInt32LE(stadiumBase + 60)).toBe(88_000)
    expect(second.buffer.readInt32LE(clubBase + CLUB_CASH_OFF)).toBe(2_000_000_000)
  })

  it('persists training facilities 1–20 on club row', () => {
    const clubId = 42
    const stadiumId = 7
    const archive = Buffer.alloc(4000)
    const clubBlockPos = 100
    const stadiumBlockPos = 1200
    const clubBase = clubBlockPos
    const stadiumBase = stadiumBlockPos

    archive.writeInt32LE(clubId, clubBase)
    archive.writeInt32LE(stadiumId, clubBase + 105)
    archive.writeInt32LE(stadiumId, stadiumBase)

    const blocks: BlockInfo[] = [
      { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 2, compressed: false },
      { name: 'stadium.dat', position: stadiumBlockPos, size: STADIUM_ROW_BYTES * 2, compressed: false },
    ]

    const db = {
      compressed: false,
      blocks,
      clubsById: new Map([
        [
          clubId,
          {
            id: clubId,
            name: 'Test FC',
            nationId: 1,
            divisionCompId: 1,
            cash: 0,
            stadiumId,
            attendance: 0,
            training: 10,
            reputation: 5000,
            squadStaffIds: [],
            teamSelectedStaffIds: [],
            tacticTrainingIds: [],
            tacticSelectedId: 0,
          },
        ],
      ]),
      stadiumsById: new Map([
        [
          stadiumId,
          {
            id: stadiumId,
            name: 'Test Stadium',
            cityId: 1,
            capacity: 40_000,
            seatingCapacity: 30_000,
            expansionCapacity: 0,
            nearbyStadiumId: 0,
            covered: 0,
            underSoilHeating: 0,
          },
        ],
      ]),
    } as import('./database/types').ParsedDatabase

    const patched = buildPatchedArchiveForClubEdits(archive, blocks, false, db, clubId, {
      training: 20,
      cash: 25_000_000,
    })
    expect(patched.ok).toBe(true)
    if (!patched.ok) return
    expect(patched.buffer.readUInt8(clubBase + CLUB_TRAINING_OFF)).toBe(20)
    expect(patched.buffer.readInt32LE(clubBase + CLUB_CASH_OFF)).toBe(25_000_000)
  })
})
