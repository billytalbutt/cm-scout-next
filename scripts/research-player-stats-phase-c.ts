/**
 * Phase C — correlate byte diffs (paired saves) with structured 128B rows.
 *
 * Usage:
 *   npx tsx scripts/research-player-stats-phase-c.ts <older.sav> <newer.sav>
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseIndexDat, readArchiveBlock } from '../src/main/database/parser.ts'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  listEligibleRowStartsForPlayerDatId,
} from '../src/main/database/playerStatsJoins.ts'

const PINNED = [118, 5451, 14922]

function rowBytes(buf: Buffer, rowStart: number, stride: number): Buffer {
  return buf.subarray(rowStart, rowStart + stride)
}

function main(): void {
  const oldPath = process.argv[2]
  const newPath = process.argv[3]
  if (!oldPath || !newPath) {
    console.error('Usage: npx tsx scripts/research-player-stats-phase-c.ts <older.sav> <newer.sav>')
    process.exit(1)
  }

  const g = PLAYER_STATS_RESEARCH_GRID_V0
  const oldFile = readFileSync(oldPath)
  const newFile = readFileSync(newPath)
  const oldDb = parseIndexDat(oldFile)
  const newDb = parseIndexDat(newFile)
  const oldBuf = readArchiveBlock(oldFile, 'player stats.dat')!
  const newBuf = readArchiveBlock(newFile, 'player stats.dat')!
  const playerIds = new Set(oldDb.players.map((p) => p.id))

  console.log(`\n=== Phase C field diffs ${basename(oldPath)} -> ${basename(newPath)} ===`)
  console.log(`grid stride=${g.stride} idOff=${g.idOffsetInRow}`)

  const relChangeCount = new Map<number, number>()
  const relSamples = new Map<number, { old: number; neu: number }[]>()

  for (const pid of PINNED) {
    const oldRows = listEligibleRowStartsForPlayerDatId(oldBuf, g, playerIds, pid, 200)
    const newRows = listEligibleRowStartsForPlayerDatId(newBuf, g, playerIds, pid, 200)
    console.log(`\nplayer.dat id=${pid} eligible rows old=${oldRows.length} new=${newRows.length}`)

    const pairs = Math.min(oldRows.length, newRows.length, 8)
    for (let i = 0; i < pairs; i++) {
      const o = oldRows[i]!
      const n = newRows[i]!
      const ob = rowBytes(oldBuf, o, g.stride)
      const nb = rowBytes(newBuf, n, g.stride)
      const diffs: { rel: number; old: number; neu: number }[] = []
      for (let rel = 0; rel < g.stride; rel++) {
        if (ob[rel] !== nb[rel]) {
          diffs.push({ rel, old: ob[rel]!, neu: nb[rel]! })
          relChangeCount.set(rel, (relChangeCount.get(rel) ?? 0) + 1)
          const list = relSamples.get(rel) ?? []
          if (list.length < 5) list.push({ old: ob[rel]!, neu: nb[rel]! })
          relSamples.set(rel, list)
        }
      }
      console.log(`  pair #${i} oldRow@${o} newRow@${n} delta=${n - o} changedBytes=${diffs.length}`)
      for (const d of diffs.slice(0, 24)) {
        console.log(`    rel=${d.rel} 0x${d.old.toString(16)} -> 0x${d.neu.toString(16)} (${d.neu - d.old >= 0 ? '+' : ''}${d.neu - d.old})`)
      }
      if (diffs.length > 24) console.log(`    ... ${diffs.length - 24} more`)
    }
  }

  console.log('\nMost-changed byte offsets across pinned player row pairs (any pair):')
  const ranked = [...relChangeCount.entries()].sort((a, b) => b[1] - a[1])
  for (const [rel, n] of ranked.slice(0, 40)) {
    const samples = relSamples.get(rel) ?? []
    const samp = samples.map((s) => `${s.old}->${s.neu}`).join(', ')
    console.log(`  rel=${rel}  changes=${n}  samples: ${samp}`)
  }
}

main()
