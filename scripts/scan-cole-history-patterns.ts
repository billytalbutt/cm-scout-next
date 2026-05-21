import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readArchiveBlock } from '../src/main/database/parser.ts'
import { embeddedIdRecordStart } from '../src/main/database/playerStatsSummary.ts'

const SAVE =
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'

const PID = 5451
const ANCHOR = 10_612_525

function main(): void {
  const file = readFileSync(SAVE)
  const cacheDir = join(process.cwd(), '.cache')
  mkdirSync(cacheDir, { recursive: true })
  const histPath = join(cacheDir, 'player-stats-history.tmp')
  const statsPath = join(cacheDir, 'player-stats.dat')
  let hist = readArchiveBlock(file, 'player stats history.tmp')!
  let stats = readArchiveBlock(file, 'player stats.dat')!
  writeFileSync(histPath, hist)
  writeFileSync(statsPath, stats)

  const rec = embeddedIdRecordStart(stats, ANCHOR, PID)!
  console.log('embedded rec', rec, 'senior', stats.readUInt8(rec + 65), stats.readUInt8(rec + 66), stats.readUInt8(rec + 104), 'rat', stats.readUInt8(rec + 64) / 10)

  const needle = Buffer.alloc(4)
  needle.writeInt32LE(PID, 0)
  let p = 0
  const triples: { kind: string; abs: number; rel: number }[] = []
  while (p < hist.length - 3) {
    const i = hist.indexOf(needle, p)
    if (i === -1) break
    p = i + 4
    for (let d = -64; d <= 16; d++) {
      const b = i + d
      if (b < 0 || b + 2 >= hist.length) continue
      const a = hist.readUInt8(b)
      const g = hist.readUInt8(b + 1)
      const s = hist.readUInt8(b + 2)
      if (a === 1 && g === 0 && s === 1) triples.push({ kind: '1-0-1', abs: b, rel: d })
      if (a === 1 && g === 0 && s === 0) triples.push({ kind: '1-0-0', abs: b, rel: d })
      if (a === 3 && g === 0 && s === 1) triples.push({ kind: '3-0-1', abs: b, rel: d })
    }
  }
  console.log('\nTriples near player id (history.tmp):')
  for (const t of triples.slice(0, 30)) {
    const scope = hist.readInt32LE(t.abs - 4)
    const scope8 = hist.readInt32LE(t.abs - 8)
    console.log(`  ${t.kind} @${t.abs} (player${t.rel >= 0 ? '+' : ''}${t.rel}) i32@-4=${scope} i32@-8=${scope8}`)
  }
}

main()
