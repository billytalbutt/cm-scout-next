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

  it('uses row index when plausible even if another row shares the same id value', () => {
    const buf = Buffer.alloc(NONPLAYER_ROW_BYTES * 3)
    writeNpRow(buf, 0, { id: 10, coaching: 2, judgement: 3 })
    writeNpRow(buf, 1, { id: 500, coaching: 9, judgement: 11 })
    writeNpRow(buf, 2, { id: 99, coaching: 19, judgement: 20 })

    const rows = parseNonPlayerData(buf)
    // Link 1 must resolve to row[1], not row where id===1.
    const np = nonPlayerForStaffLink(1, rows)
    expect(np?.coaching).toBe(9)
    expect(np?.id).toBe(500)
  })

  it('falls back to id match when row index points at an invalid sentinel row', () => {
    const buf = Buffer.alloc(NONPLAYER_ROW_BYTES * 3)
    writeNpRow(buf, 0, { id: 10, coaching: 2, judgement: 3 })
    writeNpRow(buf, 1, { id: 999, coaching: 7, judgement: 5 })
    writeNpRow(buf, 2, { id: 1, coaching: 9, judgement: 11 })

    const rows = parseNonPlayerData(buf)
    rows[1]!.coaching = -80
    rows[1]!.tactics = -80
    rows[1]!.judgement = -80
    rows[1]!.currentAbility = 40

    const np = nonPlayerForStaffLink(1, rows)
    expect(np?.coaching).toBe(9)
    expect(np?.id).toBe(1)
  })

  it('still links when some coaching bytes are mildly negative (common on real saves)', () => {
    const buf = Buffer.alloc(NONPLAYER_ROW_BYTES * 2)
    writeNpRow(buf, 1, { id: 10, coaching: 7, judgement: 11 })
    const rows = parseNonPlayerData(buf)
    rows[1]!.tactics = -4
    rows[1]!.manHandling = -1
    rows[1]!.coachingGks = 1

    const np = nonPlayerForStaffLink(1, rows)
    expect(np?.coaching).toBe(7)
    expect(np?.tactics).toBe(-4)
  })

  it('prefers higher-quality row when index and id both resolve', () => {
    const buf = Buffer.alloc(NONPLAYER_ROW_BYTES * 3)
    writeNpRow(buf, 0, { id: 100, coaching: 2, judgement: 3 })
    writeNpRow(buf, 1, { id: 999, coaching: 1, judgement: 1 })
    buf.writeUInt16LE(35, 1 * NONPLAYER_ROW_BYTES + 4)
    buf.writeInt8(2, 1 * NONPLAYER_ROW_BYTES + 0x21)
    writeNpRow(buf, 2, { id: 1, coaching: 7, judgement: 11 })
    buf.writeUInt16LE(185, 2 * NONPLAYER_ROW_BYTES + 4)
    buf.writeInt8(5, 2 * NONPLAYER_ROW_BYTES + 0x21)

    const rows = parseNonPlayerData(buf)
    const np = nonPlayerForStaffLink(1, rows)
    expect(np?.coaching).toBe(7)
    expect(np?.tactics).toBe(5)
    expect(np?.currentAbility).toBe(185)
  })
})
