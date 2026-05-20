import { describe, expect, it } from 'vitest'
import {
  cm2LongDiskToDisplay,
  cm2LongDisplayToDisk,
  cm2LongFromNormal,
  cm2LongToNormal,
} from './cm2LongFormat'

describe('cm2LongFormat', () => {
  it('round-trips cash-style values (×1000 display)', () => {
    const encoded = cm2LongFromNormal(21_000)
    expect(cm2LongToNormal(encoded)).toBe(21_000)
    expect(cm2LongDiskToDisplay(encoded, 1000)).toBe(21_000_000)
    const back = cm2LongDisplayToDisk(99_000_000, 1000)
    expect(cm2LongDiskToDisplay(back, 1000)).toBe(99_000_000)
  })

  it('round-trips stadium capacity (scale 1)', () => {
    const encoded = cm2LongDisplayToDisk(40_000, 1)
    expect(cm2LongDiskToDisplay(encoded, 1)).toBe(40_000)
  })
})
