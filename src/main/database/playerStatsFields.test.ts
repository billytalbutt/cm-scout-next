import { describe, expect, it } from 'vitest'
import {
  PLAYER_STATS_FIELD_MAP_V0,
  buildResearchPerCompetitionRows,
  decodePlayerStatsGridRow,
  parsePlayerStatsFromSave,
} from './playerStatsFields'
import { PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import type { PlayerRecord } from './types'

const F = PLAYER_STATS_FIELD_MAP_V0
const g = PLAYER_STATS_RESEARCH_GRID_V0

function writeEligibleRow(buf: Buffer, rowStart: number, playerDatId: number, plus4: number): void {
  buf.writeInt32LE(playerDatId, rowStart + g.idOffsetInRow)
  buf.writeInt32LE(plus4, rowStart + g.idOffsetInRow + 4)
}

describe('buildResearchPerCompetitionRows', () => {
  it('returns every grid row without deduping by competition id', () => {
    const buf = Buffer.alloc(g.headerBytes + 2 * g.stride, 0)
    const r0 = g.headerBytes
    const r1 = g.headerBytes + g.stride
    writeEligibleRow(buf, r0, 7, 2500)
    buf.writeInt32LE(100, r0 + 8)
    buf.writeUInt8(1, r0 + 44)
    buf.writeUInt8(9, r0 + 52)
    writeEligibleRow(buf, r1, 7, 2500)
    buf.writeInt32LE(100, r1 + 8)
    buf.writeUInt8(2, r1 + 44)
    buf.writeUInt8(9, r1 + 52)
    const a = decodePlayerStatsGridRow(buf, r0)!
    const b = decodePlayerStatsGridRow(buf, r1)!
    const rows = buildResearchPerCompetitionRows([a, b])
    expect(rows).toHaveLength(2)
  })
})

describe('parsePlayerStatsFromSave', () => {
  it('does not set grid layout on byPlayer from grid rows alone', () => {
    const buf = Buffer.alloc(g.headerBytes + g.stride, 0)
    const players = [{ id: 118 } as PlayerRecord]
    const staff = [{ player_id: 0, club_job_id: 1 }]
    const r0 = g.headerBytes
    writeEligibleRow(buf, r0, 118, 2500)
    buf.writeUInt8(9, r0 + 52)
    buf.writeUInt8(1, r0 + 53)
    const res = parsePlayerStatsFromSave(buf, players, staff, {
      clubDivisionCompIdByClubId: new Map([[1, 7]]),
    })
    expect(res.perCompByPlayerDatId.get(118)?.length).toBeGreaterThan(0)
    expect(res.byPlayerDatId.get(118)?.layout).not.toBe('gridV0')
  })
})
