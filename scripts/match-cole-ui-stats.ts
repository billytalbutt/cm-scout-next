/**
 * Match Joe Cole CM History tab numbers (Blackburn save) against save bytes.
 * UI categories: Non Competitive, League, Cup, Continental, International, Senior Club.
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'
import {
  embeddedIdRecordStart,
  readSummaryStatsAtAnchor,
} from '../src/main/database/playerStatsSummary.ts'

const SAVE =
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'

const PLAYER_DAT_ID = 5451
const COLE_EMBEDDED_ANCHOR = 10_612_525

/** 2005/6 Blackburn — from CM History tab screenshot */
const UI_CURRENT = {
  nonCompetitive: { apps: 0, goals: 0, assists: 0, rating: null as number | null },
  league: { apps: 1, goals: 0, assists: 1, rating: 8.0 },
  cup: { apps: 1, goals: 0, assists: 0, rating: 6.0 },
  continental: { apps: 1, goals: 0, assists: 0, rating: 7.25 },
  international: { apps: 1, goals: 0, assists: 0, rating: 6.0 },
  seniorClub: { apps: 7, goals: 2, assists: 2, rating: 7.17 },
} as const

function findInt32(buf: Buffer, v: number, max = 300): number[] {
  const needle = Buffer.allocUnsafe(4)
  needle.writeInt32LE(v, 0)
  const out: number[] = []
  let p = 0
  while (out.length < max) {
    const i = buf.indexOf(needle, p)
    if (i === -1) break
    out.push(i)
    p = i + 1
  }
  return out
}

type Triple = { apps: number; goals: number; assists: number; rating: number | null }

function ratingU8(v: number): number | null {
  if (v < 50 || v > 100) return null
  return Math.round(v * 0.1 * 100) / 100
}

function matchTriple(
  buf: Buffer,
  base: number,
  relApps: number,
  relGoals: number,
  relAst: number,
  relRat: number | null,
  want: Triple,
): boolean {
  const apps = buf.readUInt8(base + relApps)
  const goals = buf.readUInt8(base + relGoals)
  const ast = buf.readUInt8(base + relAst)
  const rat = relRat != null ? ratingU8(buf.readUInt8(base + relRat)) : null
  if (apps !== want.apps || goals !== want.goals || ast !== want.assists) return false
  if (want.rating != null && rat != null && Math.abs(rat - want.rating) > 0.15) return false
  return true
}

function scanForTriples(buf: Buffer, source: string, want: Triple, label: string): void {
  const hits: string[] = []
  for (let base = 0; base < buf.length - 48; base++) {
    for (const [ra, rg, rs, rr] of tripleOffsets()) {
      if (!matchTriple(buf, base, ra, rg, rs, rr, want)) continue
      const hasPlayer = findInt32(buf.subarray(Math.max(0, base - 8), base + 48), PLAYER_DAT_ID, 2).length > 0
      if (!hasPlayer && source.includes('history')) continue
      hits.push(
        `  ${source} base@${base} apps+${ra} goals+${rg} ast+${rs}${rr != null ? ` rat+${rr}=${buf.readUInt8(base + rr)}` : ''}`,
      )
      if (hits.length >= 15) break
    }
    if (hits.length >= 15) break
  }
  console.log(`\n── ${label} (${want.apps}/${want.goals}/${want.assists} rat=${want.rating ?? '—'}) ──`)
  if (!hits.length) console.log('  (no exact u8 triple in brute scan)')
  else hits.forEach((h) => console.log(h))
}

function* tripleOffsets(): Generator<[number, number, number, number | null]> {
  for (let a = 0; a < 44; a++) {
    for (let g = 0; g < 44; g++) {
      if (g === a) continue
      for (let s = 0; s < 44; s++) {
        if (s === a || s === g) continue
        yield [a, g, s, null]
        for (let r = 0; r < 44; r++) {
          if (r === a || r === g || r === s) continue
          yield [a, g, s, r]
        }
      }
    }
  }
}

function probeHistoryRow47(buf: Buffer): void {
  const STRIDE = 47
  const compIds = new Set([7, 351, 352, 326, 328, 104])
  console.log('\n── player stats history.tmp 47-byte rows (player@+0 comp@+4?) ──')
  let n = 0
  for (let row = 0; row + STRIDE <= buf.length && n < 20; row += STRIDE) {
    if (buf.readInt32LE(row) !== PLAYER_DAT_ID) continue
    const comp = buf.readInt32LE(row + 4)
    if (!compIds.has(comp) && comp >= 0 && comp < 600) {
      /* maybe category enum not comp id */
    }
    const slice = buf.subarray(row, row + STRIDE)
    const u8 = [...slice].map((b) => b).join(',')
    console.log(`  row@${row} comp/i32@+4=${comp} u8=[${u8.slice(0, 80)}...]`)
    n++
  }
}

function main(): void {
  const file = readFileSync(SAVE)
  const stats = readArchiveBlock(file, 'player stats.dat')!
  const hist = readArchiveBlock(file, 'player stats history.tmp')!

  console.log('=== Joe Cole UI golden match ===')
  console.log(`player.dat id=${PLAYER_DAT_ID}  embedded anchor=${COLE_EMBEDDED_ANCHOR}`)

  const emb = embeddedIdRecordStart(stats, COLE_EMBEDDED_ANCHOR, PLAYER_DAT_ID)
  const sum = readSummaryStatsAtAnchor(stats, COLE_EMBEDDED_ANCHOR, PLAYER_DAT_ID, 2)
  console.log(`\nplayer stats.dat embedded rec@${emb ?? '—'}`)
  console.log(`  summary @ anchor: ${sum ? `${sum.apps}/${sum.goals}/${sum.assists}` : '—'}`)

  if (emb != null) {
    console.log('  rec bytes (128):')
    const rec = stats.subarray(emb, emb + 128)
    for (let i = 0; i < 128; i += 16) {
      const parts: string[] = []
      for (let j = 0; j < 16 && i + j < 128; j++) {
        const off = i + j
        const u = rec.readUInt8(off)
        parts.push(`${off}:${u}`)
      }
      console.log(`    ${parts.join(' ')}`)
    }
  }

  const coleHistOffs = findInt32(hist, PLAYER_DAT_ID, 30)
  console.log(`\nhistory.tmp player id hits: ${coleHistOffs.length} (first 8: ${coleHistOffs.slice(0, 8).join(', ')})`)

  for (const off of [4_533_9539, 4_533_9543, 4_533_9535]) {
    if (off + 47 > hist.length) continue
    console.log(`\n  window @${off}:`)
    for (let r = 0; r < 47; r += 4) {
      const i32 = r <= 43 ? hist.readInt32LE(off + r) : null
      console.log(`    +${r} u8=${hist.readUInt8(off + r)}${i32 != null ? ` i32=${i32}` : ''}`)
    }
  }

  probeHistoryRow47(hist)

  scanForTriples(stats, 'player stats.dat', UI_CURRENT.seniorClub, 'Senior club')
  scanForTriples(hist, 'player stats history.tmp', UI_CURRENT.seniorClub, 'Senior club (history)')
  scanForTriples(hist, 'player stats history.tmp', UI_CURRENT.league, 'League')
  scanForTriples(hist, 'player stats history.tmp', UI_CURRENT.cup, 'Cup')
}

main()
