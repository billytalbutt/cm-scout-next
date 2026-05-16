import { describe, expect, it } from 'vitest'
import { PLAYER_STATS_FIELD_MAP_V0, decodePlayerStatsGridRow, parsePlayerStatsFromSave } from './playerStatsFields'
import { PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import type { PlayerRecord } from './types'

const F = PLAYER_STATS_FIELD_MAP_V0
const g = PLAYER_STATS_RESEARCH_GRID_V0

function writeEligibleRow(buf: Buffer, rowStart: number, playerDatId: number, plus4: number): void {
  buf.writeInt32LE(playerDatId, rowStart + g.idOffsetInRow)
  buf.writeInt32LE(plus4, rowStart + g.idOffsetInRow + 4)
}

describe('PLAYER_STATS_FIELD_MAP_V0', () => {
  it('documents Blackburn paired-save offsets', () => {
    expect(PLAYER_STATS_FIELD_MAP_V0.goals.rel).toBe(44)
    expect(PLAYER_STATS_FIELD_MAP_V0.apps.rel).toBe(52)
    expect(PLAYER_STATS_FIELD_MAP_V0.assists.rel).toBe(53)
    expect(PLAYER_STATS_FIELD_MAP_V0.competitionId.rel).toBe(8)
  })
})

describe('decodePlayerStatsGridRow', () => {
  it('decodes goals/apps/assists from synthetic row', () => {
    const buf = Buffer.alloc(128, 0)
    writeEligibleRow(buf, 0, 118, 2000)
    buf.writeInt32LE(42, 8)
    buf.writeUInt8(0x22, F.goals.rel)
    buf.writeUInt8(0x18, F.apps.rel)
    buf.writeUInt8(0x09, F.assists.rel)
    const row = decodePlayerStatsGridRow(buf, 0)!
    expect(row.playerDatId).toBe(118)
    expect(row.competitionId).toBe(42)
    expect(row.goals).toBe(0x22)
    expect(row.apps).toBe(0x18)
    expect(row.assists).toBe(9)
  })

  it('matches Blackburn Dyer row deltas (+1 goals/apps/assists)', () => {
    const buf = Buffer.alloc(128, 0)
    writeEligibleRow(buf, 0, 118, 3000)
    buf.writeUInt8(0x22, 44)
    buf.writeUInt8(0x18, 52)
    buf.writeUInt8(0x09, 53)
    const a = decodePlayerStatsGridRow(buf, 0)!
    buf.writeUInt8(0x23, 44)
    buf.writeUInt8(0x19, 52)
    buf.writeUInt8(0x0a, 53)
    const b = decodePlayerStatsGridRow(buf, 0)!
    expect(b.goals! - a.goals!).toBe(1)
    expect(b.apps! - a.apps!).toBe(1)
    expect(b.assists! - a.assists!).toBe(1)
  })
})

describe('parsePlayerStatsFromSave', () => {
  it('builds per-comp rows and primary domestic pick', () => {
    const buf = Buffer.alloc(g.headerBytes + 2 * g.stride, 0)
    const players = [{ id: 7 } as PlayerRecord]
    const staff = [{ player_id: 0, club_job_id: 100 }]
    const r0 = g.headerBytes
    const r1 = g.headerBytes + g.stride
    writeEligibleRow(buf, r0, 7, 2500)
    buf.writeInt32LE(500, r0 + 8)
    buf.writeUInt8(2, r0 + 44)
    buf.writeUInt8(10, r0 + 52)
    buf.writeUInt8(1, r0 + 53)
    writeEligibleRow(buf, r1, 7, 2500)
    buf.writeInt32LE(999, r1 + 8)
    buf.writeUInt8(0, r1 + 44)
    buf.writeUInt8(1, r1 + 52)
    const res = parsePlayerStatsFromSave(buf, players, staff, {
      clubDivisionCompIdByClubId: new Map([[100, 500]]),
      clubCompsById: new Map([[500, { id: 500, name: 'Premier League', shortName: 'PL', threeLetter: 'PL', nationId: 1, reputation: 90 }]]),
    })
    expect(res.perCompByPlayerDatId.get(7)?.length).toBe(2)
    const primary = res.byPlayerDatId.get(7)
    expect(primary?.layout).toBe('gridV0')
    expect(primary?.competitionId).toBe(500)
    expect(primary?.apps).toBe(10)
  })
})
