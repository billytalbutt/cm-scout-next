/**
 * Find (player.dat id, club_comp id) co-occurrences — mimics "game must store both together".
 * Scans `player stats history.tmp` (47-byte row hint from CM0102Patcher) and windows in `player stats.dat`.
 *
 * Usage:
 *   npm run probe:player-comp-pairs -- <save.sav>
 *   npm run probe:player-comp-pairs -- <save.sav> --ids 5451
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseClubCompData, parseStaffCompData } from '../src/main/database/clubComp.ts'
import {
  defaultBlackburnClubCompIds,
  formatPlayerCompProbeReport,
  probePlayerCompPairsInSaveBlocks,
} from '../src/main/database/playerStatsHistoryProbe.ts'
import { parseIndexDat, readArchiveBlock, staffDisplayName } from '../src/main/database/parser.ts'
import { collectPlayerDatIdOccurrences } from '../src/main/database/playerStatsDat.ts'
import { inspectSeniorClubAnchorsForPlayer } from '../src/main/database/playerStatsSummary.ts'

const DEFAULT_SAVE =
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'

/** Known summary anchors from discovery run (Blackburn save). */
const KNOWN_ANCHORS: Record<number, number[]> = {
  5451: [10_612_525],
  27755: [10_485_268],
}

function main(): void {
  let path = process.argv[2]
  if (!path || path.startsWith('-')) path = DEFAULT_SAVE
  let ids = [118, 5451, 14922, 27755]
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === '--ids' && process.argv[i + 1]) {
      ids = process.argv[++i]!
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter(Number.isFinite)
    }
  }

  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const histBuf = readArchiveBlock(file, 'player stats history.tmp')
  const statsBuf = readArchiveBlock(file, 'player stats.dat')

  console.log(`\n=== Player + competition id probe — ${basename(path)} ===`)
  console.log(`gameDate: ${db.gameDateIso ?? '?'}`)
  console.log(
    `player stats history.tmp: ${histBuf?.length ?? 0} bytes (CM0102Patcher row hint: 47 / 0x2f)`,
  )
  console.log(`player stats.dat: ${statsBuf?.length ?? 0} bytes`)

  console.log('\n── Blackburn club competition ids (club_comp.dat) ──')
  for (const id of defaultBlackburnClubCompIds()) {
    const c = db.clubCompsById?.get(id)
    console.log(`  [${id}] ${c?.name ?? '?'}`)
  }

  const playerIds = new Set(db.players.map((p) => p.id))
  const occ =
    statsBuf && statsBuf.length
      ? collectPlayerDatIdOccurrences(statsBuf, playerIds)
      : new Map<number, number[]>()

  for (const pid of ids) {
    const staff = db.staff.find((s) => s.player_id >= 0 && db.players[s.player_id]?.id === pid)
    const name = staff
      ? staffDisplayName(staff, db.firstNames, db.secondNames, db.commonNames)
      : `player.dat ${pid}`

    const anchors = [
      ...(KNOWN_ANCHORS[pid] ?? []),
      ...(statsBuf
        ? inspectSeniorClubAnchorsForPlayer(statsBuf, pid, occ.get(pid)?.length ?? 0).map(
            (a) => a.anchor,
          )
        : []),
    ]
    const uniqueAnchors = [...new Set(anchors)].slice(0, 8)

    const result = probePlayerCompPairsInSaveBlocks({
      playerStatsHistoryBuf: histBuf,
      playerStatsBuf: statsBuf,
      playerDatId: pid,
      clubCompsById: db.clubCompsById,
      staffCompsById: db.staffCompsById,
      extraAnchorOffsets: uniqueAnchors,
    })

    console.log(formatPlayerCompProbeReport(name, pid, result))
  }

  console.log(`
Next: compare window hits to CM per-competition stats. If hits cluster at fixed player@+N comp@+M
in 47-byte rows, we have the game's record layout without decompiling.

Exe trace (optional): set CM0102_EXE to your cm0102.exe; community references comp_stats.CPP /
player_stats.cpp in CM3 source lineage; stats UI patch region ~0x570e5 (hide-stats patch).
`)
}

main()
