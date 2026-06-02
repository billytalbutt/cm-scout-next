import { staffDisplayName } from './database/parser'
import type { BlockInfo, ParsedDatabase } from './database/types'
import {
  readPreferencesValuesForStaff,
  STAFF_PREFERENCES_ID_OFFSET,
  writePreferencesValuesForStaff,
} from './database/staffPreferencesDiskLayout'
import { findBlock, STAFF_ROW_BYTES } from './database/playerStaffDiskLayout'
import type { PreferencesEditorValues } from '../shared/preferencesEditor'
import {
  PREFERENCES_SLOT_NONE,
  emptyPreferencesValues,
  preferencesValuesEqual,
} from '../shared/preferencesEditor'

export type PreferencesEditorSnapshot = {
  staffIndex: number
  name: string
  staffDatId: number
  staffPreferencesId: number
  hasRow: boolean
  rowCount: number
  values: PreferencesEditorValues
  labels: {
    favouriteClubs: [string, string, string]
    dislikedClubs: [string, string, string]
    favouriteStaff: [string, string, string]
    dislikedStaff: [string, string, string]
  }
}

function slotLabelClub(clubNames: Map<number, string>, id: number): string {
  if (id <= 0 || id === PREFERENCES_SLOT_NONE) return 'None'
  const name = clubNames.get(id)?.trim()
  return name ? name : `Club #${id}`
}

function slotLabelStaff(
  db: ParsedDatabase,
  id: number,
): string {
  if (id <= 0 || id === PREFERENCES_SLOT_NONE) return 'None'
  const idx = db.staff.findIndex((s) => s.id === id)
  if (idx >= 0) {
    const nm = staffDisplayName(db.staff[idx]!, db.firstNames, db.secondNames, db.commonNames).trim()
    if (nm) return nm
  }
  return `Staff #${id}`
}

function labelTripleClubs(
  clubNames: Map<number, string>,
  ids: [number, number, number],
): [string, string, string] {
  return [slotLabelClub(clubNames, ids[0]), slotLabelClub(clubNames, ids[1]), slotLabelClub(clubNames, ids[2])]
}

function labelTripleStaff(
  db: ParsedDatabase,
  ids: [number, number, number],
): [string, string, string] {
  return [slotLabelStaff(db, ids[0]), slotLabelStaff(db, ids[1]), slotLabelStaff(db, ids[2])]
}

export function buildPreferencesEditorSnapshot(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  staffIndex: number,
): PreferencesEditorSnapshot | { error: string } {
  const staff = db.staff[staffIndex]
  if (!staff) return { error: 'Invalid staff index.' }
  const staffBlock = findBlock(blocks, 'staff.dat')
  const prefBlock = findBlock(blocks, 'preferences.dat')
  if (!staffBlock) return { error: 'Archive is missing staff.dat.' }
  if (!prefBlock) return { error: 'Archive is missing Preferences.dat.' }

  const staffBase = staffBlock.position + staffIndex * STAFF_ROW_BYTES
  const staffPreferencesId = archiveBuffer.readInt32LE(staffBase + STAFF_PREFERENCES_ID_OFFSET)
  const { values, rowCount } = readPreferencesValuesForStaff(
    archiveBuffer,
    prefBlock.position,
    prefBlock.size,
    staffPreferencesId,
    staff.id,
  )

  const v = values ?? emptyPreferencesValues()

  return {
    staffIndex,
    name: staffDisplayName(staff, db.firstNames, db.secondNames, db.commonNames),
    staffDatId: staff.id,
    staffPreferencesId,
    hasRow: rowCount > 0,
    rowCount,
    values: v,
    labels: {
      favouriteClubs: labelTripleClubs(db.clubNames, v.favouriteClubs),
      dislikedClubs: labelTripleClubs(db.clubNames, v.dislikedClubs),
      favouriteStaff: labelTripleStaff(db, v.favouriteStaff),
      dislikedStaff: labelTripleStaff(db, v.dislikedStaff),
    },
  }
}

export function applyPreferencesPatchForStaff(
  buf: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  staffIndex: number,
  patch: PreferencesEditorValues,
  baseline: PreferencesEditorValues | null,
): { ok: true } | { ok: false; error: string } {
  if (baseline && preferencesValuesEqual(patch, baseline)) return { ok: true }

  const staff = db.staff[staffIndex]
  if (!staff) return { ok: false, error: 'Invalid staff index.' }
  const staffBlock = findBlock(blocks, 'staff.dat')
  const prefBlock = findBlock(blocks, 'preferences.dat')
  if (!staffBlock || !prefBlock) {
    return { ok: false, error: 'Archive is missing staff.dat or Preferences.dat.' }
  }

  const staffBase = staffBlock.position + staffIndex * STAFF_ROW_BYTES
  const staffPreferencesId = buf.readInt32LE(staffBase + STAFF_PREFERENCES_ID_OFFSET)

  const written = writePreferencesValuesForStaff(
    buf,
    prefBlock.position,
    prefBlock.size,
    staffPreferencesId,
    staff.id,
    patch,
  )
  if (!written.ok) return written
  return { ok: true }
}
