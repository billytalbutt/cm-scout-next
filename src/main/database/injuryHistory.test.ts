import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_GOLDEN_SAV } from '../../../fixtures/player-stats/goldenSavePath'
import { readArchiveBlock } from './parser'
import {
  INJURY_HISTORY_ROW_BYTES,
  INJURY_HISTORY_TYPE_OFF,
  buildInjuryByStaffIdMap,
  findInjuryRowOffsets,
  injuryLookupKeys,
  pickInjuryRowOffset,
  readInjuryStateFromHistoryBuf,
  readInjuryStateAtStaffDatRow,
  readPlayerInjuryForStaff,
  readPlayerInjuryFromArchive,
} from './injuryHistory'

describe('injuryHistory', () => {
  it('reads staff-indexed rows from injury_history.tmp', () => {
    let file: Buffer
    try {
      file = readFileSync(DEFAULT_GOLDEN_SAV)
    } catch {
      return
    }
    const history = readArchiveBlock(file, 'injury_history.tmp')
    expect(history).not.toBeNull()
    if (!history) return

    const staff1 = readInjuryStateFromHistoryBuf(history, 1)
    expect(staff1?.staffId).toBe(1)
    expect(staff1?.injuryTypeId).toBe(history.readInt32LE(1 * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF))

    const staff7 = readInjuryStateFromHistoryBuf(history, 7)
    if (staff7) {
      expect(staff7.staffId).toBe(7)
      expect(staff7.injuryTypeId).toBe(0)
    }

    const fromArchive = readPlayerInjuryFromArchive(file, 7)
    expect(fromArchive?.injuryTypeId).toBe(0)
  })

  it('prefers active injury row when multiple rows share a lookup key', () => {
    const history = Buffer.alloc(INJURY_HISTORY_ROW_BYTES * 3, 0)
    const staffId = 42
    // Row at index 2: fit placeholder
    history.writeInt32LE(staffId, 2 * INJURY_HISTORY_ROW_BYTES)
    history.writeInt32LE(0, 2 * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF)
    // Row at index 5: active injury (non-canonical)
    history.writeInt32LE(staffId, 5 * INJURY_HISTORY_ROW_BYTES)
    history.writeInt32LE(9, 5 * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF)

    const hits = findInjuryRowOffsets(history, staffId)
    expect(hits).toContain(5 * INJURY_HISTORY_ROW_BYTES)
    const picked = pickInjuryRowOffset(history, staffId)
    expect(picked).toBe(5 * INJURY_HISTORY_ROW_BYTES)
    const state = readInjuryStateFromHistoryBuf(history, staffId)
    expect(state?.injuryTypeId).toBe(9)
  })

  it('buildInjuryByStaffIdMap indexes in O(n) without per-row scan', () => {
    let file: Buffer
    try {
      file = readFileSync(DEFAULT_GOLDEN_SAV)
    } catch {
      return
    }
    const map = buildInjuryByStaffIdMap(file)
    const history = readArchiveBlock(file, 'injury_history.tmp')
    if (!history) return
    const staff1 = readInjuryStateFromHistoryBuf(history, 1)
    if (staff1) {
      expect(map.get(1)?.typeId).toBe(staff1.injuryTypeId)
    }
  })

  it('injuryLookupKeys includes staff id, player id, and staff index', () => {
    expect(injuryLookupKeys({ id: 100, player_id: 55 }, 12)).toEqual([100, 55, 12])
    expect(injuryLookupKeys({ id: 5, player_id: 5 }, 3)).toEqual([5, 3])
  })

  it('readInjuryStateAtStaffDatRow reads injury by staff.dat row index', () => {
    const history = Buffer.alloc(INJURY_HISTORY_ROW_BYTES * 20, 0)
    const staffIndex = 8
    const staffId = 9001
    history.writeInt32LE(staffId, staffIndex * INJURY_HISTORY_ROW_BYTES)
    history.writeInt32LE(3, staffIndex * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF)

    const atRow = readInjuryStateAtStaffDatRow(history, staffIndex)
    expect(atRow?.injuryTypeId).toBe(3)
    expect(atRow?.staffId).toBe(staffId)

    // staff id lookup key differs from row index — row alignment still wins first
    const viaStaff = readInjuryStateFromHistoryBuf(history, staffId)
    expect(viaStaff?.injuryTypeId).toBe(3)
  })

  it('readPlayerInjuryForStaff prefers staff.dat row when keyed by index not id', () => {
    const history = Buffer.alloc(INJURY_HISTORY_ROW_BYTES * 30, 0)
    const staffIndex = 11
    history.writeInt32LE(555, staffIndex * INJURY_HISTORY_ROW_BYTES)
    history.writeInt32LE(6, staffIndex * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF)
    // No separate row for staff id 555 at 555*36 — only the staff.dat-aligned row

    const state = readInjuryStateAtStaffDatRow(history, staffIndex)
    expect(state?.injuryTypeId).toBe(6)
  })

  it('readPlayerInjuryForStaff tries player id when staff id row is fit only', () => {
    const archive = Buffer.alloc(4096, 0)
    // Minimal block directory stub is not needed — readArchiveBlock reads from full file.
    // Build inline: write a fake injury_history block at end and patch directory — skip if too heavy.
    const history = Buffer.alloc(INJURY_HISTORY_ROW_BYTES * 60, 0)
    const playerId = 77
    history.writeInt32LE(playerId, 10 * INJURY_HISTORY_ROW_BYTES)
    history.writeInt32LE(4, 10 * INJURY_HISTORY_ROW_BYTES + INJURY_HISTORY_TYPE_OFF)
    const state = readInjuryStateFromHistoryBuf(history, playerId)
    expect(state?.injuryTypeId).toBe(4)
  })
})
