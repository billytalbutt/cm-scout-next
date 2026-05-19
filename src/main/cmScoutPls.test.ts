import { describe, expect, it } from 'vitest'
import { buildCmScoutPlsBuffer, PLS_MAX_PLAYERS, tcmDateBytesFromIso } from './cmScoutPls'

describe('cmScoutPls', () => {
  it('writes game-loadable header flag', () => {
    const buf = buildCmScoutPlsBuffer([
      {
        staffId: 42,
        firstNameId: 1,
        secondNameId: 2,
        commonNameId: 0,
        dobIso: '1990-06-15',
        yearOfBirth: 1990,
      },
    ])
    expect(buf.readUInt8(5)).toBe(0x01)
    expect(buf.readInt32LE(367)).toBe(1)
    expect(buf.readInt32LE(367 + 4 + 12)).toBe(42)
  })

  it('caps at 200 players', () => {
    const entries = Array.from({ length: 250 }, (_, i) => ({
      staffId: i + 1,
      firstNameId: 0,
      secondNameId: 0,
      commonNameId: 0,
      dobIso: null,
      yearOfBirth: 1995,
    }))
    const buf = buildCmScoutPlsBuffer(entries)
    expect(buf.readInt32LE(367)).toBe(PLS_MAX_PLAYERS)
  })

  it('encodes TCM date from ISO', () => {
    const b = tcmDateBytesFromIso('2000-01-01', 2000)
    expect(b.readInt16LE(0)).toBe(0)
    expect(b.readInt16LE(2)).toBe(2000)
  })
})
