import { describe, expect, it } from 'vitest'
import {
  CONTRACT_ROW_BYTES,
  syncContractSquadMirrorBytes,
} from './contractDiskLayout'

describe('syncContractSquadMirrorBytes', () => {
  it('writes squad status as int16 @ 70 and byte @ 79', () => {
    const buf = Buffer.alloc(CONTRACT_ROW_BYTES, 0)
    syncContractSquadMirrorBytes(buf, 0, { squadStatus: 2, squadNumber: 7 })
    expect(buf.readInt16LE(70)).toBe(2)
    expect(buf.readUInt8(72)).toBe(7)
    expect(buf.readUInt8(79)).toBe(2)
  })
})
