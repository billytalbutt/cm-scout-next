import { writeTcmDateAtIso } from './database/dates'
import { staffDisplayName } from './database/parser'import type { BlockInfo, ContractRecord, ParsedDatabase } from './database/types'
import {
  contractProtectionYearsAtSigning,
  isContractUnprotected,
  ageAtIsoDate,
} from '../shared/contractProtection'
import {
  contractTypeDisplay,
  fmtContractBonus,
  fmtContractDateHint,
  fmtReleaseFee,
  fmtWage,
  releaseClauseLabel,
  squadStatusLabel,
  transferArrangedLabel,
  yesNoLabel,
} from '../shared/contractEditorDisplay'
import {
  CONTRACT_DATE_EXPIRES_OFFSET,
  CONTRACT_DATE_STARTED_OFFSET,
  CONTRACT_DISK_FIELDS,
  CONTRACT_ISSUE_BLOCK_OFFSET,
  CONTRACT_ROW_BYTES,
  CONTRACT_SQUAD_MIRROR_OFFSET,
  CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
  CONTRACT_UNHAPPINESS_TAIL_OFFSET,
} from './database/contractDiskLayout'
import { findBlock, writeScalarAt } from './database/playerStaffDiskLayout'

export type ContractEditorSnapshot = {
  staffIndex: number
  name: string
  hasContract: boolean
  values: Record<string, number>
  /** ISO calendar dates from contract TCMDate fields. */
  dateStartedIso: string | null
  dateExpiresIso: string | null
  hints: Record<string, string>
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
  const hints: Record<string, string> = {}
  let dateStartedIso: string | null = null
  let dateExpiresIso: string | null = null
  if (c) {
    for (const [diskKey, recordKey] of Object.entries(CONTRACT_RECORD_KEY)) {
      const v = c[recordKey]
      if (typeof v === 'number' && Number.isFinite(v)) values[diskKey] = v
    }
    dateStartedIso = c.date_started_iso
    dateExpiresIso = c.contract_expires_iso
    hints.wage = fmtWage(c.wage)
    hints.goal_bonus = fmtContractBonus(c.goal_bonus)
    hints.assist_bonus = fmtContractBonus(c.assist_bonus)
    hints.clean_sheet_bonus = fmtContractBonus(c.clean_sheet_bonus)
    hints.release_fee = fmtReleaseFee(c.release_fee)
    hints.contract_type = contractTypeDisplay(c.contract_type)
    hints.squad_status = squadStatusLabel(c.squad_status)
    const arrangedName = db.clubNames?.get(c.transfer_arranged_for)?.trim()
    hints.transfer_arranged_for = transferArrangedLabel(c.transfer_arranged_for, arrangedName)
    hints.leaving_on_bosman = yesNoLabel(c.leaving_on_bosman)
    hints.minimum_fee_rc = yesNoLabel(c.minimum_fee_rc)
    hints.non_promotion_rc = releaseClauseLabel(c.non_promotion_rc)
    hints.non_playing_rc = releaseClauseLabel(c.non_playing_rc)
    hints.relegation_rc = releaseClauseLabel(c.relegation_rc)
    hints.manager_job_rc = releaseClauseLabel(c.manager_job_rc)
    hints.date_started = fmtContractDateHint(dateStartedIso)
    hints.contract_expires = fmtContractDateHint(dateExpiresIso, db.gameDateIso)
    if (dateStartedIso && db.gameDateIso) {
      const ageAtSigning = ageAtIsoDate(staff, dateStartedIso)
      if (ageAtSigning != null) {
        const years = contractProtectionYearsAtSigning(ageAtSigning)
        hints.contract_protection = isContractUnprotected(c, staff, db.gameDateIso)
          ? 'Unprotected — can be approached to sign in a transfer window'
          : `Protected — ${years} years from start (${fmtContractDateHint(dateStartedIso)})`
      }
    }
  }
  return {
    staffIndex,
    name: staffDisplayName(staff, db.firstNames, db.secondNames, db.commonNames),
    hasContract: !!c,
    values,
    dateStartedIso,
    dateExpiresIso,
    hints,
  }
}

export type ContractEditorDateChanges = {
  date_started?: string | null
  contract_expires?: string | null
}

export function buildContractEditorPatchedBuffer(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  staffIndex: number,
  changes: Record<string, number>,
  dateChanges?: ContractEditorDateChanges,
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
  if (dateChanges && 'date_started' in dateChanges) {
    writeTcmDateAtIso(out, base + CONTRACT_DATE_STARTED_OFFSET, dateChanges.date_started)
  }
  if (dateChanges && 'contract_expires' in dateChanges) {
    writeTcmDateAtIso(out, base + CONTRACT_DATE_EXPIRES_OFFSET, dateChanges.contract_expires)
  }
  return { ok: true, buffer: out }
}

/** Clear transfer-request bit (0x08) on contract.transfer_status. */
export function clearTransferRequestAtContractRow(buf: Buffer, contractRowAbs: number): void {
  const off = contractRowAbs + (CONTRACT_DISK_FIELDS.transfer_status?.offset ?? 78)
  const ts = buf.readUInt8(off)
  buf.writeUInt8(ts & ~8, off)
}

/**
 * Clear in-game player issue / unhappiness data on a contract row.
 * Zeros complaint flags (`Unknown18_1` + `Unknown18_2`, bytes 54–69). Bytes 70–72 are preserved —
 * on real saves they often carry squad/shirt state; zeroing them scrambles squad numbers in CM.
 */
export function clearContractUnhappinessAtRow(buf: Buffer, contractRowAbs: number): void {
  const squadMirror0 = buf.readUInt8(contractRowAbs + CONTRACT_SQUAD_MIRROR_OFFSET)
  const squadMirror1 = buf.readUInt8(contractRowAbs + CONTRACT_SQUAD_MIRROR_OFFSET + 1)
  const squadMirrorTail =
    contractRowAbs + CONTRACT_UNHAPPINESS_TAIL_OFFSET < buf.length
      ? buf.readUInt8(contractRowAbs + CONTRACT_UNHAPPINESS_TAIL_OFFSET)
      : 0
  buf.fill(
    0,
    contractRowAbs + CONTRACT_ISSUE_BLOCK_OFFSET,
    contractRowAbs + CONTRACT_ISSUE_BLOCK_OFFSET + CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
  )
  buf.writeUInt8(squadMirror0, contractRowAbs + CONTRACT_SQUAD_MIRROR_OFFSET)
  buf.writeUInt8(squadMirror1, contractRowAbs + CONTRACT_SQUAD_MIRROR_OFFSET + 1)
  if (contractRowAbs + CONTRACT_UNHAPPINESS_TAIL_OFFSET < buf.length) {
    buf.writeUInt8(squadMirrorTail, contractRowAbs + CONTRACT_UNHAPPINESS_TAIL_OFFSET)
  }
  clearTransferRequestAtContractRow(buf, contractRowAbs)
}
