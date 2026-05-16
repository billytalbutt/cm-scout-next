import { describe, expect, it } from 'vitest'
import {
  PLAYER_STATS_FIELD_MAP_V0,
  buildMemberPerCompetitionRows,
  decodePlayerStatsGridRow,
  isBogusCompetitionLabel,
  isPlausibleGridStatRow,
  parsePlayerStatsFromSave,
  pickBestSeasonGridRow,
} from './playerStatsFields'
import { PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import type { PlayerRecord } from './types'

const F = PLAYER_STATS_FIELD_MAP_V0
const g = PLAYER_STATS_RESEARCH_GRID_V0

function writeEligibleRow(buf: Buffer, rowStart: number, playerDatId: number, plus4: number): void {
  buf.writeInt32LE(playerDatId, rowStart + g.idOffsetInRow)
  buf.writeInt32LE(plus4, rowStart + g.idOffsetInRow + 4)
}

describe('PLAYER_STATS_FIELD_MAP_V0', () => {
  it('uses goals at id+11 (rel 51), not magic dword low byte', () => {
    expect(F.goals.rel).toBe(51)
    expect(F.apps.rel).toBe(52)
    expect(F.assists.rel).toBe(53)
  })
})

describe('isBogusCompetitionLabel', () => {
  it('flags manager awards', () => {
    expect(isBogusCompetitionLabel('Portuguese Second League Manager of the Year')).toBe(true)
    expect(isBogusCompetitionLabel('English Premier League')).toBe(false)
  })
})

describe('decodePlayerStatsGridRow', () => {
  it('decodes goals at rel 51 separately from int32 at 44', () => {
    const buf = Buffer.alloc(128, 0)
    writeEligibleRow(buf, 0, 118, 2000)
    buf.writeUInt8(99, 44)
    buf.writeUInt8(1, 51)
    buf.writeUInt8(9, 52)
    buf.writeUInt8(1, 53)
    const row = decodePlayerStatsGridRow(buf, 0)!
    expect(row.goals).toBe(1)
    expect(row.apps).toBe(9)
    expect(row.assists).toBe(1)
  })

  it('rejects rows where goals exceed apps', () => {
    const row = {
      rowStart: 0,
      playerDatId: 1,
      competitionId: 7,
      apps: 9,
      goals: 35,
      assists: 1,
      averageRating: null,
      tackles: null,
      passes: null,
      headers: null,
    }
    expect(isPlausibleGridStatRow(row)).toBe(false)
  })
})

describe('pickBestSeasonGridRow', () => {
  it('prefers division comp and plausible stats over max-apps noise', () => {
    const rows = [
      {
        rowStart: 0,
        playerDatId: 118,
        competitionId: 0,
        apps: 40,
        goals: 35,
        assists: 10,
        averageRating: null,
        tackles: null,
        passes: null,
        headers: null,
      },
      {
        rowStart: 128,
        playerDatId: 118,
        competitionId: 7,
        apps: 9,
        goals: 1,
        assists: 1,
        averageRating: null,
        tackles: null,
        passes: null,
        headers: null,
      },
    ]
    const clubComps = new Map([
      [7, { id: 7, name: 'English Premier League', shortName: 'PL', threeLetter: 'PL', nationId: 1, reputation: 90 }],
    ])
    const best = pickBestSeasonGridRow(rows, 7, clubComps)!
    expect(best.competitionId).toBe(7)
    expect(best.apps).toBe(9)
    expect(best.goals).toBe(1)
  })
})

describe('buildMemberPerCompetitionRows', () => {
  it('synthesizes division row when int8 comp id never matches division', () => {
    const best = {
      rowStart: 0,
      playerDatId: 118,
      competitionId: 33,
      apps: 9,
      goals: 1,
      assists: 1,
      averageRating: null,
      tackles: null,
      passes: null,
      headers: null,
    }
    const clubComps = new Map([
      [7, { id: 7, name: 'English Premier League', shortName: 'PL', threeLetter: 'PL', nationId: 1, reputation: 90 }],
    ])
    const rows = buildMemberPerCompetitionRows([best], best, 118, 7, clubComps)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.competitionId).toBe(7)
    expect(rows[0]!.competitionName).toBe('English Premier League')
    expect(rows[0]!.apps).toBe(9)
    expect(rows[0]!.goals).toBe(1)
  })
})

describe('parsePlayerStatsFromSave', () => {
  it('primary uses division comp id for display', () => {
    const buf = Buffer.alloc(g.headerBytes + g.stride, 0)
    const players = [{ id: 118 } as PlayerRecord]
    const staff = [{ player_id: 0, club_job_id: 100 }]
    const r0 = g.headerBytes
    writeEligibleRow(buf, r0, 118, 2500)
    buf.writeInt32LE(33, r0 + 8)
    buf.writeUInt8(1, r0 + 51)
    buf.writeUInt8(9, r0 + 52)
    buf.writeUInt8(1, r0 + 53)
    const res = parsePlayerStatsFromSave(buf, players, staff, {
      clubDivisionCompIdByClubId: new Map([[100, 7]]),
      clubCompsById: new Map([
        [7, { id: 7, name: 'English Premier League', shortName: 'PL', threeLetter: 'PL', nationId: 1, reputation: 90 }],
      ]),
    })
    const primary = res.byPlayerDatId.get(118)
    expect(primary?.layout).toBe('gridV0')
    expect(primary?.competitionId).toBe(7)
    expect(primary?.apps).toBe(9)
    expect(primary?.goals).toBe(1)
    expect(res.perCompByPlayerDatId.get(118)?.[0]?.competitionName).toContain('Premier')
  })
})
