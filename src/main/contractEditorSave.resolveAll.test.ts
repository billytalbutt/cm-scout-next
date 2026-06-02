import { describe, expect, it } from 'vitest'
import { contractRowKeysForStaff, resolveAllContractRowAbsOffsets } from './contractEditorSave'
import type { BlockInfo, ContractRecord, ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'

describe('resolveAllContractRowAbsOffsets', () => {
  it('finds rows keyed by staff.dat id, staff index, and player.dat id', () => {
    const header = Buffer.alloc(8)
    header.writeInt32LE(0, 0)
    header.writeInt32LE(2, 4)
    const rowByPlayerId = Buffer.alloc(80, 0)
    rowByPlayerId.writeInt32LE(9001, 0)
    rowByPlayerId.writeUInt8(0xff, 54)
    const rowByStaffId = Buffer.alloc(80, 0)
    rowByStaffId.writeInt32LE(6408, 0)
    const archive = Buffer.concat([header, rowByPlayerId, rowByStaffId])
    const blocks: BlockInfo[] = [
      { name: 'contract.dat', position: 0, size: 168, compressedSize: 168 },
    ]
    const staff: StaffRecord[] = [
      { id: 6408, player_id: 5 } as StaffRecord,
    ]
    const players: PlayerRecord[] = Array.from({ length: 6 }, (_, i) => ({ id: i === 5 ? 9001 : i + 1 }) as PlayerRecord)
    const db = {
      staff,
      players,
      contractsByStaffIndex: new Map<number, ContractRecord>([
        [
          0,
          {
            staffIndex: 0,
            rowAbsOffset: 8,
          } as ContractRecord,
        ],
      ]),
    } as ParsedDatabase

    const keys = contractRowKeysForStaff(db, 0)
    expect(keys.has(6408)).toBe(true)
    expect(keys.has(9001)).toBe(true)
    expect(keys.has(5)).toBe(true)

    const offsets = resolveAllContractRowAbsOffsets(archive, blocks, db, 0)
    expect(offsets.sort((a, b) => a - b)).toEqual([8, 88])
  })
})
