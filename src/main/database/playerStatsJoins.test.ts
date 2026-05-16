import { describe, expect, it } from 'vitest'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  buildPlayerDatIdToStaffId,
  isEligibleResearchStatsRow,
  listEligibleRowStartsForPlayerDatId,
  rankInt32OffsetsAgainstIdSet,
  rankInt32OffsetsForStaffIdJoin,
  summarizeInt32AtOffsetAgainstClubAndStaffComp,
  summarizeRowsPerPlayerDatId,
} from './playerStatsJoins'

const g = { headerBytes: 0, stride: 128, idOffsetInRow: 40 }

function writeEligibleRow(buf: Buffer, rowStart: number, playerDatId: number, plus4: number): void {
  buf.writeInt32LE(playerDatId, rowStart + g.idOffsetInRow)
  buf.writeInt32LE(plus4, rowStart + g.idOffsetInRow + 4)
}

describe('isEligibleResearchStatsRow', () => {
  it('accepts id in set with plausible +4', () => {
    const buf = Buffer.alloc(256)
    writeEligibleRow(buf, 0, 501, 10_000)
    const ids = new Set([501])
    expect(isEligibleResearchStatsRow(buf, 0, g, ids)).toBe(true)
  })

  it('rejects bad +4', () => {
    const buf = Buffer.alloc(256)
    writeEligibleRow(buf, 0, 501, 50)
    expect(isEligibleResearchStatsRow(buf, 0, g, new Set([501]))).toBe(false)
  })
})

describe('rankInt32OffsetsAgainstIdSet', () => {
  it('finds planted club_comp id offset', () => {
    const buf = Buffer.alloc(3 * 128)
    const clubIds = new Set([10_001])
    const playerIds = new Set([501, 502])
    writeEligibleRow(buf, 0, 501, 10_000)
    buf.writeInt32LE(10_001, 0 + 12)
    writeEligibleRow(buf, 128, 502, 2000)
    buf.writeInt32LE(10_001, 128 + 12)
    writeEligibleRow(buf, 256, 501, 10_000)
    buf.writeInt32LE(10_001, 256 + 12)

    const ranked = rankInt32OffsetsAgainstIdSet(buf, g, playerIds, clubIds, 100)
    expect(ranked[0]?.rel).toBe(12)
    expect(ranked[0]?.matches).toBe(3)
  })
})

describe('rankInt32OffsetsForStaffIdJoin', () => {
  it('finds planted staff id offset', () => {
    const buf = Buffer.alloc(2 * 128)
    const playerIds = new Set([700])
    writeEligibleRow(buf, 0, 700, 10_000)
    buf.writeInt32LE(55_001, 0 + 24)
    const players = [{ id: 700 }]
    const staff = [{ id: 55_001, player_id: 0 }]
    const map = buildPlayerDatIdToStaffId(players, staff)
    const ranked = rankInt32OffsetsForStaffIdJoin(buf, g, playerIds, map, 50)
    expect(ranked[0]?.rel).toBe(24)
    expect(ranked[0]?.matches).toBe(1)
  })
})

describe('summarizeRowsPerPlayerDatId', () => {
  it('counts multiple rows per player', () => {
    const buf = Buffer.alloc(4 * 128)
    const playerIds = new Set([1, 2])
    writeEligibleRow(buf, 0, 1, 2000)
    writeEligibleRow(buf, 128, 1, 2000)
    writeEligibleRow(buf, 256, 2, 2000)
    const s = summarizeRowsPerPlayerDatId(buf, g, playerIds, 100)
    expect(s.eligibleRows).toBe(3)
    expect(s.counts.get(1)).toBe(2)
    expect(s.maxRowsForOnePlayer).toBe(2)
  })
})

describe('listEligibleRowStartsForPlayerDatId', () => {
  it('filters by player id', () => {
    const buf = Buffer.alloc(3 * 128)
    const ids = new Set([9, 10])
    writeEligibleRow(buf, 0, 9, 3000)
    writeEligibleRow(buf, 128, 10, 3000)
    const xs = listEligibleRowStartsForPlayerDatId(buf, g, ids, 9, 20)
    expect(xs).toEqual([0])
  })
})

describe('summarizeInt32AtOffsetAgainstClubAndStaffComp', () => {
  it('classifies values at one column offset', () => {
    const buf = Buffer.alloc(256)
    writeEligibleRow(buf, 0, 1, 2000)
    buf.writeInt32LE(100, 0 + 8)
    writeEligibleRow(buf, 128, 2, 2000)
    buf.writeInt32LE(200, 128 + 8)
    const club = new Set([100, 999])
    const staff = new Set([200, 999])
    const s = summarizeInt32AtOffsetAgainstClubAndStaffComp(buf, g, new Set([1, 2]), 8, club, staff, 50)
    expect(s.eligibleRows).toBe(2)
    expect(s.inClubOnly).toBe(1)
    expect(s.inStaffCompOnly).toBe(1)
    expect(s.inBoth).toBe(0)
  })
})

describe('PLAYER_STATS_RESEARCH_GRID_V0', () => {
  it('matches Phase A Blackburn hypothesis', () => {
    expect(PLAYER_STATS_RESEARCH_GRID_V0).toEqual({
      headerBytes: 60,
      stride: 128,
      idOffsetInRow: 40,
    })
  })
})
