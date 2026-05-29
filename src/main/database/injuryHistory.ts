/**
 * Active injury slot in `injury_history.tmp` (empirical CM0102 layout).
 * Each row is 36 bytes; staff id at byte 0. Injury type id at byte 12 (0 = fit).
 * Row index often equals staff id, but some saves use sparse ids — scan all rows.
 */
import { readArchiveBlock } from './parser'
import type { BlockInfo } from './types'
import { findBlock } from './playerStaffDiskLayout'

export const INJURY_HISTORY_ROW_BYTES = 36
/** Byte offset of injury type id within a row (0 = none / fit). */
export const INJURY_HISTORY_TYPE_OFF = 12

export type PlayerInjuryState = {
  /** Staff id used to locate the row (may differ from lookup key tried). */
  staffId: number
  injuryTypeId: number
  /** Absolute offset of the injury type int32 in the archive buffer. */
  typeAbsOffset: number
}

export type InjurySummary = {
  typeId: number
  label: string
}

export function injuryTypeLabel(typeId: number): string {
  if (typeId <= 0) return 'None'
  return `Injury #${typeId}`
}

export function isActiveInjuryType(typeId: number): boolean {
  return Number.isFinite(typeId) && typeId > 0
}

/** Unique lookup keys: staff.dat id, linked player.dat id, staff array index. */
export function injuryLookupKeys(staff: { id: number; player_id: number }, staffIndex?: number): number[] {
  const out: number[] = []
  const add = (n: number) => {
    if (!Number.isFinite(n) || n <= 0 || out.includes(n)) return
    out.push(Math.trunc(n))
  }
  add(staff.id)
  add(staff.player_id)
  if (staffIndex != null && staffIndex >= 0) add(staffIndex)
  return out
}

function readRowTypeId(historyBuf: Buffer, rowOffset: number): number {
  return historyBuf.readInt32LE(rowOffset + INJURY_HISTORY_TYPE_OFF)
}

function rowStaffIdAt(historyBuf: Buffer, rowOffset: number): number {
  return historyBuf.readInt32LE(rowOffset)
}

/** All row offsets whose leading int32 matches `lookupKey`. */
export function findInjuryRowOffsets(historyBuf: Buffer, lookupKey: number): number[] {
  if (lookupKey <= 0) return []
  const hits: number[] = []
  const direct = lookupKey * INJURY_HISTORY_ROW_BYTES
  if (direct + INJURY_HISTORY_ROW_BYTES <= historyBuf.length && rowStaffIdAt(historyBuf, direct) === lookupKey) {
    hits.push(direct)
  }
  const n = Math.floor(historyBuf.length / INJURY_HISTORY_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const o = i * INJURY_HISTORY_ROW_BYTES
    if (rowStaffIdAt(historyBuf, o) !== lookupKey) continue
    if (!hits.includes(o)) hits.push(o)
  }
  return hits
}

/** Pick the best row for an active injury, or the canonical fit row. */
export function pickInjuryRowOffset(historyBuf: Buffer, lookupKey: number): number | null {
  const hits = findInjuryRowOffsets(historyBuf, lookupKey)
  if (hits.length === 0) return null
  const direct = lookupKey * INJURY_HISTORY_ROW_BYTES
  const withActive = hits.filter((o) => isActiveInjuryType(readRowTypeId(historyBuf, o)))
  if (withActive.length > 0) {
    if (withActive.includes(direct)) return direct
    return withActive[withActive.length - 1]!
  }
  if (hits.includes(direct)) return direct
  return hits[0]!
}

/** @deprecated Use pickInjuryRowOffset — kept for tests. */
export function findInjuryRowOffset(historyBuf: Buffer, lookupKey: number): number | null {
  return pickInjuryRowOffset(historyBuf, lookupKey)
}

export function readInjuryStateFromHistoryBuf(
  historyBuf: Buffer,
  lookupKey: number,
): PlayerInjuryState | null {
  const base = pickInjuryRowOffset(historyBuf, lookupKey)
  if (base == null) return null
  const injuryTypeId = readRowTypeId(historyBuf, base)
  return {
    staffId: rowStaffIdAt(historyBuf, base),
    injuryTypeId,
    typeAbsOffset: base + INJURY_HISTORY_TYPE_OFF,
  }
}

