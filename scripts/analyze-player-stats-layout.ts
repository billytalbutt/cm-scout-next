/**
 * Phase A — print `player stats.dat` header summary and fixed-row grid scan
 * (header + stride + id column offset) using known `player.dat` ids from the save.
 *
 * Usage:
 *   npx tsx scripts/analyze-player-stats-layout.ts <path-to.sav>
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseIndexDat, readArchiveBlock } from '../src/main/database/parser.ts'
import {
  scanPlayerStatsFixedRowLayout,
  scorePlayerStatsFixedRowGrid,
} from '../src/main/database/playerStatsLayout.ts'

function main(): void {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx scripts/analyze-player-stats-layout.ts <save.sav>')
    process.exit(1)
  }

  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')
  console.log(`\n=== ${basename(path)} ===`)
  console.log(`player stats.dat: ${statsBuf?.length ?? 0} bytes`)
  if (!statsBuf?.length) {
    process.exit(0)
  }

  const playerIds = new Set(db.players.map((p) => p.id))
  console.log(`player.dat rows (ids in set): ${playerIds.size}`)

  const t0 = Date.now()
  const res = scanPlayerStatsFixedRowLayout(statsBuf, playerIds, {
    headerMax: 128,
    headerStep: 4,
    strideMin: 80,
    strideMax: 288,
    strideStep: 4,
    idOffsetStep: 4,
    maxRowsToScan: 4000,
    minHitRate: 0.001,
    topK: 15,
  })
  console.log(`\nScan time: ${Date.now() - t0} ms`)

  console.log('\nFirst 16 uint32 LE (header-ish):')
  console.log(res.header.uint32First64.slice(0, 16).join(', '))

  console.log('\nTop fixed-row grid candidates (hitRate with id + plausible +4; slack = (len−header) mod stride):')
  for (const c of res.top) {
    console.log(
      `  header=${c.headerBytes} stride=${c.stride} idOff=${c.idOffsetInRow}  hits=${c.idHits}/${c.rowsConsidered} (${(c.hitRate * 100).toFixed(2)}%)  distinct=${c.distinctIdHits}  slack=${c.bodySlackBytes}`,
    )
  }

  if (res.best) {
    const refined = scorePlayerStatsFixedRowGrid(
      statsBuf,
      playerIds,
      res.best.headerBytes,
      res.best.stride,
      res.best.idOffsetInRow,
      50_000,
      { requirePlausiblePlus4: true },
    )
    console.log('\nBest candidate re-scored with maxRowsToScan=50000:')
    if (refined) {
      console.log(
        `  header=${refined.headerBytes} stride=${refined.stride} idOff=${refined.idOffsetInRow}  hits=${refined.idHits}/${refined.rowsConsidered} (${(refined.hitRate * 100).toFixed(2)}%)  distinct=${refined.distinctIdHits}  slack=${refined.bodySlackBytes}`,
      )
    }
  }
}

main()
