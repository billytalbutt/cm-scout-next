import { describe, expect, it } from 'vitest'
import { applyPreferencesPatchForStaff, buildPreferencesEditorSnapshot } from './preferencesEditorSave'
import {
  PREFERENCES_ROW_BYTES,
  readPreferencesValuesAtRow,
} from './database/staffPreferencesDiskLayout'
import { PLAYER_ROW_BYTES, STAFF_ROW_BYTES } from './database/playerStaffDiskLayout'
import type { BlockInfo, ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'
import { PREFERENCES_SLOT_NONE } from '../shared/preferencesEditor'

const PLAYER_POS = 8
const STAFF_POS = PLAYER_POS + PLAYER_ROW_BYTES
const PREF_POS = STAFF_POS + STAFF_ROW_BYTES

function archiveWithPref(): Buffer {
  const pref = Buffer.alloc(PREFERENCES_ROW_BYTES, 0)
  pref.writeInt32LE(99, 0)
  pref.writeInt32LE(500, 16)
  pref.writeInt32LE(600, 40)
  const buf = Buffer.alloc(PREF_POS + PREFERENCES_ROW_BYTES, 0)
  buf.writeInt32LE(1, STAFF_POS)
  buf.writeInt32LE(0, STAFF_POS + 0x61)
  buf.writeInt32LE(99, STAFF_POS + 0x65)
  return Buffer.concat([buf, pref])
}

function db(): ParsedDatabase {
  const blocks: BlockInfo[] = [
    { name: 'player.dat', position: PLAYER_POS, size: PLAYER_ROW_BYTES, compressedSize: PLAYER_ROW_BYTES },
    { name: 'staff.dat', position: STAFF_POS, size: STAFF_ROW_BYTES, compressedSize: STAFF_ROW_BYTES },
    { name: 'Preferences.dat', position: PREF_POS, size: PREFERENCES_ROW_BYTES, compressedSize: PREFERENCES_ROW_BYTES },
  ]
  return {
    staff: [{ id: 1, player_id: 0, staff_preferences_id: 99 } as StaffRecord],
    players: [{ id: 1 } as PlayerRecord],
    firstNames: [''],
    secondNames: [''],
    commonNames: [''],
    clubNames: new Map([[500, 'Rival FC']]),
    blocks,
    compressed: false,
  } as ParsedDatabase
}

describe('buildPreferencesEditorSnapshot', () => {
  it('finds row when block name is Preferences.dat (case-insensitive findBlock)', () => {
    const buf = archiveWithPref()
    const snap = buildPreferencesEditorSnapshot(buf, db().blocks, db(), 0)
    expect('error' in snap).toBe(false)
    if ('error' in snap) return
    expect(snap.hasRow).toBe(true)
    expect(snap.values.dislikedClubs[0]).toBe(500)
    expect(snap.labels.dislikedClubs[0]).toBe('Rival FC')
  })
})

describe('applyPreferencesPatchForStaff', () => {
  it('writes all duplicate rows and clear unhappiness can run after', () => {
    const buf = archiveWithPref()
    const database = db()
    const patch = {
      favouriteClubs: [PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE] as [
        number,
        number,
        number,
      ],
      dislikedClubs: [PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE] as [
        number,
        number,
        number,
      ],
      favouriteStaff: [PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE] as [
        number,
        number,
        number,
      ],
      dislikedStaff: [PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE, PREFERENCES_SLOT_NONE] as [
        number,
        number,
        number,
      ],
    }
    const base = readPreferencesValuesAtRow(buf, PREF_POS)
    const r = applyPreferencesPatchForStaff(buf, database.blocks, database, 0, patch, base)
    expect(r.ok).toBe(true)
    expect(buf.readInt32LE(PREF_POS + 16)).toBe(PREFERENCES_SLOT_NONE)
    expect(buf.readInt32LE(PREF_POS + 40)).toBe(PREFERENCES_SLOT_NONE)
  })
})
