import { describe, expect, it } from 'vitest'
import {
  NONPLAYER_ROW_BYTES,
  nonPlayerForStaffLink,
  parseNonPlayerData,
} from './nonplayer'

function writeNpRow(
  buf: Buffer,
  rowIndex: number,
  opts: { id: number; coaching: number; judgement: number },
): void {
  const off = rowIndex * NONPLAYER_ROW_BYTES
  buf.writeInt32LE(opts.id, off)
  buf.writeUInt16LE(100, off + 4)
  buf.writeUInt16LE(120, off + 6)
  buf.writeUInt16LE(0, off + 8)
  buf.writeUInt16LE(0, off + 10)
  buf.writeUInt16LE(0, off + 12)
  buf.writeInt8(opts.coaching, off + 0x10)
  buf.writeInt8(opts.judgement, off + 0x17)
}

describe('nonPlayerForStaffLink', () => {
  it('uses staff non_player_id as row index, not the id field in that row', () => {
    const buf = Buffer.alloc(NONPLAYER_ROW_BYTES * 3)
    writeNpRow(buf, 0, { id: 999_001, coaching: 2, judgement: 3 })
    writeNpRow(buf, 1, { id: 999_002, coaching: 7, judgement: 5 })
    writeNpRow(buf, 2, { id: 88_888, coaching: 19, judgement: 20 })

    const rows = parseNonPlayerData(buf)
    expect(nonPlayerForStaffLink(2, rows)?.coaching).toBe(19)
    expect(nonPlayerForStaffLink(2, rows)?.judgement).toBe(20)
    expect(nonPlayerForStaffLink(2, rows)?.id).toBe(88_888)
    expect(rows[0].coaching).toBe(2)
    expect(rows[0].id).not.toBe(2)
  })
})
