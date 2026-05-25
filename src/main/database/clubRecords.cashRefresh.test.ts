import { describe, expect, it } from 'vitest'
import { CLUB_ROW_BYTES, refreshClubCashFromArchive } from './clubRecords'
import type { ClubRecord } from './types'

function uncompressedArchiveWithClub(rows: Buffer[]): Buffer {
  const clubDat = Buffer.concat(rows)
  const clubBlockPos = 512
  const buf = Buffer.alloc(clubBlockPos + clubDat.length + 64)
  let o = 0
  buf.writeUInt32LE(0, o)
  o += 4
  buf.writeUInt32LE(0, o)
  o += 4
  buf.writeUInt32LE(1, o)
  o += 4
  buf.writeInt32LE(clubBlockPos, o)
  o += 4
  buf.writeInt32LE(clubDat.length, o)
  o += 4
  buf.write('club.dat', o, 'ascii')
  o += 260
  clubDat.copy(buf, clubBlockPos)
  return buf
}

function clubRow(id: number, cash: number): Buffer {
  const row = Buffer.alloc(CLUB_ROW_BYTES)
  row.writeInt32LE(id, 0)
  row.writeInt32LE(cash, 101)
  return row
}

describe('refreshClubCashFromArchive', () => {
  it('updates clubsById cash from club.dat in the archive buffer', () => {
    const archive = uncompressedArchiveWithClub([clubRow(1, 5_000_000), clubRow(2, 34_283_711)])
    const clubs = new Map<number, ClubRecord>([
      [
        1,
        {
          id: 1,
          name: 'A',
          nationId: 0,
          divisionCompId: 0,
          cash: 1,
          stadiumId: 0,
          attendance: 0,
          training: 0,
          reputation: 0,
          squadStaffIds: [],
          teamSelectedStaffIds: [],
          tacticTrainingIds: [],
          tacticSelectedId: 0,
        },
      ],
      [
        2,
        {
          id: 2,
          name: 'B',
          nationId: 0,
          divisionCompId: 0,
          cash: 1,
          stadiumId: 0,
          attendance: 0,
          training: 0,
          reputation: 0,
          squadStaffIds: [],
          teamSelectedStaffIds: [],
          tacticTrainingIds: [],
          tacticSelectedId: 0,
        },
      ],
    ])

    refreshClubCashFromArchive(archive, clubs)
    expect(clubs.get(1)?.cash).toBe(5_000_000)
    expect(clubs.get(2)?.cash).toBe(34_283_711)
  })
})
