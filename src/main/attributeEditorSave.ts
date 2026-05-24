import { staffDisplayName } from './database/parser'
import type { BlockInfo, ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'
import {
  clearInjuryAtAbsOffset,
  resolveInjuryHistoryAbsOffset,
} from './database/injuryHistory'
import {
  findBlock,
  PLAYER_DISK_FIELDS,
  PLAYER_ROW_BYTES,
  STAFF_EDITOR_KEYS,
  STAFF_MENTAL_DISK_OFFSETS,
  STAFF_ROW_BYTES,
  writeScalarAt,
} from './database/playerStaffDiskLayout'

export type AttributeEditorSaveResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string }

/**
 * Apply attribute edits to a copy of an uncompressed CM0102 archive buffer.
 * `changes` maps logical field names (`PlayerRecord` keys or staff mental keys) to new numeric values.
 */
export function buildPatchedArchiveBuffer(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  staffIndex: number,
  changes: Record<string, number>,
  opts?: { clearInjury?: boolean },
): AttributeEditorSaveResult {
  if (compressed) {
    return {
      ok: false,
      error:
        'Attribute editing requires an uncompressed database or save (Game Settings → Save Compressed = No).',
    }
  }
  if (!Number.isFinite(staffIndex) || staffIndex < 0 || staffIndex >= db.staff.length) {
    return { ok: false, error: 'Invalid staff index.' }
  }
  const staff = db.staff[staffIndex]!
  const playerRow = staff.player_id
  if (playerRow < 0 || playerRow >= db.players.length) {
    return { ok: false, error: 'Staff row is not linked to a valid player.dat row.' }
  }

  const playerBlock = findBlock(blocks, 'player.dat')
  const staffBlock = findBlock(blocks, 'staff.dat')
  if (!playerBlock || !staffBlock) {
    return { ok: false, error: 'Archive is missing player.dat or staff.dat block.' }
  }

  const playerBase = playerBlock.position + playerRow * PLAYER_ROW_BYTES
  if (playerBase + PLAYER_ROW_BYTES > archiveBuffer.length || playerBase < 0) {
    return { ok: false, error: 'player.dat row falls outside the file — unexpected block size.' }
  }
  const staffBase = staffBlock.position + staffIndex * STAFF_ROW_BYTES
  if (staffBase + STAFF_ROW_BYTES > archiveBuffer.length || staffBase < 0) {
    return { ok: false, error: 'staff.dat row falls outside the file — unexpected block size.' }
  }

  const out = Buffer.from(archiveBuffer)

  for (const [key, rawVal] of Object.entries(changes)) {
    if (!Number.isFinite(rawVal)) continue
    const v = Number(rawVal)
    if (STAFF_EDITOR_KEYS.has(key)) {
      const rel = STAFF_MENTAL_DISK_OFFSETS[key]
      if (rel === undefined) continue
      writeScalarAt(out, staffBase + rel, 'i8', v)
      continue
    }
    const meta = PLAYER_DISK_FIELDS[key]
    if (meta) {
      writeScalarAt(out, playerBase + meta.offset, meta.kind, v)
    }
  }

  if (opts?.clearInjury) {
    const off = resolveInjuryHistoryAbsOffset(out, blocks, staff.id)
    if (typeof off !== 'number') return { ok: false, error: off.error }
    const cleared = clearInjuryAtAbsOffset(out, off)
    if (!cleared.ok) return cleared
  }

  return { ok: true, buffer: out }
}

/** Flat map of every editable on-disk value for one player row + linked staff mentals. */
export function buildEditorValueMap(db: ParsedDatabase, staffIndex: number): Record<string, number> | null {
  if (staffIndex < 0 || staffIndex >= db.staff.length) return null
  const s = db.staff[staffIndex]!
  const pid = s.player_id
  if (pid < 0 || pid >= db.players.length) return null
  const p = db.players[pid]!
  const out: Record<string, number> = {}
  for (const k of Object.keys(PLAYER_DISK_FIELDS)) {
    out[k] = p[k as keyof PlayerRecord] as number
  }
  for (const k of Object.keys(STAFF_MENTAL_DISK_OFFSETS)) {
    out[k] = s[k as keyof StaffRecord] as number
  }
  return out
}

export function editorSubjectLabel(db: ParsedDatabase, staffIndex: number): string | null {
  if (staffIndex < 0 || staffIndex >= db.staff.length) return null
  const s = db.staff[staffIndex]!
  return staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
}
