import { writeTcmDateAtIso } from './database/dates'
import { staffDisplayName } from './database/parser'
import type { BlockInfo, ContractRecord, ParsedDatabase } from './database/types'
import {
  contractProtectionYearsAtSigning,
  contractStartIsoForApproachProtection,
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
  CONTRACT_CLUB_UNHAPPINESS_LENGTH,
  CONTRACT_CLUB_UNHAPPINESS_OFFSET,
  CONTRACT_DATE_EXPIRES_OFFSET,
  CONTRACT_DATE_STARTED_OFFSET,
  CONTRACT_DISK_FIELDS,
  CONTRACT_ISSUE_BLOCK_OFFSET,
  CONTRACT_ROW_BYTES,
  CONTRACT_SQUAD_STATUS_OFFSET,
  CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
  syncContractSquadMirrorBytes,
} from './database/contractDiskLayout'
import { findBlock, PLAYER_DISK_FIELDS, PLAYER_ROW_BYTES, writeScalarAt } from './database/playerStaffDiskLayout'

export type ContractEditorSnapshot = {
  staffIndex: number
  name: string
  hasContract: boolean
  values: Record<string, number>
  /** ISO calendar dates from contract TCMDate fields. */
  dateStartedIso: string | null
  dateExpiresIso: string | null
  /** Loaded save date — used to reset approach-protection window. */
  gameDateIso: string | null
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

function contractDataStart(archiveBuffer: Buffer, block: BlockInfo): { rowStart: number; count: number } | null {
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
  if (contractCount < 0 || o + contractCount * CONTRACT_ROW_BYTES > archiveBuffer.length) return null
  return { rowStart: o, count: contractCount }
}

/**
 * Contract row keys on real saves. CM Scout links `contract.dat` row `Id` to **staff array index**
 * (not always `staff.dat` id). Loan players can have two rows sharing the same `Id`.
 */
export function contractRowKeysForStaff(
  db: ParsedDatabase,
  staffIndex: number,
): Set<number> {
  const keys = new Set<number>()
  const staff = db.staff[staffIndex]
  if (!staff) return keys
  keys.add(staffIndex)
  if (staff.id > 0) keys.add(staff.id)
  if (staff.player_id >= 0) {
    keys.add(staff.player_id)
    const p = db.players[staff.player_id]
    if (p && p.id > 0) keys.add(p.id)
  }
  return keys
}

/** Every matching 80-byte contract row (duplicates exist on some saves). */
export function resolveAllContractRowAbsOffsets(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  staffIndex: number,
): number[] {
  const staff = db.staff[staffIndex]
  if (!staff) return []
  const seen = new Set<number>()
  const add = (off: number | null | undefined) => {
    if (off != null && off >= 0 && off + CONTRACT_ROW_BYTES <= archiveBuffer.length) seen.add(off)
  }

  const parsed = db.contractsByStaffIndex.get(staffIndex)
  add(parsed?.rowAbsOffset)

  const block = findBlock(blocks, 'contract.dat')
  if (!block) return [...seen]

  const data = contractDataStart(archiveBuffer, block)
  if (!data) return [...seen]

  const keys = contractRowKeysForStaff(db, staffIndex)
  let o = data.rowStart
  for (let i = 0; i < data.count; i++) {
    const rowKey = archiveBuffer.readInt32LE(o)
    if (keys.has(rowKey)) add(o)
    o += CONTRACT_ROW_BYTES
  }
  return [...seen]
}

/** Absolute offset of an 80-byte contract row in the archive, or null. */
export function resolveContractRowAbsOffset(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  staffIndex: number,
  staffDatId?: number,
  db?: ParsedDatabase,
): number | null {
  if (db) {
    const all = resolveAllContractRowAbsOffsets(archiveBuffer, blocks, db, staffIndex)
    if (all.length > 0) return all[0]!
  }
  const block = findBlock(blocks, 'contract.dat')
  if (!block) return null
  const data = contractDataStart(archiveBuffer, block)
  if (!data) return null
  const wantId = staffDatId != null && staffDatId > 0 ? staffDatId : null
  let byStaffIndex: number | null = null
  let o = data.rowStart
  for (let i = 0; i < data.count; i++) {
    const rowKey = archiveBuffer.readInt32LE(o)
    if (wantId != null && rowKey === wantId) return o
    if (rowKey === staffIndex && byStaffIndex === null) byStaffIndex = o
    o += CONTRACT_ROW_BYTES
  }
  return byStaffIndex
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
    gameDateIso: db.gameDateIso ?? null,
    hints,
  }
}

export type ContractEditorDateChanges = {
  date_started?: string | null
  contract_expires?: string | null
}

/** Merge protection reset into contract date writes (sets start date to save game date). */
export function mergeContractDateChanges(
  dateChanges: ContractEditorDateChanges | undefined,
  gameDateIso: string | null | undefined,
  resetApproachProtection: boolean,
): ContractEditorDateChanges | undefined {
  const startIso = resetApproachProtection ? contractStartIsoForApproachProtection(gameDateIso) : null
  if (!dateChanges && !startIso) return undefined
  const out: ContractEditorDateChanges = { ...dateChanges }
  if (startIso) out.date_started = startIso
  return out
}

