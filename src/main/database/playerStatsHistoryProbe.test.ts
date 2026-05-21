import { describe, expect, it } from 'vitest'
import {
  defaultBlackburnClubCompIds,
  scanWindowsAroundIdHits,
} from './playerStatsHistoryProbe'
import { buildCompetitionNamesById } from './competitionNames'

describe('playerStatsHistoryProbe', () => {
  it('finds player and comp id in same window', () => {
    const buf = Buffer.alloc(128, 0)
    const row = 40
    buf.writeInt32LE(5451, row)
    buf.writeInt32LE(7, row + 4)
    buf.writeUInt8(10, row + 8)
    buf.writeUInt8(3, row + 9)

    const names = buildCompetitionNamesById()
    const hits = scanWindowsAroundIdHits(
      buf,
      'player stats history.tmp',
      5451,
      new Set(defaultBlackburnClubCompIds()),
      names,
      32,
      10,
    )
    expect(hits.some((h) => h.competitionId === 7)).toBe(true)
  })
})
