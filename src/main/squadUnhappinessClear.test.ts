import { describe, expect, it } from 'vitest'
import {
  applyClearUnhappinessForClubSquad,
  applyClearUnhappinessForStaff,
  clubSquadPlayerStaffIndices,
} from './squadUnhappinessClear'
import { buildClubSquadPlayerRows } from './clubBrowse'
import { CONTRACT_ISSUE_BLOCK_OFFSET, CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH } from './database/contractDiskLayout'
import { PLAYER_DISK_FIELDS, PLAYER_ROW_BYTES, STAFF_ROW_BYTES } from './database/playerStaffDiskLayout'
import { PREFERENCES_ROW_BYTES } from './database/staffPreferencesDiskLayout'
import type { BlockInfo, ContractRecord, ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'

const PLAYER_BLOCK_POS = 100
const STAFF_BLOCK_POS = PLAYER_BLOCK_POS + PLAYER_ROW_BYTES * 3
const CONTRACT_BLOCK_POS = STAFF_BLOCK_POS + STAFF_ROW_BYTES * 2
const CONTRACT_ROW_POS = CONTRACT_BLOCK_POS + 8
const PREF_BLOCK_POS = CONTRACT_ROW_POS + 80

function buildArchive(): Buffer {
  const size = CONTRACT_ROW_POS + 80
  const buf = Buffer.alloc(size, 0)
  for (let i = 0; i < 3; i++) {
    const base = PLAYER_BLOCK_POS + i * PLAYER_ROW_BYTES
    buf.writeInt32LE(i + 1, base)
    buf.writeInt8(5, base + PLAYER_DISK_FIELDS.morale.offset)
  }
  buf.writeInt32LE(2, STAFF_BLOCK_POS)
  for (let i = 0; i < 2; i++) {
    const staffBase = STAFF_BLOCK_POS + i * STAFF_ROW_BYTES
    buf.writeInt32LE(i + 1, staffBase)
    buf.writeInt32LE(i, staffBase + 0x61)
    buf.writeUInt8(6, staffBase + 0x60)
    if (i === 1) buf.writeInt32LE(2, staffBase + 0x65)
  }
  buf.writeInt32LE(1, CONTRACT_BLOCK_POS + 4)
  buf.writeInt32LE(1, CONTRACT_ROW_POS)
  buf.writeUInt8(0xff, CONTRACT_ROW_POS + CONTRACT_ISSUE_BLOCK_OFFSET)
  buf.writeUInt16LE(0xbeef, CONTRACT_ROW_POS + 70)
  const pref = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
  pref.writeInt32LE(2, 0)
  pref.writeInt32LE(500, 40)
  return Buffer.concat([buf, pref])
}

function fakeDb(): ParsedDatabase {
  const players: PlayerRecord[] = [
    { id: 1, morale: 5 } as PlayerRecord,
    { id: 2, morale: 5 } as PlayerRecord,
    { id: 3, morale: 5 } as PlayerRecord,
  ]
  const staff: StaffRecord[] = [
    { id: 1, player_id: 0, club_valuation: 6, staff_preferences_id: 0 } as StaffRecord,
    { id: 2, player_id: 2, club_valuation: 6, staff_preferences_id: 2 } as StaffRecord,
  ]
  const contract: ContractRecord = {
    staffIndex: 1,
    club_id: 10,
    transfer_status: 0,
  } as ContractRecord
  const blocks: BlockInfo[] = [
    {
      name: 'player.dat',
      position: PLAYER_BLOCK_POS,
      size: PLAYER_ROW_BYTES * 3,
      compressedSize: PLAYER_ROW_BYTES * 3,
    },
    {
      name: 'staff.dat',
      position: STAFF_BLOCK_POS,
      size: STAFF_ROW_BYTES * 2,
      compressedSize: STAFF_ROW_BYTES * 2,
    },
    {
      name: 'contract.dat',
      position: CONTRACT_BLOCK_POS,
      size: 88,
      compressedSize: 88,
    },
    {
      name: 'Preferences.dat',
      position: PREF_BLOCK_POS,
      size: PREFERENCES_ROW_BYTES,
      compressedSize: PREFERENCES_ROW_BYTES,
    },
  ]
  return {
    staff,
    players,
    contractsByStaffIndex: new Map([[1, contract]]),
    blocks,
    compressed: false,
  } as ParsedDatabase
}

describe('applyClearUnhappinessForStaff', () => {
  it('writes morale on the linked player row (70-byte stride, not 80)', () => {
    const buf = buildArchive()
    const db = fakeDb()
    const r = applyClearUnhappinessForStaff(buf, db.blocks, db, 1)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const player0Morale = buf.readInt8(PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.morale.offset)
    const player2Morale = buf.readInt8(
      PLAYER_BLOCK_POS + 2 * PLAYER_ROW_BYTES + PLAYER_DISK_FIELDS.morale.offset,
    )
    expect(player0Morale).toBe(5)
    expect(player2Morale).toBe(20)

    const staffBase = STAFF_BLOCK_POS + STAFF_ROW_BYTES
    expect(buf.readUInt8(staffBase + 0x60)).toBe(20)

    for (let i = 0; i < CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH; i++) {
      expect(buf.readUInt8(CONTRACT_ROW_POS + CONTRACT_ISSUE_BLOCK_OFFSET + i)).toBe(0)
    }
    expect(buf.readInt32LE(PREF_BLOCK_POS + 40)).toBe(-1)
  })
})

describe('clubSquadPlayerStaffIndices', () => {
  it('includes employed players missing from the UI squad list (no resolved name)', () => {
    const playerStaff = {
      id: 50,
      first_name_id: 0,
      second_name_id: 0,
      common_name_id: 0,
      player_id: 0,
      club_job_id: 100,
    } as StaffRecord
    const db = {
      staff: [playerStaff],
      players: [{ id: 1 } as PlayerRecord],
      firstNames: [''],
      secondNames: [''],
      commonNames: [''],
      clubNames: new Map([[100, 'Test FC']]),
      contractsByStaffIndex: new Map(),
      clubsById: new Map([
        [
          100,
          {
            id: 100,
            name: 'Test FC',
            squadStaffIds: [],
            teamSelectedStaffIds: [],
          },
        ],
      ]),
    } as unknown as ParsedDatabase

    expect(buildClubSquadPlayerRows(db, 100)).toHaveLength(0)
    expect(clubSquadPlayerStaffIndices(db, 100)).toEqual([0])
  })

  it('includes players listed in club.dat squad slots even when employment fields disagree', () => {
    const playerStaff = {
      id: 77,
      first_name_id: 1,
      second_name_id: 1,
      common_name_id: 0,
      player_id: 0,
      club_job_id: 999,
    } as StaffRecord
    const db = {
      staff: [playerStaff],
      players: [{ id: 1 } as PlayerRecord],
      firstNames: ['', 'John'],
      secondNames: ['', 'Smith'],
      commonNames: [''],
      clubNames: new Map([[100, 'Test FC']]),
      contractsByStaffIndex: new Map(),
      clubsById: new Map([
        [
          100,
          {
            id: 100,
            name: 'Test FC',
            squadStaffIds: [77, -1],
            teamSelectedStaffIds: [],
          },
        ],
      ]),
    } as unknown as ParsedDatabase

    expect(buildClubSquadPlayerRows(db, 100)).toHaveLength(0)
    expect(clubSquadPlayerStaffIndices(db, 100)).toEqual([0])
  })
})

describe('applyClearUnhappinessForClubSquad', () => {
  it('clears employed players even when they are absent from the UI squad list', () => {
    const buf = buildArchive()
    const db = fakeDb()
    db.staff[0] = {
      id: 1,
      first_name_id: 0,
      second_name_id: 0,
      common_name_id: 0,
      player_id: 0,
      club_valuation: 6,
      club_job_id: 10,
    } as StaffRecord
    db.clubsById = new Map([
      [
        10,
        {
          id: 10,
          squadStaffIds: [],
          teamSelectedStaffIds: [],
        },
      ],
    ])

    expect(buildClubSquadPlayerRows(db, 10)).toHaveLength(0)
    const r = applyClearUnhappinessForClubSquad(buf, db.blocks, db, 10)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cleared).toBe(1)

    expect(buf.readInt8(PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.morale.offset)).toBe(20)
    expect(buf.readUInt8(STAFF_BLOCK_POS + 0x60)).toBe(20)
  })
})