export function buildContractEditorPatchedBuffer(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  staffIndex: number,
  changes: Record<string, number>,
  dateChanges?: ContractEditorDateChanges,
  opts?: { resetApproachProtection?: boolean },
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (compressed) {
    return { ok: false, error: 'Contract editing requires an uncompressed save.' }
  }
  const snap = buildContractEditorSnapshot(db, staffIndex)
  if (!snap?.hasContract) {
    return { ok: false, error: 'No contract row for this staff index.' }
  }
  const base = resolveContractRowAbsOffset(archiveBuffer, blocks, staffIndex, db.staff[staffIndex]?.id, db)
  if (base == null) {
    return { ok: false, error: 'Could not locate contract.dat row.' }
  }
  const out = Buffer.from(archiveBuffer)
  for (const [key, rawVal] of Object.entries(changes)) {
    const meta = CONTRACT_DISK_FIELDS[key]
    if (!meta || !Number.isFinite(rawVal)) continue
    writeScalarAt(out, base + meta.offset, meta.kind, Number(rawVal))
  }
  const mergedDates = mergeContractDateChanges(dateChanges, db.gameDateIso, opts?.resetApproachProtection === true)
  if (mergedDates && 'date_started' in mergedDates) {
    writeTcmDateAtIso(out, base + CONTRACT_DATE_STARTED_OFFSET, mergedDates.date_started)
  }
  if (mergedDates && 'contract_expires' in mergedDates) {
    writeTcmDateAtIso(out, base + CONTRACT_DATE_EXPIRES_OFFSET, mergedDates.contract_expires)
  }
  const squadNumber = readPlayerSquadNumber(out, blocks, db, staffIndex)
  const contractRows = resolveAllContractRowAbsOffsets(out, blocks, db, staffIndex)
  const rowsToSync = contractRows.length > 0 ? contractRows : [base]
  let squadStatus = out.readUInt8(base + CONTRACT_SQUAD_STATUS_OFFSET)
  if (changes.squad_status != null && Number.isFinite(Number(changes.squad_status))) {
    squadStatus = Math.trunc(Number(changes.squad_status))
  }
  for (const row of rowsToSync) {
    if (changes.squad_status != null && Number.isFinite(Number(changes.squad_status))) {
      writeScalarAt(out, row + CONTRACT_SQUAD_STATUS_OFFSET, 'u8', squadStatus)
    }
    syncContractSquadMirrorBytes(out, row, { squadStatus, squadNumber })
  }
  return { ok: true, buffer: out }
}

function readPlayerSquadNumber(
  buf: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  staffIndex: number,
): number | undefined {
  const staff = db.staff[staffIndex]
  if (!staff || staff.player_id < 0 || staff.player_id >= db.players.length) return undefined
  const playerBlock = findBlock(blocks, 'player.dat')
  if (!playerBlock) return undefined
  const off = playerBlock.position + staff.player_id * PLAYER_ROW_BYTES + PLAYER_DISK_FIELDS.squad_number.offset
  if (off >= buf.length) return undefined
  return buf.readUInt8(off)
}

/** Clear transfer-request bit (0x08) on contract.transfer_status. */
export function clearTransferRequestAtContractRow(buf: Buffer, contractRowAbs: number): void {
  const off = contractRowAbs + (CONTRACT_DISK_FIELDS.transfer_status?.offset ?? 78)
  const ts = buf.readUInt8(off)
  buf.writeUInt8(ts & ~8, off)
}

/**
 * Clear in-game Future / transfer complaints on a contract row (GK Contract → Unhappiness + Club Unhappiness).
 * Zeros full `Unknown2` (54–72) then restores squad mirror bytes so CM does not show “clarification on future”.
 */
export function clearContractUnhappinessAtRow(
  buf: Buffer,
  contractRowAbs: number,
  opts?: { squadStatus?: number; squadNumber?: number },
): void {
  const squadStatusOff = contractRowAbs + CONTRACT_SQUAD_STATUS_OFFSET
  const squadStatus =
    opts?.squadStatus != null && Number.isFinite(opts.squadStatus)
      ? Math.trunc(opts.squadStatus)
      : squadStatusOff < buf.length
        ? buf.readUInt8(squadStatusOff)
        : 0
  buf.fill(
    0,
    contractRowAbs + CONTRACT_CLUB_UNHAPPINESS_OFFSET,
    contractRowAbs + CONTRACT_CLUB_UNHAPPINESS_OFFSET + CONTRACT_CLUB_UNHAPPINESS_LENGTH,
  )
  buf.fill(
    0,
    contractRowAbs + CONTRACT_ISSUE_BLOCK_OFFSET,
    contractRowAbs + CONTRACT_ISSUE_BLOCK_OFFSET + CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH,
  )
  syncContractSquadMirrorBytes(buf, contractRowAbs, {
    squadStatus,
    squadNumber: opts?.squadNumber,
  })
  clearTransferRequestAtContractRow(buf, contractRowAbs)
  const transferArrangedOff = contractRowAbs + (CONTRACT_DISK_FIELDS.transfer_arranged_for?.offset ?? 74)
  if (transferArrangedOff + 4 <= buf.length) {
    buf.writeInt32LE(-1, transferArrangedOff)
  }
  const bosmanOff = contractRowAbs + (CONTRACT_DISK_FIELDS.leaving_on_bosman?.offset ?? 73)
  if (bosmanOff < buf.length) {
    buf.writeUInt8(0, bosmanOff)
  }
}
