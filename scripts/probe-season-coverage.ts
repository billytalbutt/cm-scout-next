/**
 * Coverage: staff players with Senior club decode vs save summary on golden save.
 */
import { readFileSync } from 'node:fs'
import { DEFAULT_GOLDEN_SAV } from '../fixtures/player-stats/goldenSavePath'
import { parseIndexDat } from '../src/main/database/parser'
import { buildPlayerCurrentSeasonIndex } from '../src/main/database/playerStatsCurrentSeason'
import { buildSummaryAnchorIndex } from '../src/main/database/playerStatsSummary'

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
    db.savePerformanceByPlayerDatId,
  )

  let staffWithPlayer = 0
  let anchorHits = 0
  let savePerfHits = 0
  let indexHits = 0
  let seniorHits = 0
  let ratingHits = 0

  for (const s of db.staff) {
    const pid = db.players[s.player_id]?.id
    if (pid == null) continue
    staffWithPlayer++
    if (anchorIdx.bestAnchorByPlayer.has(pid)) anchorHits++
    if (db.savePerformanceByPlayerDatId?.has(pid)) savePerfHits++
    const idx = index.get(pid)
    if (idx) indexHits++
    if (idx && (idx.seniorApps > 0 || idx.seniorGoals > 0 || idx.seniorAssists > 0)) seniorHits++
    if (idx?.seniorAvgRating != null) ratingHits++
  }

  console.log('Staff with player.dat id:', staffWithPlayer)
  console.log('Summary anchor picked:', anchorHits)
  console.log('savePerformanceByPlayerDatId:', savePerfHits)
  console.log('currentSeason index entry:', indexHits)
  console.log('index senior A/G/A > 0:', seniorHits)
  console.log('index senior rating:', ratingHits)

  for (const id of [5451, 118, 27755]) {
    const idx = index.get(id)
    const sp = db.savePerformanceByPlayerDatId?.get(id)
    console.log(
      `\nid ${id}: index ${idx?.seniorApps}/${idx?.seniorGoals}/${idx?.seniorAssists} rat=${idx?.seniorAvgRating}`,
      `save ${sp?.apps}/${sp?.goals}/${sp?.assists} rat=${sp?.averageRating}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
