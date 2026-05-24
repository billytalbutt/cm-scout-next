/**
 * Active injury slot in `injury_history.tmp` (empirical CM0102 layout).
 * Row index = staff id; row is 36 bytes; staff id repeated at byte 0.
 * Injury type id at byte 12 (0 = fit / no active injury entry).
 */
import { readArchiveBlock } from './parser'
import type { BlockInfo } from './types'
import { findBlock } from './playerStaffDiskLayout'

export const INJURY_HISTORY_ROW_BYTES = 36
/** Byte offset of injury type id within a row (0 = none). */
export const INJURY_HISTORY_TYPE_OFF = 12

export type PlayerInjuryState = {
  staffId: number
  injuryTypeId: number
  /** Absolute offset of the injury type int32 in the archive buffer. */
  typeAbsOffset: number
}

export function injuryTypeLabel(typeId: number): string {
  if (typeId <= 0) return 'None'
  return `Injury #${typeId}`
}

/** Locate the 36-byte row for `staffId` (usually row index = staff id; otherwise linear scan). */
export function findInjuryRowOffset(historyBuf: Buffer, staffId: number): number | null {
  if (staffId <= 0) return null
  const direct = staffId * INJURY_HISTORY_ROW_BYTES
  if (direct + INJURY_HISTORY_ROW_BYTES <= historyBuf.length) {
    if (historyBuf.readInt32LE(direct) === staffId) return direct
  }
  const n = Math.floor(historyBuf.length / INJURY_HISTORY_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const o = i * INJURY_HISTORY_ROW_BYTES
    if (historyBuf.readInt32LE(o) === staffId) return o
  }
  return null
}

/** Read injury row for `staffId` from a decompressed `injury_history.tmp` buffer. */
export function readInjuryStateFromHistoryBuf(
  historyBuf: Buffer,
  staffId: number,
): PlayerInjuryState | null {
  const base = findInjuryRowOffset(historyBuf, staffId)
  if (base == null) return null
  const injuryTypeId = historyBuf.readInt32LE(base + INJURY_HISTORY_TYPE_OFF)
  return {
    staffId,
    injuryTypeId,
    typeAbsOffset: base + INJURY_HISTORY_TYPE_OFF,
  }
}

export function resolveInjuryHistoryAbsOffset(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  staffId: number,
): number | { error: string } {
  const block = findBlock(blocks, 'injury_history.tmp')
  if (!block) return { error: 'Save has no injury_history.tmp block.' }
  const historyBuf = readArchiveBlock(archiveBuffer, 'injury_history.tmp')
  if (!historyBuf) return { error: 'Could not read injury_history.tmp.' }
  const state = readInjuryStateFromHistoryBuf(historyBuf, staffId)
  if (!state) {
    return { error: `No injury_history row for staff id ${staffId} (row index must match staff id).` }
  }
  return block.position + state.typeAbsOffset
}

/** Clear active injury (sets injury type id to 0). */
export function clearInjuryAtAbsOffset(archiveBuffer: Buffer, typeAbsOffset: number): { ok: true } | { ok: false; error: string } {
  if (typeAbsOffset < 0 || typeAbsOffset + 4 > archiveBuffer.length) {
    return { ok: false, error: 'Injury offset is outside the archive buffer.' }
  }
  archiveBuffer.writeInt32LE(0, typeAbsOffset)
  return { ok: true }
}

export function readPlayerInjuryFromArchive(
  archiveBuffer: Buffer,
  staffId: number,
): PlayerInjuryState | null {
  const historyBuf = readArchiveBlock(archiveBuffer, 'injury_history.tmp')
  if (!historyBuf) return null
  return readInjuryStateFromHistoryBuf(historyBuf, staffId)
}
