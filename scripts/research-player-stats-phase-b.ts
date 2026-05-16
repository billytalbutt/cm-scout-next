/**
 * Phase B — join key correlation on structured `player stats.dat` rows.
 *
 * Usage:
 *   npx tsx scripts/research-player-stats-phase-b.ts <path-to.sav>
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseIndexDat, readArchiveBlock } from '../src/main/database/parser.ts'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  buildPlayerDatIdToStaffId,
  rankInt32OffsetsAgainstIdSet,
  rankInt32OffsetsForStaffIdJoin,
  summarizeInt32AtOffsetAgainstClubAndStaffComp,
  summarizeRowsPerPlayerDatId,
} from '../src/main/database/playerStatsJoins.ts'

function topLines(label: string, rows: { rel: number; matches: number; eligibleRows: number; rate: number }[], n: number): void {
  console.log(`\n${label}`)
  for (const r of rows.slice(0, n)) {
    console.log(
      `  rel=${r.rel}  matches=${r.matches}/${r.eligibleRows}  (${(r.rate * 100).toFixed(2)}%)`,
    )
  }
}

function main(): void {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx scripts/research-player-stats-phase-b.ts <save.sav>')
    process.exit(1)
  }

  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')
  const g = PLAYER_STATS_RESEARCH_GRID_V0

  console.log(`\n=== Phase B joins ${basename(path)} ===`)
  console.log(`grid: header=${g.headerBytes} stride=${g.stride} idOff=${g.idOffsetInRow}`)
  if (!statsBuf?.length) {
    console.log('(no player stats.dat)')
    process.exit(0)
  }

  const playerIds = new Set(db.players.map((p) => p.id))
  const staffMap = buildPlayerDatIdToStaffId(db.players, db.staff)

  const clubCompIds = new Set(db.clubCompsById?.keys() ?? [])
  const staffCompIds = new Set(db.staffCompsById?.keys() ?? [])

  const sum = summarizeRowsPerPlayerDatId(statsBuf, g, playerIds, 120_000)
  console.log('\nEligible structured rows (id + plausible +4):')
  console.log(`  total=${sum.eligibleRows}  distinctPlayers=${sum.distinctPlayers}  maxRowsOnePlayer=${sum.maxRowsForOnePlayer}`)

  if (clubCompIds.size > 0 && staffCompIds.size > 0) {
    console.log('\nDisambiguation int32@rel vs club_comp-only / staff_comp-only / both / neither:')
    for (const rel of [0, 4, 8, 32, 36, 72, 96, 100, 104]) {
      const d = summarizeInt32AtOffsetAgainstClubAndStaffComp(
        statsBuf,
        g,
        playerIds,
        rel,
        clubCompIds,
        staffCompIds,
        25_000,
      )
      console.log(
        `  rel=${rel}  clubOnly=${d.inClubOnly}  staffCompOnly=${d.inStaffCompOnly}  both=${d.inBoth}  neither=${d.inNeither}  (n=${d.eligibleRows})`,
      )
    }
  }

  if (clubCompIds.size > 0) {
    const clubRank = rankInt32OffsetsAgainstIdSet(statsBuf, g, playerIds, clubCompIds, 25_000)
    topLines('Top int32 offsets vs club_comp.dat ids', clubRank, 18)
  } else {
    console.log('\n(no club_comp.dat — skip club comp correlation)')
  }

  if (staffCompIds.size > 0) {
    const scRank = rankInt32OffsetsAgainstIdSet(statsBuf, g, playerIds, staffCompIds, 25_000)
    topLines('Top int32 offsets vs staff_comp.dat ids', scRank, 18)
  } else {
    console.log('\n(no staff_comp.dat — skip staff comp correlation)')
  }

  const staffJoin = rankInt32OffsetsForStaffIdJoin(statsBuf, g, playerIds, staffMap, 25_000)
  topLines('Top int32 offsets vs staff.id (linked player.dat row)', staffJoin, 18)

  const samplePlayers = [5451, 14922, 118]
  console.log('\nRow count sample (pinned player.dat ids from research scripts):')
  for (const pid of samplePlayers) {
    if (!playerIds.has(pid)) {
      console.log(`  id=${pid} (not in this save)`)
      continue
    }
    const n = sum.counts.get(pid) ?? 0
    console.log(`  id=${pid}  eligibleRows=${n}`)
  }
}

main()
