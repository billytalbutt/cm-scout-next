import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  STAFF_HISTORY_ROW_BYTES,
  indexStaffHistoryByStaffId,
  loadStaffHistoryFromDataDirectories,
  parseStaffHistoryData,
} from './staffHistory'

function writeHistoryRow(
  buf: Buffer,
  o: number,
  row: { id: number; staffId: number; year: number; clubId: number; apps: number; goals: number },
): void {
  buf.writeInt32LE(row.id, o)
  buf.writeInt32LE(row.staffId, o + 4)
  buf.writeInt16LE(row.year, o + 8)
  buf.writeInt32LE(row.clubId, o + 10)
  buf.writeInt8(0, o + 14)
  buf.writeInt8(row.apps, o + 15)
  buf.writeInt8(row.goals, o + 16)
}

describe('loadStaffHistoryFromDataDirectories', () => {
  it('loads staff_history.dat from a sibling Data folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-scout-sh-'))
    const buf = Buffer.alloc(STAFF_HISTORY_ROW_BYTES * 2)
    writeHistoryRow(buf, 0, { id: 1, staffId: 152, year: 2004, clubId: 1165, apps: 10, goals: 2 })
    writeHistoryRow(buf, 17, { id: 2, staffId: 152, year: 2002, clubId: 500, apps: 5, goals: 1 })
    writeFileSync(join(dir, 'staff_history.dat'), buf)

    const loaded = loadStaffHistoryFromDataDirectories([dir])
    expect(loaded).not.toBeNull()
    expect(loaded!.rows.length).toBe(2)
    const byStaff = indexStaffHistoryByStaffId(loaded!.rows)
    expect(byStaff.get(152)?.length).toBe(2)
  })
})

describe('parseStaffHistoryData', () => {
  it('reads signed byte apps/goals', () => {
    const buf = Buffer.alloc(17)
    writeHistoryRow(buf, 0, { id: 0, staffId: 1, year: 2000, clubId: 2, apps: 10, goals: 2 })
    const [r] = parseStaffHistoryData(buf)
    expect(r!.apps).toBe(10)
    expect(r!.goals).toBe(2)
  })
})
