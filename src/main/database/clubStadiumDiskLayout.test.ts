import { describe, expect, it } from 'vitest'
import { CLUB_ROW_BYTES } from './clubRecords'
import { STADIUM_ROW_BYTES } from './stadiumRecords'
import {
  CLUB_CASH_OFF,
  CLUB_TRAINING_OFF,
  rowIndexForId,
  resolveClubAndStadiumBases,
  writeClubEditorField,
} from './clubStadiumDiskLayout'
import type { BlockInfo } from './types'

describe('clubStadiumDiskLayout', () => {
  it('finds row index by id', () => {
    const buf = Buffer.alloc(CLUB_ROW_BYTES * 3)
    buf.writeInt32LE(10, 0)
    buf.writeInt32LE(20, CLUB_ROW_BYTES)
    buf.writeInt32LE(30, CLUB_ROW_BYTES * 2)
    expect(rowIndexForId(buf, CLUB_ROW_BYTES, 20)).toBe(1)
    expect(rowIndexForId(buf, CLUB_ROW_BYTES, 99)).toBeNull()
  })

  it('patches cash on club row', () => {
    const clubId = 42
    const stadiumId = 7
    const archive = Buffer.alloc(2000)
    const clubBlockPos = 100
    const stadiumBlockPos = 800
    const clubRow = 2
    const stadiumRow = 1
    const clubBase = clubBlockPos + clubRow * CLUB_ROW_BYTES
    const stadiumBase = stadiumBlockPos + stadiumRow * STADIUM_ROW_BYTES

    archive.writeInt32LE(clubId, clubBase)
    archive.writeInt32LE(1_000_000, clubBase + CLUB_CASH_OFF)
    archive.writeInt32LE(stadiumId, clubBase + 105)

    archive.writeInt32LE(stadiumId, stadiumBase)
    archive.writeInt32LE(40_000, stadiumBase + 60)

    const blocks: BlockInfo[] = [
      { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 5, compressed: false },
      { name: 'stadium.dat', position: stadiumBlockPos, size: STADIUM_ROW_BYTES * 5, compressed: false },
    ]

    const resolved = resolveClubAndStadiumBases(archive, blocks, clubId, stadiumId)
    expect('clubBase' in resolved).toBe(true)
    if (!('clubBase' in resolved)) return

    expect(archive.readInt32LE(clubBase + CLUB_CASH_OFF)).toBe(1_000_000)
    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'cash', 100_000_000)
    expect(archive.readInt32LE(clubBase + CLUB_CASH_OFF)).toBe(100_000_000)
  })

  it('writes plain int32 pounds directly (e.g. £11m → £2bn)', () => {
    const clubId = 42
    const stadiumId = 7
    const archive = Buffer.alloc(2000)
    const clubBlockPos = 100
    const stadiumBlockPos = 800
    const clubBase = clubBlockPos + 2 * CLUB_ROW_BYTES
    const stadiumBase = stadiumBlockPos + STADIUM_ROW_BYTES

    archive.writeInt32LE(clubId, clubBase)
    archive.writeInt32LE(11_000_000, clubBase + CLUB_CASH_OFF)
    archive.writeInt32LE(stadiumId, clubBase + 105)
    archive.writeInt32LE(stadiumId, stadiumBase)

    const blocks: BlockInfo[] = [
      { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 5, compressed: false },
      { name: 'stadium.dat', position: stadiumBlockPos, size: STADIUM_ROW_BYTES * 5, compressed: false },
    ]

    const resolved = resolveClubAndStadiumBases(archive, blocks, clubId, stadiumId)
    if (!('clubBase' in resolved)) throw new Error('resolve failed')

    expect(archive.readInt32LE(clubBase + CLUB_CASH_OFF)).toBe(11_000_000)
    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'cash', 2_000_000_000)
    const raw = archive.readInt32LE(clubBase + CLUB_CASH_OFF)
    expect(raw).toBe(2_000_000_000)

    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'stadium_capacity', 55_000)
    expect(archive.readInt32LE(stadiumBase + 60)).toBe(55_000)
  })

  it('writes training facilities as full u8 (not bool 0/1)', () => {
    const clubId = 5
    const stadiumId = 2
    const archive = Buffer.alloc(2000)
    const clubBlockPos = 50
    const stadiumBlockPos = 900
    const clubBase = clubBlockPos + CLUB_ROW_BYTES
    const stadiumBase = stadiumBlockPos

    archive.writeInt32LE(clubId, clubBase)
    archive.writeUInt8(8, clubBase + CLUB_TRAINING_OFF)
    archive.writeInt32LE(stadiumId, clubBase + 105)
    archive.writeInt32LE(stadiumId, stadiumBase)

    const blocks: BlockInfo[] = [
      { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 3, compressed: false },
      { name: 'stadium.dat', position: stadiumBlockPos, size: STADIUM_ROW_BYTES * 2, compressed: false },
    ]

    const resolved = resolveClubAndStadiumBases(archive, blocks, clubId, stadiumId)
    expect('clubBase' in resolved).toBe(true)
    if (!('clubBase' in resolved)) return

    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'training', 20)
    expect(archive.readUInt8(clubBase + CLUB_TRAINING_OFF)).toBe(20)

    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'stadium_under_soil_heating', 1)
    expect(archive.readUInt8(stadiumBase + 77)).toBe(1)
    writeClubEditorField(archive, resolved.clubBase, resolved.stadiumBase, 'stadium_under_soil_heating', 0)
    expect(archive.readUInt8(stadiumBase + 77)).toBe(0)
  })
})
