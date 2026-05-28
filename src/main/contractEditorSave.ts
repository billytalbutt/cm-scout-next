import { staffDisplayName } from './database/parser'
import type { BlockInfo, ContractRecord, ParsedDatabase } from './database/types'
import {
  CONTRACT_DISK_FIELDS,
  CONTRACT_ROW_BYTES,
} from './database/contractDiskLayout'
import { findBlock, writeScalarAt } from './database/playerStaffDiskLayout'

export type ContractEditorSnapshot = {
  staffIndex: number
  name: string
  hasContract: boolean
  values: Record<string, number>
}

const CONTRACT_RECORD_KEY: Record<string, keyof ContractRecord> = {
  wage: 'wage',
  goal_bonus: 'goal_bonus',
  assist_bonus: 'assist_bonus',
  clean_sheet_bonus: 'clean_sheet_bonus',
  non_promotion_rc: 'non_promotion_rc',
  minimum_fee_rc: 'minimum_fee_rc',
  non_playing_rc: 'non_playing_rc',
  relegation_rc: 'relegation_rc',
  manager_job_rc: 'manager_job_rc',
  release_fee: 'release_fee',
  contract_type: 'contract_type',
  leaving_on_bosman: 'leaving_on_bosman',
  transfer_arranged_for: 'transfer_arranged_for',
  transfer_status: 'transfer_status',
  squad_status: 'squad_status',
}

/** Absolute offset of an 80-byte contract row in the archive, or null. */
export function resolveContractRowAbsOffset(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  staffIndex: number,
): number | null {
  const block = findBlock(blocks, 'contract.dat')
  if (!block) return null
  let o = block.position
  const preCount = archiveBuffer.readInt32LE(o)
  o += 4
  let contractCount = archiveBuffer.readInt32LE(o)
  o += 4
  let lastPre = Buffer.alloc(0)
  for (let i = 0; i < preCount; i++) {
    lastPre = archiveBuffer.subarray(o, o + 21)
    o += 21
  }
  if (preCount > 0 && lastPre.length >= 21) {
    contractCount = lastPre.readInt32LE(17)
  }
  for (let i = 0; i < contractCount; i++) {
    if (o + CONTRACT_ROW_BYTES > archiveBuffer.length) return null
    const rowStaff = archiveBuffer.readInt32LE(o)
    if (rowStaff === staffIndex) return o
    o += CONTRACT_ROW_BYTES
  }
  return null
}

export function buildContractEditorSnapshot(db: ParsedDatabase, staffIndex: number): ContractEditorSnapshot | null {
  const staff = db.staff[staffIndex]
  if (!staff) return null
  const c = db.contractsByStaffIndex.get(staffIndex)
  const values: Record<string, number> = {}
  if (c) {
    for (const [diskKey, recordKey] of Object.entries(CONTRACT_RECORD_KEY)) {
      const v = c[recordKey]
      if (typeof v === 'number' && Number.isFinite(v)) values[diskKey] = v
    }
  }
  return {
    staffIndex,
    name: staffDisplayName(staff, db.firstNames, db.secondNames, db.commonNames),
    hasContract: !!c,
    values,
  }
}

export function buildContractEditorPatchedBuffer(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  staffIndex: number,
  changes: Record<string, number>,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (compressed) {
    return { ok: false, error: 'Contract editing requires an uncompressed save.' }
  }
  const snap = buildContractEditorSnapshot(db, staffIndex)
  if (!snap?.hasContract) {
    return { ok: false, error: 'No contract row for this staff index.' }
  }
  const base = resolveContractRowAbsOffset(archiveBuffer, blocks, staffIndex)
  if (base == null) {
    return { ok: false, error: 'Could not locate contract.dat row.' }
  }
  const out = Buffer.from(archiveBuffer)
  for (const [key, rawVal] of Object.entries(changes)) {
    const meta = CONTRACT_DISK_FIELDS[key]
    if (!meta || !Number.isFinite(rawVal)) continue
    writeScalarAt(out, base + meta.offset, meta.kind, Number(rawVal))
  }
  return { ok: true, buffer: out }
}

/** Clear transfer-request bit (0x08) on contract.transfer_status. */
export function clearTransferRequestAtContractRow(buf: Buffer, contractRowAbs: number): void {
  const off = contractRowAbs + (CONTRACT_DISK_FIELDS.transfer_status?.offset ?? 78)
  const ts = buf.readUInt8(off)
  buf.writeUInt8(ts & ~8, off)
}
