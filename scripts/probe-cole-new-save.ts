/**
 * Probe Joe Cole 6/1/2 / 7.17 on Blackburn Uncompressed.sav (Downloads).
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'
import {
  decodePlayerCurrentSeasonStats,
  indexPlayerStatsHistory,
} from '../src/main/database/playerStatsCurrentSeason.ts'
import { collectPlayerDatIdOccurrences } from '../src/main/database/playerStatsDat.ts'
import {
  embeddedIdRecordStart,
  readSummaryStatsAtAnchor,
} from '../src/main/database/playerStatsSummary.ts'

const SAVE =
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const PID = 5451
const WANT = { apps: 6, goals: 1, assists: 2, rating: 7.17 }

function ratingFromU8(v: number): number | null {
  if (v < 50 || v > 100) return null
  return Math.round(v * 0.1 * 100) / 100
}

function main(): void {
  const file = readFileSync(SAVE)
  const stats = readArchiveBlock(file, 'player stats.dat')!
  const hist = readArchiveBlock(file, 'player stats history.tmp')!
  const staffBuf = readArchiveBlock(file, 'staff.dat')!
  for (let i = 0; i < staffBuf.length / 110; i++) {
    if (staffBuf.readInt32LE(i * 110) === 6408) {
      const base = i * 110
      console.log('staff int_apps/goals', staffBuf.readUInt8(base + 28), staffBuf.readUInt8(base + 29))
      break
    }
  }

  console.log('stats', stats.length, 'history', hist?.length ?? 0)

  const occ = collectPlayerDatIdOccurrences(stats, new Set([PID]))
  console.log('anchors', occ.get(PID))

  for (const anchor of occ.get(PID) ?? []) {
    const rec = embeddedIdRecordStart(stats, anchor, PID)
    console.log(`\nanchor ${anchor} rec@${rec} v4=${stats.readInt32LE(anchor + 4)}`)
    if (rec == null) continue
    for (let rel = 0; rel < 128; rel++) {
      const u = stats.readUInt8(rec + rel)
      if (u === WANT.apps || u === WANT.goals || u === WANT.assists) {
        /* noisy */
      }
    }
    const summary = readSummaryStatsAtAnchor(stats, anchor, PID, occ.get(PID)?.length ?? 2)
    console.log('  readSummaryStatsAtAnchor:', summary)

    const triples: [string, number, number, number, 'rec' | 'anchor'][] = [
      ['rec+13/+26/+30', 13, 26, 30, 'rec'],
      ['rec+65/+66/+104', 65, 66, 104, 'rec'],
      ['anchor+76/+77/+78', 76, 77, 78, 'anchor'],
      ['anchor+91/+92/+93', 91, 92, 93, 'anchor'],
      ['anchor+59/+60/+61', 59, 60, 61, 'anchor'],
      ['anchor+18/+19/+20', 18, 19, 20, 'anchor'],
      ['anchor+110/+77/+78', 110, 77, 78, 'anchor'],
    ]
    for (const [label, ra, rg, rs, base] of triples) {
      const b = base === 'rec' ? rec : anchor
      const a = stats.readUInt8(b + ra)
      const g = stats.readUInt8(b + rg)
      const s = stats.readUInt8(b + rs)
      if (a === WANT.apps && g === WANT.goals && s === WANT.assists) {
        console.log(`  MATCH ${label}: ${a}/${g}/${s}`)
        for (const rr of [64, 72, 63, 62, 61, 60, 59, 58]) {
          const rv = stats.readUInt8(rec + rr)
          const rat = ratingFromU8(rv)
          if (rat != null) console.log(`    rat rec+${rr} u8=${rv} -> ${rat}`)
        }
      }
      if (a <= 10 && (a > 0 || g > 0 || s > 0)) {
        console.log(`  ${label}: ${a}/${g}/${s}`)
      }
    }
    for (const rr of [64, 72, 63, 62]) {
      const rv = stats.readUInt8(rec + rr)
      const rat = ratingFromU8(rv)
      if (rat != null && Math.abs(rat - WANT.rating) < 0.05) {
        console.log(`  rating rec+${rr} u8=${rv} -> ${rat}`)
      }
    }
  }

  const hidx = indexPlayerStatsHistory(hist, new Set([PID]), new Map())
  console.log('\n── history index scopes ──', hidx.byScope.get(PID))
  console.log('── history index comp ──', hidx.byComp.get(PID))

  let intlApps = 0
  let intlGoals = 0
  for (let i = 0; i < staffBuf.length / 110; i++) {
    if (staffBuf.readInt32LE(i * 110) === 6408) {
      const base = i * 110
      intlApps = staffBuf.readUInt8(base + 28)
      intlGoals = staffBuf.readUInt8(base + 29)
      break
    }
  }
  const decoded = decodePlayerCurrentSeasonStats(
    PID,
    null,
    stats,
    hidx.byScope,
    { apps: intlApps, goals: intlGoals },
    { statsAnchorOccurrences: occ.get(PID) },
  )
  console.log('\n── decodePlayerCurrentSeasonStats senior ──', decoded.seniorClub)

  const needle = Buffer.alloc(4)
  needle.writeInt32LE(PID, 0)
  let p = 0
  let nh = 0
  console.log('\n── history rows (stride 47, player @+2) ──')
  const stride = 47
  const scopeRows: { row: number; apps: number; goals: number; assists: number; scope: number }[] = []
  for (let row = 0; row + stride <= hist.length; row += stride) {
    if (hist.readInt32LE(row + 2) !== PID) continue
    const apps = hist.readUInt8(row + 4)
    const goals = hist.readUInt8(row + 5)
    const assists = hist.readUInt8(row + 6)
    const scope = hist.readUInt8(row + 12)
    if (apps > 20 || goals > 15 || assists > 15) continue
    scopeRows.push({ row, apps, goals, assists, scope })
  }
  console.log(scopeRows)
  const sum = scopeRows.reduce(
    (t, r) => ({ a: t.a + r.apps, g: t.g + r.goals, s: t.s + r.assists }),
    { a: 0, g: 0, s: 0 },
  )
  console.log('sum apps/goals/ast', sum)

  console.log('\n── raw history id alignments (first 12) ──')
  while (nh < 12) {
    const i = hist.indexOf(needle, p)
    if (i === -1) break
    p = i + 1
    const mod = i % 47
    const apps0 = hist.readUInt8(i + 4)
    const apps20 = i + 20 <= hist.length ? hist.readUInt8(i + 24) : 0
    console.log(
      `  @${i} mod47=${mod} i32@0=${hist.readInt32LE(i)} @+4=${hist.readInt32LE(i + 4)} u8+4..6=${apps0}/${hist.readUInt8(i + 5)}/${hist.readUInt8(i + 6)} @+20 pid? ${hist.readInt32LE(i + 20)} +24..26=${apps20}/${hist.readUInt8(i + 25)}/${hist.readUInt8(i + 26)}`,
    )
    nh++
  }

  const rec = 10612485
  if (stats.readInt32LE(rec + 40) === PID) {
    console.log('\n── 128-byte record @10612485 ──')
    for (let i = 0; i < 128; i += 16) {
      const parts: string[] = []
      for (let j = 0; j < 16; j++) parts.push(`${i + j}:${stats.readUInt8(rec + i + j)}`)
      console.log(' ', parts.join(' '))
    }
    for (let i = 0; i < 126; i++) {
      if (
        stats.readUInt8(rec + i) === WANT.apps &&
        stats.readUInt8(rec + i + 1) === WANT.goals &&
        stats.readUInt8(rec + i + 2) === WANT.assists
      ) {
        console.log(`  WANT triple @ rec+${i}`)
      }
    }
    for (let i = 0; i < 128; i++) {
      const u = stats.readUInt8(rec + i)
      const r = ratingFromU8(u)
      if (r != null && Math.abs(r - WANT.rating) < 0.02) console.log(`  rating u8 rec+${i}=${u} -> ${r}`)
    }
    for (let i = 0; i < 127; i++) {
      const v = stats.readUInt16LE(rec + i)
      if (v >= 716 && v <= 718) console.log(`  u16 rec+${i}=${v} -> ${(v / 100).toFixed(2)}`)
    }
  }

  // scan stats for exact 6,1,2 u8 consecutive in window around anchors
  console.log('\n── brute 6,1,2 u8 near anchors ──')
  for (const anchor of occ.get(PID) ?? []) {
    for (let d = -48; d <= 48; d++) {
      const b = anchor + d
      if (b < 0 || b + 2 >= stats.length) continue
      if (
        stats.readUInt8(b) === 6 &&
        stats.readUInt8(b + 1) === 1 &&
        stats.readUInt8(b + 2) === 2
      ) {
        console.log(`  u8@${b} (anchor${d >= 0 ? '+' : ''}${d})`)
      }
    }
  }
}

main()
