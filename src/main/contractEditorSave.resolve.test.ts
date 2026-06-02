import { describe, expect, it } from 'vitest'
import { resolveContractRowAbsOffset } from './contractEditorSave'
import type { BlockInfo } from './database/types'

describe('resolveContractRowAbsOffset', () => {
  it('finds row keyed by staff.dat id when that differs from array index', () => {
    const header = Buffer.alloc(8)
    header.writeInt32LE(0, 0)
    header.writeInt32LE(1, 4)
    const row = Buffer.alloc(80, 0)
    row.writeInt32LE(6408, 0)
    const archive = Buffer.concat([header, row])
    const blocks: BlockInfo[] = [
      { name: 'contract.dat', position: 0, size: 88, compressedSize: 88 },
    ]
    const off = resolveContractRowAbsOffset(archive, blocks, 100, 6408)
    expect(off).toBe(8)
  })

  it('prefers staff.dat id over a different row keyed by staff index', () => {
    const header = Buffer.alloc(8)
    header.writeInt32LE(0, 0)
    header.writeInt32LE(2, 4)
    const rowByIndex = Buffer.alloc(80, 0)
    rowByIndex.writeInt32LE(100, 0)
    const rowById = Buffer.alloc(80, 0)
    rowById.writeInt32LE(6408, 0)
    const archive = Buffer.concat([header, rowByIndex, rowById])
    const blocks: BlockInfo[] = [
      { name: 'contract.dat', position: 0, size: 168, compressedSize: 168 },
    ]
    const off = resolveContractRowAbsOffset(archive, blocks, 100, 6408)
    expect(off).toBe(88)
  })
})
