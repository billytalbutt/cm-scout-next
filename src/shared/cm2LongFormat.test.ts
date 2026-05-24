import { describe, expect, it } from 'vitest'
import {
  cm2LongDiskToDisplay,
  cm2LongDisplayToDisk,
  cm2LongFromNormal,
  cm2LongToNormal,
  cashLooksPlainOnDisk,
  isPackedCm2LongOnDisk,
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

  it('writes 100M packed when prior on disk was packed', () => {
    const packedPrior = cm2LongFromNormal(21_000)
    expect(cashLooksPlainOnDisk(packedPrior)).toBe(false)
    const written = writeCashDisplay(100_000_000, packedPrior)
    expect(readCashDisplay(written)).toBe(100_000_000)
    expect(written).not.toBe(100_000_000)
  })

  it('reads plain int32 pounds when bytes are not packed CM2', () => {
    const plainPrior = 21_000_000
    expect(cashLooksPlainOnDisk(plainPrior)).toBe(true)
    expect(readCashDisplay(plainPrior)).toBe(21_000_000)
  })

  it('writes plain pounds when save already stores plain int32 (e.g. £11m)', () => {
    const plain11m = 11_000_000
    expect(cashLooksPlainOnDisk(plain11m)).toBe(true)
    const written = writeCashDisplay(2_000_000_000, plain11m)
    expect(written).toBe(2_000_000_000)
    expect(cashLooksPlainOnDisk(written)).toBe(true)
    expect(readCashDisplay(written)).toBe(2_000_000_000)
  })

  it('reads progressed-save plain cash that false-positive as packed round-trip (e.g. £52m)', () => {
    expect(cashLooksPlainOnDisk(52_000_000)).toBe(true)
    expect(readCashDisplay(52_000_000)).toBe(52_000_000)
  })

  it('does not treat vanilla packed cash as plain', () => {
    const packed120m = writeCashDisplay(120_000_000)
    expect(cashLooksPlainOnDisk(packed120m)).toBe(false)
    expect(readCashDisplay(packed120m)).toBe(120_000_000)
    const written = writeCashDisplay(50_000_000, packed120m)
    expect(readCashDisplay(written)).toBe(50_000_000)
  })
})
