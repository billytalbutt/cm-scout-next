/**
 * Research: locate staff IDs for named players, scan `player stats.dat` for those IDs,
 * and optionally diff two uncompressed `.sav` archives (same block names).
 *
 * Usage:
 *   npx tsx scripts/research-player-stats-diff.ts <path-to.sav> [<path-to-older.sav>]
 *
 * Example:
 *   npx tsx scripts/research-player-stats-diff.ts "C:/path/before.sav" "C:/path/after.sav"
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseIndexDat, readArchiveBlock, staffDisplayName } from '../src/main/database/parser.ts'

/** Exact scouting targets (name + club) — avoids hundreds of "Cole"/"Xavi" false positives. */
const PINNED_PLAYERS: { displayName: string; clubIncludes: string }[] = [
  { displayName: 'Kieron Dyer', clubIncludes: 'Blackburn' },
  { displayName: 'Joe Cole', clubIncludes: 'Blackburn' },
  { displayName: 'Xavi', clubIncludes: 'Blackburn' },
]

function needleInt32LE(id: number): Buffer {
  const b = Buffer.allocUnsafe(4)
  b.writeInt32LE(id, 0)
  return b
}

/** Count non-overlapping occurrences is wrong for stride-1; we want all aligned hits at 4-byte boundary. */
function countAlignedInt32(buf: Buffer, id: number): number {
  let n = 0
  for (let o = 0; o + 4 <= buf.length; o += 4) {
    if (buf.readInt32LE(o) === id) n++
  }
  return n
}

/** First N offsets where int32 LE equals id (any alignment — for discovery). */
function findInt32Occurrences(buf: Buffer, id: number, max = 30): number[] {
  const needle = needleInt32LE(id)
  const out: number[] = []
  let pos = 0
  while (out.length < max) {
    const i = buf.indexOf(needle, pos)
    if (i === -1) break
    out.push(i)
    pos = i + 1
  }
  return out
}

function mergeDiffRanges(
  a: Buffer,
  b: Buffer,
): { start: number; end: number }[] {
  const len = Math.min(a.length, b.length)
  const ranges: { start: number; end: number }[] = []
  let i = 0
  while (i < len) {
    if (a[i] === b[i]) {
      i++
      continue
    }
    const start = i
    while (i < len && a[i] !== b[i]) i++
    ranges.push({ start, end: i - 1 })
  }
  return ranges
}

function hexPreview(buf: Buffer, off: number, radius: number): string {
  const s = Math.max(0, off - radius)
  const e = Math.min(buf.length, off + radius)
  return buf.subarray(s, e).toString('hex')
}

function summarizeSav(path: string): void {
  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const label = basename(path)

  console.log(`\n=== ${label} ===`)
  console.log(`gameDateIso: ${db.gameDateIso ?? '?'}`)
  console.log(`playerStatsDatPresent: ${db.playerStatsDatPresent}`)
  console.log(`staffHistoryParsed: ${db.staffHistoryParsed}`)

  const stats = readArchiveBlock(file, 'player stats.dat')
  const hist = readArchiveBlock(file, 'staff_history.dat')
  console.log(`player stats.dat size: ${stats?.length ?? 0}`)
  console.log(`staff_history.dat size: ${hist?.length ?? 0}`)

  const pinned: { staffId: number; playerRowId: number; name: string; club: string }[] = []
  for (const pin of PINNED_PLAYERS) {
    for (const s of db.staff) {
      if (s.player_id < 0 || s.player_id >= db.players.length) continue
      const name = staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
      if (name !== pin.displayName) continue
      const club = db.clubNames.get(s.club_job_id) ?? ''
      if (!club.includes(pin.clubIncludes)) continue
      const playerRow = db.players[s.player_id]
      pinned.push({
        staffId: s.id,
        playerRowId: playerRow?.id ?? -1,
        name,
        club,
      })
      break
    }
  }

  console.log('\nPinned players (exact name + club filter):')
  if (!pinned.length) {
    console.log('  (none matched — check spelling / club string in PINNED_PLAYERS)')
  } else {
    for (const m of pinned) {
      console.log(`  ${m.name} @ ${m.club}  staff_id=${m.staffId}  player.dat row id=${m.playerRowId}`)
    }
  }

  if (!stats?.length) {
    console.log('\n(No player stats.dat — nothing to scan.)')
    return
  }

  console.log('\nScan `player stats.dat` for staff_id and player.dat row id (int32 LE):')
  for (const m of pinned) {
    for (const label of ['staffId', 'playerRowId'] as const) {
      const id = label === 'staffId' ? m.staffId : m.playerRowId
      if (id < 0) continue
      const aligned = countAlignedInt32(stats, id)
      const occ = findInt32Occurrences(stats, id, 15)
      console.log(`  ${m.name}  ${label}=${id}  aligned4=${aligned}  anyAlignHits=${occ.length}`)
      if (occ.length) {
        console.log(`    offsets: ${occ.slice(0, 8).join(', ')}${occ.length > 8 ? ' …' : ''}`)
        for (const off of occ.slice(0, 2)) {
          console.log(`      @${off} mod4=${off % 4} hex: ${hexPreview(stats, off, 20)}`)
        }
      }
    }
  }
}

