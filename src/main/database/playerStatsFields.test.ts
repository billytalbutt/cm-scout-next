import { describe, expect, it } from 'vitest'
import type { ClubCompRecord } from './clubComp'
import {
  PLAYER_STATS_FIELD_MAP_V0,
  buildResearchPerCompetitionRows,
  collectResearchGridRowsForPlayer,
  decodePlayerStatsGridRow,
  dedupeResearchRowsByCompetition,
  filterDecodedRowsWithResolvedCompetition,
  isResolvedCompetitionId,
  parsePlayerStatsFromSave,
} from './playerStatsFields'
import { PLAYER_STATS_RESEARCH_GRID_V0 } from './playerStatsJoins'
import type { PlayerRecord } from './types'

const F = PLAYER_STATS_FIELD_MAP_V0
const g = PLAYER_STATS_RESEARCH_GRID_V0

function clubComps(ids: number[]): Map<number, ClubCompRecord> {
  const m = new Map<number, ClubCompRecord>()
  for (const id of ids) {
    m.set(id, { id, name: `Comp ${id}`, shortName: `C${id}`, threeLetter: 'CMP', nationId: 0, reputation: 0 })
  }
  return m
}

function writeEligibleRow(buf: Buffer, rowStart: number, playerDatId: number, plus4: number): void {
  buf.writeInt32LE(playerDatId, rowStart + g.idOffsetInRow)
  buf.writeInt32LE(plus4, rowStart + g.idOffsetInRow + 4)
}

describe('isResolvedCompetitionId', () => {
  const comps = clubComps([7, 100])

  it('accepts ids in club_comp', () => {
    expect(isResolvedCompetitionId(7, 118, comps, undefined)).toBe(true)
  })

  it('rejects 0, player id collision, and unknown ids', () => {
    expect(isResolvedCompetitionId(0, 118, comps, undefined)).toBe(false)
    expect(isResolvedCompetitionId(118, 118, comps, undefined)).toBe(false)
    expect(isResolvedCompetitionId(999, 118, comps, undefined)).toBe(false)
  })
})

describe('filterDecodedRowsWithResolvedCompetition', () => {
  it('dedupes to one row per competition', () => {
    const comps = clubComps([100])
    const rows = [
      { rowStart: 60, playerDatId: 7, competitionId: 100, apps: 9, goals: 1, assists: 0, averageRating: null, tackles: null, passes: null, headers: null },
      { rowStart: 188, playerDatId: 7, competitionId: 100, apps: 40, goals: 2, assists: 0, averageRating: null, tackles: null, passes: null, headers: null },
    ]
    const out = filterDecodedRowsWithResolvedCompetition(rows, 7, comps, undefined)
    expect(out).toHaveLength(1)
    expect(out[0]!.apps).toBe(40)
  })
})

describe('buildResearchPerCompetitionRows', () => {
  it('drops rows without a resolved competition id', () => {
    const buf = Buffer.alloc(g.headerBytes + 2 * g.stride, 0)
    const r0 = g.headerBytes
    const r1 = g.headerBytes + g.stride
    const playerDatId = 7
    writeEligibleRow(buf, r0, playerDatId, 2500)
    buf.writeInt32LE(100, r0 + 8)
    buf.writeUInt8(1, r0 + 44)
    buf.writeUInt8(9, r0 + 52)
    writeEligibleRow(buf, r1, playerDatId, 2500)
    buf.writeInt32LE(0, r1 + 8)
    buf.writeUInt8(2, r1 + 44)
    buf.writeUInt8(5, r1 + 52)
    const a = decodePlayerStatsGridRow(buf, r0)!
    const b = decodePlayerStatsGridRow(buf, r1)!
    const comps = clubComps([100])
    const rows = buildResearchPerCompetitionRows([a, b], comps, undefined, playerDatId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.competitionId).toBe(100)
    expect(rows[0]!.apps).toBe(9)
  })
})

describe('collectResearchGridRowsForPlayer', () => {
  it('falls back to off-grid id anchors when no grid-aligned row exists', () => {
    const buf = Buffer.alloc(20_000, 0)
    const playerDatId = 5451
    const anchor = 10_000
    const rowStart = anchor - g.idOffsetInRow
    buf.writeInt32LE(playerDatId, anchor)
    buf.writeInt32LE(7, rowStart + F.competitionId.rel)
    buf.writeUInt8(12, rowStart + F.goals.rel)
    buf.writeUInt8(20, rowStart + F.apps.rel)
    buf.writeUInt8(3, rowStart + F.assists.rel)
    const comps = clubComps([7])
    const rows = collectResearchGridRowsForPlayer(buf, playerDatId, new Set([playerDatId]), g, undefined, {
      clubCompsById: comps,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.idAnchor).toBe(anchor)
    expect(rows[0]!.apps).toBe(20)
    expect(rows[0]!.competitionId).toBe(7)
  })
})

describe('parsePlayerStatsFromSave', () => {
  it('uses grid-style rows for off-grid players instead of heuristic-only table', () => {
    const buf = Buffer.alloc(15_000, 0)
    const players = [{ id: 5451 } as PlayerRecord]
    const staff = [{ player_id: 0, club_job_id: 1 }]
    const anchor = 8000
    const rowStart = anchor - g.idOffsetInRow
    buf.writeInt32LE(5451, anchor)
    buf.writeInt32LE(7, rowStart + F.competitionId.rel)
    buf.writeUInt8(8, rowStart + F.goals.rel)
    buf.writeUInt8(30, rowStart + F.apps.rel)
    const res = parsePlayerStatsFromSave(buf, players, staff, {
      clubDivisionCompIdByClubId: new Map([[1, 7]]),
      clubCompsById: clubComps([7]),
    })
    const rows = res.perCompByPlayerDatId.get(5451) ?? []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]!.competitionId).toBe(7)
    expect(rows.some((r) => r.competitionId === -2)).toBe(false)
  })

  it('does not set grid layout on byPlayer from grid rows alone', () => {
    const buf = Buffer.alloc(g.headerBytes + g.stride, 0)
    const players = [{ id: 118 } as PlayerRecord]
    const staff = [{ player_id: 0, club_job_id: 1 }]
    const r0 = g.headerBytes
    writeEligibleRow(buf, r0, 118, 2500)
    buf.writeInt32LE(7, r0 + 8)
    buf.writeUInt8(9, r0 + 52)
    buf.writeUInt8(1, r0 + 53)
    const res = parsePlayerStatsFromSave(buf, players, staff, {
      clubDivisionCompIdByClubId: new Map([[1, 7]]),
      clubCompsById: clubComps([7]),
    })
    expect(res.perCompByPlayerDatId.get(118)?.length).toBeGreaterThan(0)
    expect(res.byPlayerDatId.get(118)?.layout).not.toBe('gridV0')
  })
})

describe('dedupeResearchRowsByCompetition', () => {
  it('keeps grid-aligned row over off-grid for same comp', () => {
    const rows = [
      {
        rowStart: 10_000,
        playerDatId: 1,
        competitionId: 7,
        apps: 99,
        goals: 0,
        assists: null,
        averageRating: null,
        tackles: null,
        passes: null,
        headers: null,
      },
      {
        rowStart: g.headerBytes,
        playerDatId: 1,
        competitionId: 7,
        apps: 10,
        goals: 0,
        assists: null,
        averageRating: null,
        tackles: null,
        passes: null,
        headers: null,
      },
    ]
    const out = dedupeResearchRowsByCompetition(rows)
    expect(out).toHaveLength(1)
    expect(out[0]!.rowStart).toBe(g.headerBytes)
    expect(out[0]!.apps).toBe(10)
  })
})
