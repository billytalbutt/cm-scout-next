import { describe, expect, it } from 'vitest'
import {
  cm2LongDiskToDisplay,
  cm2LongDisplayToDisk,
  cm2LongFromNormal,
  cm2LongToNormal,
  cashLooksPlainOnDisk,
  readCashDisplay,
  writeCashDisplay,
} from './cm2LongFormat'

describe('cm2LongFormat', () => {
  it('round-trips 21M and 100M packed cash', () => {
    const enc21 = cm2LongFromNormal(21_000)
    expect(cm2LongDiskToDisplay(enc21, 1000)).toBe(21_000_000)

    const enc100 = writeCashDisplay(100_000_000)
    expect(readCashDisplay(enc100)).toBe(100_000_000)
    expect(cm2LongDiskToDisplay(enc100, 1000)).toBe(100_000_000)
  })

  it('does not treat vanilla packed bytes as plain', () => {
    const packed21m = cm2LongFromNormal(21_000)
    expect(cashLooksPlainOnDisk(packed21m)).toBe(false)
    expect(readCashDisplay(packed21m)).toBe(21_000_000)
  })

  it('detects rare plain int32 tool edits', () => {
    expect(cashLooksPlainOnDisk(21_000_000)).toBe(true)
    expect(readCashDisplay(21_000_000)).toBe(21_000_000)
  })

  it('reads £2bn packed bytes as pounds not as plain int', () => {
    const raw = writeCashDisplay(2_000_000_000)
    expect(cashLooksPlainOnDisk(raw)).toBe(false)
    expect(readCashDisplay(raw)).toBe(2_000_000_000)
  })

  it('writes 100M packed even when prior on disk was misread as plain-shaped', () => {
    const packedPrior = cm2LongFromNormal(21_000)
    expect(cashLooksPlainOnDisk(packedPrior)).toBe(false)
    const written = writeCashDisplay(100_000_000, packedPrior)
    expect(readCashDisplay(written)).toBe(100_000_000)
    expect(written).not.toBe(100_000_000)
  })
})
