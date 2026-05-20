import { describe, expect, it } from 'vitest'
import {
  cm2LongDiskToDisplay,
  cm2LongDisplayToDisk,
  cm2LongFromNormal,
  cm2LongToNormal,
  readCashDisplay,
  writeCashDisplay,
} from './cm2LongFormat'

describe('cm2LongFormat', () => {
  it('round-trips cash-style values (×1000 display)', () => {
    const encoded = cm2LongFromNormal(21_000)
    expect(cm2LongToNormal(encoded)).toBe(21_000)
    expect(cm2LongDiskToDisplay(encoded, 1000)).toBe(21_000_000)
    const back = cm2LongDisplayToDisk(99_000_000, 1000)
    expect(cm2LongDiskToDisplay(back, 1000)).toBe(99_000_000)
  })

  it('detects plain int32 cash on disk', () => {
    expect(readCashDisplay(21_000_000)).toBe(21_000_000)
    const packed = cm2LongFromNormal(21_000)
    expect(readCashDisplay(packed)).toBe(21_000_000)
  })

  it('writes plain cash when prior raw was plain', () => {
    expect(writeCashDisplay(99_000_000, 21_000_000)).toBe(99_000_000)
    const packedPrior = cm2LongFromNormal(21_000)
    expect(writeCashDisplay(99_000_000, packedPrior)).toBe(cm2LongDisplayToDisk(99_000_000, 1000))
  })
})
