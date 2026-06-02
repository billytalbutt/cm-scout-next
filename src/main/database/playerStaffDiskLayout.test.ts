import { describe, expect, it } from 'vitest'
import { findBlock } from './playerStaffDiskLayout'
import type { BlockInfo } from './types'

describe('findBlock', () => {
  it('matches block names case-insensitively', () => {
    const blocks: BlockInfo[] = [
      { name: 'Preferences.dat', position: 100, size: 52, compressedSize: 52 },
    ]
    expect(findBlock(blocks, 'preferences.dat')?.position).toBe(100)
    expect(findBlock(blocks, 'Preferences.dat')?.position).toBe(100)
  })
})