function diffArchives(pathOlder: string, pathNewer: string): void {
  const oldBuf = readFileSync(pathOlder)
  const newBuf = readFileSync(pathNewer)
  const blocks = ['player stats.dat', 'staff_history.dat', 'general.dat'] as const

  console.log(`\n=== DIFF (old → new) ${basename(pathOlder)}  →  ${basename(pathNewer)} ===`)

  for (const blockName of blocks) {
    const ba = readArchiveBlock(newBuf, blockName)
    const bb = readArchiveBlock(oldBuf, blockName)
    if (!ba || !bb) {
      console.log(`\n[${blockName}] missing in one file (new=${ba?.length ?? 0} old=${bb?.length ?? 0})`)
      continue
    }
    if (ba.length !== bb.length) {
      const insertDelta = ba.length - bb.length
      console.log(`\n[${blockName}] LENGTH new=${ba.length} old=${bb.length} (new−old=${insertDelta})`)
      if (blockName === 'player stats.dat' && Math.abs(insertDelta) < 500000) {
        const tries: { label: string; d: number }[] = [{ label: 'index-aligned', d: 0 }]
        if (insertDelta !== 0) {
          tries.push({ label: 'assume extra bytes at start of A', d: insertDelta })
          tries.push({ label: 'assume extra bytes at start of B', d: -insertDelta })
        }
        let best = { label: 'none', d: 0, pct: 0 }
        for (const t of tries) {
          const d = t.d
          let same = 0
          let L = 0
          if (d >= 0) {
            L = Math.min(80_000, bb.length, ba.length - d)
            for (let i = 0; i < L; i++) {
              if (ba[i + d] === bb[i]) same++
            }
          } else {
            const ad = -d
            L = Math.min(80_000, ba.length, bb.length - ad)
            for (let i = 0; i < L; i++) {
              if (ba[i] === bb[i + ad]) same++
            }
          }
          if (L <= 0) continue
          const pct = (same / L) * 100
          if (pct > best.pct) best = { label: t.label, d, pct }
        }
        console.log(
          `  Heuristic (up to 80k bytes): best "${best.label}" (shift=${best.d}) → ~${best.pct.toFixed(2)}% match.`,
        )
        console.log(
          `  Raw index-by-index range counts are misleading when the block size changes; use npm run research:stats-windows for anchored compares.`,
        )
      }
    }
    const ranges = mergeDiffRanges(ba, bb)
    console.log(`\n[${blockName}] changed byte ranges: ${ranges.length}`)
    const show = ranges.slice(0, 40)
    for (const r of show) {
      const len = r.end - r.start + 1
      console.log(
        `  ${r.start}-${r.end} (${len} bytes)  new:${hexPreview(ba, r.start, 16)}  old:${hexPreview(bb, r.start, 16)}`,
      )
    }
    if (ranges.length > 40) console.log(`  ... ${ranges.length - 40} more ranges`)
  }
}

function main(): void {
  const args = process.argv.slice(2).filter(Boolean)
  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/research-player-stats-diff.ts <save.sav> [<older-save.sav>]')
    process.exit(1)
  }
  summarizeSav(args[0]!)
  if (args[1]) {
    summarizeSav(args[1]!)
    /** args[0] = older save, args[1] = newer save */
    diffArchives(args[0]!, args[1]!)
  } else {
    console.log('\n(Pass a second path — the pre-match save — to print block-level diffs.)')
  }
}

main()
