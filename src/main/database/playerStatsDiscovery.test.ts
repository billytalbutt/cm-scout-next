import { describe, expect, it } from 'vitest'
import { PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import {
  bufferToHex,
  buildPlayerDiscoveryReport,
  candidateMatchesExpect,
  flattenCandidates,
  parseExpectedStats,
  plausibleU8Apps,
  plausibleU8Goals,
  plausibleU8RatingByte,
  probePlayerStatsHistoryTmp,
  scanU8CandidatesInGridRow,
  scanU8StatCandidatesInRange,
  STAFF_INT_APPS_ROW_OFFSET,
} from './statsDiscovery'

describe('statsDiscovery', () => {
  it('parseExpectedStats reads apps/goals/assists/rating', () => {
    const e = parseExpectedStats('apps=12,goals=3,assists=1,rating=7.1')
    expect(e).toEqual({ apps: 12, goals: 3, assists: 1, rating: 7.1 })
  })

  it('candidateMatchesExpect allows rating tolerance', () => {
    const exp = parseExpectedStats('rating=7.1')
    expect(
      candidateMatchesExpect(
        { source: 'player stats.dat:grid_v0', file: 'x', offset: 0, rating: 7.09 },
        exp,
      ),
    ).toBe(true)
    expect(
      candidateMatchesExpect(
        { source: 'player stats.dat:grid_v0', file: 'x', offset: 0, rating: 7.3 },
        exp,
      ),
    ).toBe(false)
  })

  it('plausible u8 filters', () => {
    expect(plausibleU8Apps(12)).toBe(true)
    expect(plausibleU8Apps(99)).toBe(false)
    expect(plausibleU8Goals(3)).toBe(true)
    expect(plausibleU8RatingByte(71)).toBe(true)
    expect(plausibleU8RatingByte(40)).toBe(false)
  })

  it('scanU8StatCandidatesInRange stays within bounds', () => {
    const buf = Buffer.alloc(32, 0)
    buf.writeUInt8(10, 5)
    buf.writeUInt8(2, 6)
    buf.writeUInt8(1, 7)
    buf.writeUInt8(71, 8)
    const cands = scanU8StatCandidatesInRange(buf, 0, buf.length, {
      source: 'player stats.dat:u8_scan',
      file: 'player stats.dat',
      playerDatId: 118,
      baseLabel: 'test',
    })
    expect(cands.length).toBeGreaterThan(0)
    expect(cands.every((c) => c.offset >= 0 && c.offset < buf.length)).toBe(true)
  })

  it('scanU8CandidatesInGridRow uses row-relative labels', () => {
    const g = PLAYER_STATS_RESEARCH_GRID_V0
    const buf = Buffer.alloc(g.headerBytes + g.stride, 0)
    const rowStart = g.headerBytes
    buf.writeInt32LE(7, rowStart + 8)
    buf.writeInt32LE(118, rowStart + 40)
    buf.writeUInt8(10, rowStart + 52)
    buf.writeUInt8(3, rowStart + 44)
    buf.writeUInt8(1, rowStart + 53)
    buf.writeUInt8(71, rowStart + 76)
    const cands = scanU8CandidatesInGridRow(buf, rowStart, 118)
    const appsCand = cands.find((c) => c.field?.includes('+52') && c.apps === 10)
    expect(appsCand).toBeDefined()
  })

  it('buildPlayerDiscoveryReport includes staff_history and grid row', () => {
    const g = PLAYER_STATS_RESEARCH_GRID_V0
    const statsBuf = Buffer.alloc(g.headerBytes + g.stride * 2, 0)
    const rowStart = g.headerBytes
    bufWriteGridRow(statsBuf, rowStart, 118, 10, 3, 1, 71, 7)

    const report = buildPlayerDiscoveryReport({
      savePath: 'test.sav',
      gameDateIso: '2001-08-01',
      blockInventory: [{ name: 'player stats.dat', size: statsBuf.length, present: true }],
      playerStatsBuf: statsBuf,
      playerStatsHistoryBuf: null,
      staffHistoryRows: [
        {
          id: 1,
          staffId: 152,
          year: 2001,
          clubId: 100,
          onLoan: 0,
          apps: 8,
          goals: 2,
        },
      ],
      staffHistorySource: 'sibling',
      players: [
        {
          name: 'Test Player',
          playerDatId: 118,
          staffId: 152,
          staffRowOffset: 0,
          club: 'Test FC',
          clubJobId: 100,
        },
      ],
      staffById: new Map([[152, { int_apps: 5, int_goals: 1 }]]),
      expected: { apps: 10, goals: 3, assists: 1, rating: 7.1 },
    })

    expect(report.players).toHaveLength(1)
    const pl = report.players[0]!
    expect(pl.staffHistory.rows).toHaveLength(1)
    expect(pl.staffDat?.apps).toBe(5)
    expect(pl.playerStatsDat?.gridRows.length).toBeGreaterThanOrEqual(1)
    expect(pl.expectMatches.length).toBeGreaterThan(0)
    const flat = flattenCandidates(report)
    expect(flat.some((c) => c.source === 'staff_history.dat')).toBe(true)
    expect(flat.some((c) => c.source === 'player stats.dat:grid_v0')).toBe(true)
  })

  it('probePlayerStatsHistoryTmp finds id and header', () => {
    const buf = Buffer.alloc(300, 0)
    buf.writeUInt32LE(42, 0)
    buf.writeUInt32LE(99, 4)
    buf.writeInt32LE(118, 120)
    const probe = probePlayerStatsHistoryTmp(buf, 118)
    expect(probe).not.toBeNull()
    expect(probe!.idHits).toContain(120)
    expect(probe!.headerUint32[0]).toBe(42)
    expect(probe!.windows.length).toBeGreaterThan(0)
  })

  it('bufferToHex returns lowercase hex', () => {
    const buf = Buffer.from([0xde, 0xad])
    expect(bufferToHex(buf, 0, 2)).toBe('dead')
  })

  it('staff int offsets match parser layout', () => {
    expect(STAFF_INT_APPS_ROW_OFFSET).toBe(34)
  })
})

function bufWriteGridRow(
  buf: Buffer,
  rowStart: number,
  playerId: number,
  apps: number,
  goals: number,
  assists: number,
  ratingU8: number,
  compId: number,
): void {
  buf.writeInt32LE(compId, rowStart + 8)
  buf.writeInt32LE(playerId, rowStart + 40)
  buf.writeUInt8(goals, rowStart + 44)
  buf.writeUInt8(apps, rowStart + 52)
  buf.writeUInt8(assists, rowStart + 53)
  buf.writeUInt8(ratingU8, rowStart + 76)
}
