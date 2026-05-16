import { describe, expect, it } from 'vitest'
import {
  iteratePlayerStatsRowStarts,
  plausiblePlayerStatsInt32AtPlus4,
  scanPlayerStatsFixedRowLayout,
  scorePlayerStatsFixedRowGrid,
  summarizePlayerStatsHeader,
} from './playerStatsLayout'

describe('plausiblePlayerStatsInt32AtPlus4', () => {
  it('matches heuristic v1 bands', () => {
    expect(plausiblePlayerStatsInt32AtPlus4(2000)).toBe(true)
    expect(plausiblePlayerStatsInt32AtPlus4(600_000)).toBe(true)
    expect(plausiblePlayerStatsInt32AtPlus4(10_000)).toBe(true)
    expect(plausiblePlayerStatsInt32AtPlus4(100)).toBe(false)
    expect(plausiblePlayerStatsInt32AtPlus4(400_000)).toBe(false)
  })
})

describe('summarizePlayerStatsHeader', () => {
  it('reads uint32 LE for first 256 bytes', () => {
    const buf = Buffer.alloc(12)
    buf.writeUInt32LE(0x11223344, 0)
    buf.writeUInt32LE(7, 8)
    const h = summarizePlayerStatsHeader(buf)
    expect(h.byteLength).toBe(12)
    expect(h.uint32First64[0]).toBe(0x11223344)
    expect(h.uint32First64[2]).toBe(7)
  })
})

describe('scorePlayerStatsFixedRowGrid', () => {
  it('detects a synthetic fixed grid', () => {
    const headerBytes = 8
    const stride = 100
    const idOffset = 0
    const playerIds = new Set([10, 20, 30])
    const buf = Buffer.alloc(headerBytes + 3 * stride, 0)
    for (let r = 0; r < 3; r++) {
      buf.writeInt32LE((r + 1) * 10, headerBytes + r * stride + idOffset)
    }
    const c = scorePlayerStatsFixedRowGrid(buf, playerIds, headerBytes, stride, idOffset, 500, {
      requirePlausiblePlus4: false,
    })!
    expect(c.rowsConsidered).toBe(3)
    expect(c.idHits).toBe(3)
    expect(c.distinctIdHits).toBe(3)
    expect(c.hitRate).toBe(1)
  })
})

describe('scanPlayerStatsFixedRowLayout', () => {
  it('ranks the planted grid highest among noise', () => {
    const headerBytes = 4
    const stride = 120
    const idOffset = 8
    const rows = 60
    const buf = Buffer.alloc(headerBytes + rows * stride, 0xff)
    const ids = new Set<number>()
    for (let r = 0; r < rows; r++) {
      const id = 5000 + r
      ids.add(id)
      const rowStart = headerBytes + r * stride
      buf.writeInt32LE(id, rowStart + idOffset)
      buf.writeInt32LE(10_000, rowStart + idOffset + 4)
    }
    const res = scanPlayerStatsFixedRowLayout(buf, ids, {
      headerMax: 64,
      strideMin: 100,
      strideMax: 140,
      strideStep: 4,
      idOffsetStep: 4,
      maxRowsToScan: 200,
      minHitRate: 0.5,
      topK: 5,
      requirePlausiblePlus4: true,
    })
    expect(res.best).not.toBeNull()
    expect(res.best!.headerBytes).toBe(headerBytes)
    expect(res.best!.stride).toBe(stride)
    expect(res.best!.idOffsetInRow).toBe(idOffset)
    expect(res.best!.hitRate).toBe(1)
  })
})

describe('iteratePlayerStatsRowStarts', () => {
  it('steps by stride after header', () => {
    const buf = Buffer.alloc(50)
    const xs = [...iteratePlayerStatsRowStarts(buf, 10, 20)]
    expect(xs).toEqual([10, 30])
  })
})
