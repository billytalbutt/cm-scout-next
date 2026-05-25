import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GOLDEN_SAV } from '../../../fixtures/player-stats/goldenSavePath'
import { readArchiveBlock } from './parser'
import {
  INJURY_HISTORY_ROW_BYTES,
  INJURY_HISTORY_TYPE_OFF,
  buildInjuryByStaffIdMap,
  readInjuryStateFromHistoryBuf,
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

    const index = buildInjuryByStaffIdMap(file)
    expect(index.get(1)?.typeId).toBe(staff1?.injuryTypeId)
    expect(index.get(7)?.typeId).toBe(0)
  })
})
