import { describe, expect, it } from 'vitest'
import type { PlayerRecord } from './types'
import {
  PLAYER_STATS_HEURISTIC_VERSION,
  collectPlayerDatIdOccurrences,
  decodePlayerStatsRowAtAnchor,
  detectPlayerStatsRowLayout,
  isHeuristicDecodedPlausible,
  parsePlayerSavePerformance,
  pickPlayerStatsAnchor,
} from './playerStatsDat'

function stubPlayer(id: number): PlayerRecord {
  return { id } as PlayerRecord
}

describe('PLAYER_STATS_HEURISTIC_VERSION', () => {
  it('is stable until offsets or pick rules change', () => {
    expect(PLAYER_STATS_HEURISTIC_VERSION).toBe(1)
  })
})

describe('detectPlayerStatsRowLayout + decodePlayerStatsRowAtAnchor', () => {
  it('zeroedPrefix: 8 zero bytes before id; +4 int32 in band; apps/assists at fixed rels', () => {
    const anchor = 16
    const buf = Buffer.alloc(130, 0xff)
    buf.fill(0, anchor - 8, anchor)
    buf.writeInt32LE(42, anchor)
    buf.writeInt32LE(2048, anchor + 4)
    buf.writeUInt8(9, anchor + 12)
    buf.writeUInt8(2, anchor + 106)

    expect(detectPlayerStatsRowLayout(buf, anchor, 42)).toBe('zeroedPrefix')
    expect(decodePlayerStatsRowAtAnchor(buf, anchor, 42)).toEqual({
      apps: 9,
      goals: 0,
      assists: 2,
      layout: 'zeroedPrefix',
    })
  })

  it('chainPrevId: int32 at anchor-8 is playerDatId-1; goals at +51', () => {
    const anchor = 40
    const buf = Buffer.alloc(120, 0x11)
    buf.writeInt32LE(49, anchor - 8)
    buf.writeInt32LE(50, anchor)
    buf.writeInt32LE(600_000, anchor + 4)
    buf.writeUInt8(11, anchor + 51)

    expect(detectPlayerStatsRowLayout(buf, anchor, 50)).toBe('chainPrevId')
    expect(decodePlayerStatsRowAtAnchor(buf, anchor, 50)).toEqual({
      apps: null,
      goals: 11,
      assists: null,
      layout: 'chainPrevId',
    })
  })

  it('default: not zeroed/chain; +4 in 500..250k; assists at +106', () => {
    const anchor = 24
    const buf = Buffer.alloc(140, 0x22)
    buf.writeUInt8(1, anchor - 1)
    buf.writeInt32LE(77, anchor)
    buf.writeInt32LE(10_000, anchor + 4)
    buf.writeUInt8(5, anchor + 106)

    expect(detectPlayerStatsRowLayout(buf, anchor, 77)).toBe('default')
    expect(decodePlayerStatsRowAtAnchor(buf, anchor, 77)).toEqual({
      apps: null,
      goals: null,
      assists: 5,
      layout: 'default',
    })
  })
})

describe('pickPlayerStatsAnchor', () => {
  it('prefers occurrence whose +4 lies in the tight band when multiple plausible', () => {
    const buf = Buffer.alloc(260, 0x33)
    const id = 5
    buf.writeInt32LE(id, 100)
    buf.writeInt32LE(10, 104)
    buf.writeInt32LE(id, 200)
    buf.writeInt32LE(3000, 204)

    const occ = [100, 200]
    expect(pickPlayerStatsAnchor(buf, id, occ)).toBe(200)
  })

  it('returns the only occurrence when length is 1', () => {
    const buf = Buffer.alloc(50)
    buf.writeInt32LE(9, 10)
    expect(pickPlayerStatsAnchor(buf, 9, [10])).toBe(10)
  })
})

describe('collectPlayerDatIdOccurrences', () => {
  it('lists every int32 offset matching a requested id', () => {
    const buf = Buffer.alloc(20)
    buf.writeInt32LE(1, 0)
    buf.writeInt32LE(2, 8)
    buf.writeInt32LE(1, 12)
    const m = collectPlayerDatIdOccurrences(buf, new Set([1]))
    expect(m.get(1)?.sort((a, b) => a - b)).toEqual([0, 12])
  })
})

describe('isHeuristicDecodedPlausible', () => {
  it('rejects out-of-range goals', () => {
    expect(
      isHeuristicDecodedPlausible({
        apps: 1,
        goals: 121,
        assists: 0,
        layout: 'default',
      }),
    ).toBe(false)
  })
})

describe('parsePlayerSavePerformance', () => {
  it('returns empty map for empty buffer', () => {
    expect(parsePlayerSavePerformance(Buffer.alloc(0), [stubPlayer(1)]).size).toBe(0)
  })
})
