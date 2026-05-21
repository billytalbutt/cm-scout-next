/**
 * Quick check: Cole / Dyer / Tsigalko senior club + av. rating on golden save.
 */
import { readFileSync } from 'node:fs'
import { DEFAULT_GOLDEN_SAV } from '../fixtures/player-stats/goldenSavePath'
import { parseIndexDat } from '../src/main/database/parser'
import { buildSummaryAnchorIndex } from '../src/main/database/playerStatsSummary'
import {
  decodePlayerCurrentSeasonStats,
  buildPlayerCurrentSeasonIndex,
} from '../src/main/database/playerStatsCurrentSeason'

const PLAYERS = [
  { name: 'Joe Cole', id: 5451, apps: 6, goals: 1, assists: 2 },
  { name: 'Kieron Dyer', id: 118, apps: 8, goals: 0, assists: 1 },
  { name: 'Maxim Tsigalko', id: 27755, apps: 7, goals: 6, assists: 2 },
]

async function main() {
  const file = readFileSync(DEFAULT_GOLDEN_SAV)
  const db = await parseIndexDat(file, { staffHistorySearchDirs: [] })
  const anchorIdx = buildSummaryAnchorIndex(db.playerStatsDatBuf!, db.players)
  const index = buildPlayerCurrentSeasonIndex(
    db.players,
    db.staff,
    db.playerStatsHistoryBuf,
    db.playerStatsDatBuf,
    db.competitionNamesById ?? new Map(),
    db.staffCompHistoryByStaffId,
  )

  for (const exp of PLAYERS) {
    const anchor = anchorIdx.bestAnchorByPlayer.get(exp.id)
    const hits = anchorIdx.idHitCount.get(exp.id)
    const decoded = decodePlayerCurrentSeasonStats(
      exp.id,
      db.playerStatsHistoryBuf,
      db.playerStatsDatBuf,
      undefined,
      null,
      {
        statsBestAnchor: anchor,
        statsIdHitCount: hits,
        savePerformance: db.savePerformanceByPlayerDatId?.get(exp.id) ?? null,
      },
    )
    const senior = decoded.scopes.find((s) => s.key === 'seniorClub')
    const idx = index.get(exp.id)
    console.log(
      `\n${exp.name} (${exp.id}) anchor=${anchor} hits=${hits}`,
      `\n  decode senior: ${senior?.apps}/${senior?.goals}/${senior?.assists} rating=${senior?.averageRating}`,
      `\n  index senior: ${idx?.seniorApps}/${idx?.seniorGoals}/${idx?.seniorAssists} rating=${idx?.seniorAvgRating}`,
      `\n  expected: ${exp.apps}/${exp.goals}/${exp.assists}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