/** Injury row aligned with staff.dat row index (common CM layout). */
export function readInjuryStateAtStaffDatRow(
  historyBuf: Buffer,
  staffIndex: number,
): PlayerInjuryState | null {
  const base = staffIndex * INJURY_HISTORY_ROW_BYTES
  if (staffIndex < 0 || base + INJURY_HISTORY_ROW_BYTES > historyBuf.length) return null
  const staffId = rowStaffIdAt(historyBuf, base)
  const injuryTypeId = readRowTypeId(historyBuf, base)
  if (staffId <= 0 && !isActiveInjuryType(injuryTypeId)) return null
  return {
    staffId,
    injuryTypeId,
    typeAbsOffset: base + INJURY_HISTORY_TYPE_OFF,
  }
}

/** Resolve active injury for a playable staff row (tries staff id, player id, staff index). */
export function readPlayerInjuryForStaff(
  archiveBuffer: Buffer,
  staff: { id: number; player_id: number },
  staffIndex?: number,
): PlayerInjuryState | null {
  const historyBuf = readArchiveBlock(archiveBuffer, 'injury_history.tmp')
  if (!historyBuf) return null

  let rowFallback: PlayerInjuryState | null = null
  if (staffIndex != null && staffIndex >= 0) {
    const atRow = readInjuryStateAtStaffDatRow(historyBuf, staffIndex)
    if (atRow) {
      if (isActiveInjuryType(atRow.injuryTypeId)) return atRow
      rowFallback = atRow
    }
  }

  const keys = injuryLookupKeys(staff, staffIndex)
  let keyFallback: PlayerInjuryState | null = null
  for (const key of keys) {
    const state = readInjuryStateFromHistoryBuf(historyBuf, key)
    if (!state) continue
    if (isActiveInjuryType(state.injuryTypeId)) return state
    if (!keyFallback) keyFallback = state
  }
  return keyFallback ?? rowFallback
}

export function readPlayerInjuryFromArchive(
  archiveBuffer: Buffer,
  staffId: number,
): PlayerInjuryState | null {
  const historyBuf = readArchiveBlock(archiveBuffer, 'injury_history.tmp')
  if (!historyBuf) return null
  return readInjuryStateFromHistoryBuf(historyBuf, staffId)
}

/**
 * Index injury rows in one O(n) pass — for profiles/filters; prefer canonical row per staff id.
 */
export function buildInjuryByStaffIdMap(archiveBuffer: Buffer): Map<number, InjurySummary> {
  const m = new Map<number, InjurySummary>()
  const historyBuf = readArchiveBlock(archiveBuffer, 'injury_history.tmp')
  if (!historyBuf) return m
  const n = Math.floor(historyBuf.length / INJURY_HISTORY_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const o = i * INJURY_HISTORY_ROW_BYTES
    const staffId = rowStaffIdAt(historyBuf, o)
    if (staffId <= 0) continue
    const typeId = readRowTypeId(historyBuf, o)
    const direct = staffId * INJURY_HISTORY_ROW_BYTES
    const isCanonical =
      o === direct &&
      direct + INJURY_HISTORY_ROW_BYTES <= historyBuf.length &&
      rowStaffIdAt(historyBuf, direct) === staffId
    const prev = m.get(staffId)
    if (!prev) {
      m.set(staffId, { typeId, label: injuryTypeLabel(typeId) })
      continue
    }
    if (isActiveInjuryType(typeId) && !isActiveInjuryType(prev.typeId)) {
      m.set(staffId, { typeId, label: injuryTypeLabel(typeId) })
      continue
    }
    if (isCanonical && (!isActiveInjuryType(prev.typeId) || isActiveInjuryType(typeId))) {
      m.set(staffId, { typeId, label: injuryTypeLabel(typeId) })
    }
  }
  return m
}

export function resolveInjuryHistoryAbsOffset(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  staff: { id: number; player_id: number },
  staffIndex?: number,
): number | { error: string } {
  const block = findBlock(blocks, 'injury_history.tmp')
  if (!block) return { error: 'Save has no injury_history.tmp block.' }
  const state = readPlayerInjuryForStaff(archiveBuffer, staff, staffIndex)
  if (!state) {
    return { error: 'No injury_history row for this player in the loaded save.' }
  }
  if (!isActiveInjuryType(state.injuryTypeId)) {
    return { error: 'No active injury recorded for this player.' }
  }
  return block.position + state.typeAbsOffset
}

/** Clear active injury (sets injury type id to 0). */
export function clearInjuryAtAbsOffset(
  archiveBuffer: Buffer,
  typeAbsOffset: number,
): { ok: true } | { ok: false; error: string } {
  if (typeAbsOffset < 0 || typeAbsOffset + 4 > archiveBuffer.length) {
    return { ok: false, error: 'Injury offset is outside the archive buffer.' }
  }
  archiveBuffer.writeInt32LE(0, typeAbsOffset)
  return { ok: true }
}
