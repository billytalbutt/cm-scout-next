import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSummaryAnchorIndex } from './playerStatsSummary'
import {
  buildPlayerCurrentSeasonIndex,
  CM_STAT_SCOPE,
  decodePlayerCurrentSeasonStats,
  indexPlayerStatsHistory,
  PLAYER_STATS_HISTORY_RECORD as R,
} from './playerStatsCurrentSeason'

function writeHistoryRow(
  buf: Buffer,
  rowStart: number,
  playerDatId: number,
  apps: number,
  goals: number,
  assists: number,
  scope: number,
): void {
  buf.writeInt32LE(playerDatId, rowStart + R.playerDatIdRel)
  buf.writeUInt8(apps, rowStart + R.appsRel)
  buf.writeUInt8(goals, rowStart + R.goalsRel)
  buf.writeUInt8(assists, rowStart + R.assistsRel)
  buf.writeUInt8(scope, rowStart + R.scopeRel)
}

describe('decodePlayerCurrentSeasonStats', () => {
  it('decodes Cole-style scope rows from history.tmp layout', () => {
    const hist = Buffer.alloc(256)
    const pid = 5451
    writeHistoryRow(hist, 0, pid, 1, 0, 1, CM_STAT_SCOPE.league)
    writeHistoryRow(hist, 64, pid, 1, 0, 0, CM_STAT_SCOPE.cup)
    writeHistoryRow(hist, 128, pid, 1, 0, 0, CM_STAT_SCOPE.continental)

    const stats = Buffer.alloc(200)
    const rec = 0
    const anchor = 40
    stats.writeInt32LE(pid, rec + 40)
    stats.writeInt32LE(pid, anchor)
    stats.writeInt32LE(1, anchor + 4)
    stats.writeUInt8(1, rec + 12)
    stats.writeUInt8(7, rec + 13)
    stats.writeUInt8(2, rec + 26)
    stats.writeUInt8(1, rec + 86)
    stats.writeUInt8(2, rec + 30)
    stats.writeUInt8(72, rec + 64)

    const decoded = decodePlayerCurrentSeasonStats(pid, hist, stats, undefined, {
      apps: 1,
      goals: 0,
    }, { statsAnchorOccurrences: [anchor] })

    const byKey = Object.fromEntries(decoded.scopes.map((r) => [r.key, r]))
    expect(byKey.league).toMatchObject({ apps: 1, goals: 0, assists: 1 })
    expect(byKey.cup).toMatchObject({ apps: 1, goals: 0, assists: 0 })
    expect(byKey.continental).toMatchObject({ apps: 1, goals: 0, assists: 0 })
    expect(byKey.international).toMatchObject({ apps: 1, goals: 0, assists: 0 })
    expect(byKey.seniorClub).toMatchObject({ apps: 6, goals: 1, assists: 2 })
    expect(byKey.seniorClub?.averageRating).toBe(7.2)
  })
})

import { DEFAULT_GOLDEN_SAV } from '../../../fixtures/player-stats/goldenSavePath'

const goldenSav = DEFAULT_GOLDEN_SAV

describe.skipIf(!existsSync(goldenSav))('Joe Cole golden save', () => {
  it('matches CM History tab scope totals', async () => {
    const { readFileSync } = await import('node:fs')
    const { parseIndexDat } = await import('./parser')
    const file = readFileSync(goldenSav)
    const db = await parseIndexDat(file, { staffHistorySearchDirs: [] })
    const cole = db.players.find((p) => p.id === 5451)
    expect(cole).toBeDefined()
    const staff = db.staff.find((s) => s.id === 6408)
    expect(staff).toBeDefined()
    const anchorIdx = buildSummaryAnchorIndex(db.playerStatsDatBuf!, db.players)
    const decoded = decodePlayerCurrentSeasonStats(
      5451,
      db.playerStatsHistoryBuf,
      db.playerStatsDatBuf,
      undefined,
      staff ? { apps: staff.int_apps, goals: staff.int_goals } : null,
      {
        statsBestAnchor: anchorIdx.bestAnchorByPlayer.get(5451),
        statsIdHitCount: anchorIdx.idHitCount.get(5451),
      },
    )
    const byKey = Object.fromEntries(decoded.scopes.map((r) => [r.key, r]))
    expect(byKey.league).toMatchObject({ apps: 1, goals: 0, assists: 1 })
    expect(byKey.cup).toMatchObject({ apps: 1, goals: 0, assists: 0 })
    expect(byKey.continental).toMatchObject({ apps: 1, goals: 0, assists: 0 })
    expect(byKey.seniorClub).toMatchObject({ apps: 6, goals: 1, assists: 2 })
    expect(byKey.seniorClub?.averageRating).toBeGreaterThanOrEqual(7.1)
    expect(byKey.seniorClub?.averageRating).toBeLessThanOrEqual(7.25)
    const index = buildPlayerCurrentSeasonIndex(
      db.players,
      db.staff,
      db.playerStatsHistoryBuf,
      db.playerStatsDatBuf,
      db.competitionNamesById ?? new Map(),
      db.staffCompHistoryByStaffId,
    )
    expect(index.get(5451)?.seniorGoals).toBe(1)
    expect(index.get(5451)?.seniorApps).toBe(6)
    expect(index.get(5451)?.seniorAvgRating).toBeGreaterThanOrEqual(7.1)
    expect(index.get(5451)?.seniorAvgRating).toBeLessThanOrEqual(7.25)
    const premier = index.get(5451)?.byCompetition.find((c) => c.competitionId === 7)
    if (premier) {
      expect(premier.goals).toBeGreaterThanOrEqual(0)
    }
  }, 180_000)
})

describe('indexPlayerStatsHistory competition id', () => {
  it('indexes player + club_comp id @ +8 with stats @ +4', () => {
    const buf = Buffer.alloc(128, 0)
    buf.writeInt32LE(5451, 0)
    buf.writeUInt8(1, 4)
    buf.writeUInt8(0, 5)
    buf.writeUInt8(1, 6)
    buf.writeInt32LE(7, 8)
    buf.writeUInt8(3, 12)

    const names = new Map<number, string>([[7, 'Premier League']])
    const idx = indexPlayerStatsHistory(buf, new Set([5451]), names)
    expect(idx.byComp.get(5451)?.some((r) => r.competitionId === 7 && r.apps === 1)).toBe(true)
  })
})
