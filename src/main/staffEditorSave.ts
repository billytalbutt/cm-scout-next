import { staffDisplayName } from './database/parser'
import type { BlockInfo, ParsedDatabase } from './database/types'
import { nonPlayerForStaffLink } from './database/nonplayer'
import {
  NONPLAYER_DISK_FIELDS,
  NONPLAYER_RECORD_KEY,
  NONPLAYER_ROW_BYTES,
} from './database/nonplayerDiskLayout'
import { findBlock, writeScalarAt } from './database/playerStaffDiskLayout'

export type StaffEditorSnapshot = {
  staffIndex: number
  staffId: number
  name: string
  jobForClub: number
  nonPlayerRowIndex: number | null
  values: Record<string, number>
}

export function buildStaffEditorSnapshot(db: ParsedDatabase, staffIndex: number): StaffEditorSnapshot | null {
  const staff = db.staff[staffIndex]
  if (!staff) return null
  const npRows = db.nonPlayersByRowIndex
  const np = npRows ? nonPlayerForStaffLink(staff.non_player_id, npRows) : undefined
  const values: Record<string, number> = {}
  if (np) {
    for (const [diskKey, recordKey] of Object.entries(NONPLAYER_RECORD_KEY)) {
      const v = np[recordKey]
      if (typeof v === 'number' && Number.isFinite(v)) values[diskKey] = v
    }
  }
  return {
    staffIndex,
    staffId: staff.id,
    name: staffDisplayName(staff, db.firstNames, db.secondNames, db.commonNames),
    jobForClub: staff.job_for_club,
    nonPlayerRowIndex:
      staff.non_player_id > 0 && npRows && staff.non_player_id < npRows.length ? staff.non_player_id : null,
    values,
  }
}

export function buildStaffEditorPatchedBuffer(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  staffIndex: number,
  changes: Record<string, number>,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (compressed) {
    return { ok: false, error: 'Staff editing requires an uncompressed save.' }
  }
  const snap = buildStaffEditorSnapshot(db, staffIndex)
  if (!snap || snap.nonPlayerRowIndex == null) {
    return { ok: false, error: 'This staff member has no linked non-player profile row.' }
  }
  const rowIndex = snap.nonPlayerRowIndex
  const block = findBlock(blocks, 'nonplayer.dat')
  if (!block) return { ok: false, error: 'Archive is missing nonplayer.dat.' }
  const base = block.position + rowIndex * NONPLAYER_ROW_BYTES
  if (base + NONPLAYER_ROW_BYTES > archiveBuffer.length) {
    return { ok: false, error: 'nonplayer.dat row out of range.' }
  }
  const out = Buffer.from(archiveBuffer)
  for (const [key, rawVal] of Object.entries(changes)) {
    const meta = NONPLAYER_DISK_FIELDS[key]
    if (!meta || !Number.isFinite(rawVal)) continue
    writeScalarAt(out, base + meta.offset, meta.kind, Number(rawVal))
  }
  return { ok: true, buffer: out }
}
