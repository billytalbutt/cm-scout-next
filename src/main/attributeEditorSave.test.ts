import { describe, expect, it } from 'vitest'
import { buildPatchedArchiveBuffer } from './attributeEditorSave'
import {
  CONTRACT_ISSUE_BLOCK_OFFSET,
  CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
  CONTRACT_SQUAD_MIRROR_OFFSET,
  CONTRACT_UNHAPPINESS_TAIL_OFFSET,
} from './database/contractDiskLayout'
import { PLAYER_DISK_FIELDS, PLAYER_ROW_BYTES, STAFF_ROW_BYTES } from './database/playerStaffDiskLayout'
import type { BlockInfo, ContractRecord, ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'

const PLAYER_BLOCK_POS = 8
const STAFF_BLOCK_POS = PLAYER_BLOCK_POS + PLAYER_ROW_BYTES
const CONTRACT_BLOCK_POS = STAFF_BLOCK_POS + STAFF_ROW_BYTES
const CONTRACT_ROW_POS = CONTRACT_BLOCK_POS + 8

function minimalArchive(): Buffer {
  const size = CONTRACT_ROW_POS + 80
  const buf = Buffer.alloc(size, 0)
  buf.writeInt32LE(1, PLAYER_BLOCK_POS)
  buf.writeUInt8(11, PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.squad_number.offset)
  buf.writeInt8(8, PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.morale.offset)
  buf.writeInt32LE(1, STAFF_BLOCK_POS)
  buf.writeInt32LE(0, STAFF_BLOCK_POS + 0x61)
  buf.writeUInt8(7, STAFF_BLOCK_POS + 0x60)
  buf.writeInt32LE(1, CONTRACT_BLOCK_POS + 4)
  buf.writeInt32LE(0, CONTRACT_ROW_POS)
  buf.writeUInt8(0xff, CONTRACT_ROW_POS + 54)
  buf.writeUInt8(0x11, CONTRACT_ROW_POS + 71)
  buf.writeUInt8(11, CONTRACT_ROW_POS + CONTRACT_SQUAD_MIRROR_OFFSET)
  buf.writeUInt8(11, CONTRACT_ROW_POS + CONTRACT_UNHAPPINESS_TAIL_OFFSET)
  buf.writeUInt8(8, CONTRACT_ROW_POS + 78)
  return buf
}

function fakeDb(): ParsedDatabase {
  const player: PlayerRecord = { id: 1, morale: 8 } as PlayerRecord
  const staff: StaffRecord = {
    id: 1,
    player_id: 0,
    club_valuation: 7,
  } as StaffRecord
  const contract: ContractRecord = {
    staffIndex: 0,
    club_id: 1,
    transfer_status: 8,
  } as ContractRecord
  const blocks: BlockInfo[] = [
    { name: 'player.dat', position: PLAYER_BLOCK_POS, size: PLAYER_ROW_BYTES, compressedSize: PLAYER_ROW_BYTES },
    { name: 'staff.dat', position: STAFF_BLOCK_POS, size: STAFF_ROW_BYTES, compressedSize: STAFF_ROW_BYTES },
    { name: 'contract.dat', position: CONTRACT_BLOCK_POS, size: 88, compressedSize: 88 },
  ]
  return {
    staff: [staff],
    players: [player],
    contractsByStaffIndex: new Map([[0, contract]]),
    blocks,
    compressed: false,
  } as ParsedDatabase
}

describe('buildPatchedArchiveBuffer clearUnhappiness', () => {
  it('sets morale, clears staff club valuation, and clears contract issue block', () => {
    const archive = minimalArchive()
    const db = fakeDb()
    const built = buildPatchedArchiveBuffer(archive, db.blocks, false, db, 0, {}, { clearUnhappiness: true })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.buffer.readInt8(PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.morale.offset)).toBe(20)
    expect(built.buffer.readUInt8(STAFF_BLOCK_POS + 0x60)).toBe(20)
    for (let i = 0; i < CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH; i++) {
      expect(built.buffer.readUInt8(CONTRACT_ROW_POS + CONTRACT_ISSUE_BLOCK_OFFSET + i)).toBe(0)
    }
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + 71)).toBe(0x11)
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + CONTRACT_SQUAD_MIRROR_OFFSET)).toBe(11)
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + CONTRACT_UNHAPPINESS_TAIL_OFFSET)).toBe(11)
    expect(built.buffer.readUInt8(PLAYER_BLOCK_POS + PLAYER_DISK_FIELDS.squad_number.offset)).toBe(11)
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + 78)).toBe(0)
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + 79)).toBe(0)
  })

  it('clearUnhappiness preserves squad status byte 79', () => {
    const archive = minimalArchive()
    archive.writeUInt8(4, CONTRACT_ROW_POS + 79)
    const db = fakeDb()
    const built = buildPatchedArchiveBuffer(archive, db.blocks, false, db, 0, {}, { clearUnhappiness: true })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.buffer.readUInt8(CONTRACT_ROW_POS + 79)).toBe(4)
  })
})
