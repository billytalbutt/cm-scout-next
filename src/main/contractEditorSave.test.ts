import { describe, expect, it } from 'vitest'
import { tcmDateToIso } from './database/dates'
import {
  CONTRACT_DATE_EXPIRES_OFFSET,
  CONTRACT_DATE_STARTED_OFFSET,
} from './database/contractDiskLayout'
import {
  buildContractEditorPatchedBuffer,
  clearContractUnhappinessAtRow,
  resolveContractRowAbsOffset,
} from './contractEditorSave'
import {
  CONTRACT_ISSUE_BLOCK_OFFSET,
  CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
} from './database/contractDiskLayout'
import type { BlockInfo, ContractRecord, ParsedDatabase, StaffRecord } from './database/types'

function minimalContractArchive(staffIndex: number, wage: number): Buffer {
  const header = Buffer.alloc(8)
  header.writeInt32LE(0, 0)
  header.writeInt32LE(1, 4)
  const row = Buffer.alloc(80, 0)
  row.writeInt32LE(staffIndex, 0)
  row.writeInt32LE(100, 4)
  row.writeInt32LE(wage, 12)
  row.writeUInt8(0xff, 54)
  row.writeUInt8(0xab, 71)
  row.writeUInt8(8, 78)
  return Buffer.concat([header, row])
}

function fakeDb(staffIndex: number, wage: number, blocks: BlockInfo[]): ParsedDatabase {
  const staff: StaffRecord[] = [
    {
      id: 1,
      player_id: 0,
      non_player_id: -1,
      club_job_id: 10,
      job_for_club: 11,
    } as StaffRecord,
  ]
  const contract: ContractRecord = {
    staffIndex,
    club_id: 100,
    wage,
    goal_bonus: 0,
    assist_bonus: 0,
    clean_sheet_bonus: 0,
    non_promotion_rc: 0,
    minimum_fee_rc: 0,
    non_playing_rc: 0,
    relegation_rc: 0,
    manager_job_rc: 0,
    release_fee: 0,
    date_started_iso: null,
    contract_expires_iso: null,
    contract_type: 0,
    leaving_on_bosman: 0,
    transfer_arranged_for: 0,
    transfer_status: 8,
    squad_status: 0,
  }
  return {
    staff,
    players: [],
    contractsByStaffIndex: new Map([[staffIndex, contract]]),
    blocks,
    compressed: false,
    gameDateIso: '2012-08-01',
  } as ParsedDatabase
}

describe('contractEditorSave', () => {
  it('patches wage at resolved row offset', () => {
    const archive = minimalContractArchive(0, 500)
    const contractBlock: BlockInfo = {
      name: 'contract.dat',
      position: 0,
      size: 88,
      compressedSize: 88,
    }
    const db = fakeDb(0, 500, [contractBlock])
    const base = resolveContractRowAbsOffset(archive, [contractBlock], 0)
    expect(base).toBe(8)
    const built = buildContractEditorPatchedBuffer(archive, [contractBlock], false, db, 0, {
      wage: 2500,
    })
    expect(built.ok).toBe(true)
    if (built.ok) {
      expect(built.buffer.readInt32LE(base! + 12)).toBe(2500)
    }
  })

  it('clears complaints then restores squad mirror (status int16 @ 70, shirt @ 72, status @ 79)', () => {
    const archive = minimalContractArchive(0, 500)
    const base = 8
    archive.writeUInt32LE(0xdeadbeef, base + 8)
    archive.fill(0xff, base + 54, base + 73)
    archive.writeUInt8(2, base + 79)
    archive.writeUInt8(8, base + 78)
    clearContractUnhappinessAtRow(archive, base, { squadStatus: 2, squadNumber: 9 })
    expect(archive.readUInt32LE(base + 8)).toBe(0)
    for (let i = 0; i < 16; i++) {
      expect(archive.readUInt8(base + CONTRACT_ISSUE_BLOCK_OFFSET + i)).toBe(0)
    }
    expect(archive.readInt16LE(base + 70)).toBe(2)
    expect(archive.readUInt8(base + 72)).toBe(9)
    expect(archive.readUInt8(base + 79)).toBe(2)
    expect(archive.readUInt8(base + 78)).toBe(0)
  })

  it('writes contract start and expiry TCM dates', () => {
    const archive = minimalContractArchive(0, 500)
    const contractBlock: BlockInfo = {
      name: 'contract.dat',
      position: 0,
      size: 88,
      compressedSize: 88,
    }
    const db = fakeDb(0, 500, [contractBlock])
    const base = 8
    const built = buildContractEditorPatchedBuffer(
      archive,
      [contractBlock],
      false,
      db,
      0,
      {},
      { date_started: '2002-07-01', contract_expires: '2006-06-30' },
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(tcmDateToIso(built.buffer, base + CONTRACT_DATE_STARTED_OFFSET)).toBe('2002-07-01')
    expect(tcmDateToIso(built.buffer, base + CONTRACT_DATE_EXPIRES_OFFSET)).toBe('2006-06-30')
  })

  it('resetApproachProtection sets contract start to save game date', () => {
    const archive = minimalContractArchive(0, 500)
    const contractBlock: BlockInfo = {
      name: 'contract.dat',
      position: 0,
      size: 88,
      compressedSize: 88,
    }
    const db = fakeDb(0, 500, [contractBlock])
    const base = 8
    const built = buildContractEditorPatchedBuffer(
      archive,
      [contractBlock],
      false,
      db,
      0,
      {},
      { contract_expires: '2015-06-30' },
      { resetApproachProtection: true },
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(tcmDateToIso(built.buffer, base + CONTRACT_DATE_STARTED_OFFSET)).toBe('2012-08-01')
    expect(tcmDateToIso(built.buffer, base + CONTRACT_DATE_EXPIRES_OFFSET)).toBe('2015-06-30')
  })
})
