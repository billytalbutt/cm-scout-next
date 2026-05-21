/**
 * Find Joe Cole Senior club bytes (apps/goals/assists) near player.dat id anchors.
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const COLE_ID = 5451
const SAVES: [string, string][] = [
  ['Blackburn (Downloads)', 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'],
  ['new (Sep 10)', 'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'],
]

function allOffsets(buf: Buffer, id: number): number[] {
  const needle = Buffer.allocUnsafe(4)
  needle.writeInt32LE(id, 0)
  const out: number[] = []
  let pos = 0
  while (true) {
    const i = buf.indexOf(needle, pos)
    if (i === -1) break
    out.push(i)
    pos = i + 1
  }
  return out
}

function main(): void {
  for (const [label, path] of SAVES) {
    const buf = readArchiveBlock(readFileSync(path), 'player stats.dat')!
    console.log(`\n=== ${label} ===`)
    for (const anchor of allOffsets(buf, COLE_ID)) {
      console.log(`\nanchor @${anchor}  v4=${buf.readInt32LE(anchor + 4)}`)
      const rec = anchor - 40
      if (rec >= 0 && buf.readInt32LE(rec + 40) === COLE_ID) {
        console.log(`  record @${rec} (id @+40 matches)`)
      }
      for (const rel of [-27, -23, -22, -21, 44, 52, 53, 60, 61, 76, 77, 78, 91, 92, 93]) {
        const i = anchor + rel
        if (i >= 0 && i < buf.length) console.log(`  anchor${rel >= 0 ? '+' : ''}${rel} u8=${buf.readUInt8(i)}`)
      }
      if (rec >= 0) {
        for (const rel of [44, 52, 53, 60, 61, 76, 77, 78]) {
          console.log(`  rec+${rel} u8=${buf.readUInt8(rec + rel)}`)
        }
      }
      for (let rel = -64; rel <= 64; rel++) {
        const a = buf.readUInt8(anchor + rel)
        const g = buf.readUInt8(anchor + rel + 1)
        const ast = buf.readUInt8(anchor + rel + 2)
        if (a >= 7 && a <= 10 && g === 2 && ast === 2) {
          console.log(`  *** triple ${a}/${g}/${ast} at anchor${rel >= 0 ? '+' : ''}${rel}`)
        }
      }
      if (rec >= 0 && rec + 128 <= buf.length) {
        console.log('  record bytes (0-127) where u8 in 0..15:')
        const parts: string[] = []
        for (let rel = 0; rel < 128; rel++) {
          const v = buf.readUInt8(rec + rel)
          if (v <= 15) parts.push(`+${rel}=${v}`)
        }
        console.log('   ', parts.join(' '))
        for (let rel = 0; rel < 120; rel++) {
          const a = buf.readUInt8(rec + rel)
          if (a !== 8 && a !== 9) continue
          for (let d = -20; d <= 20; d++) {
            if (d === 0) continue
            const gi = rec + rel + d
            const ai = gi + 1
            if (ai >= buf.length) continue
            if (buf.readUInt8(gi) === 2 && buf.readUInt8(ai) === 2) {
              console.log(`  *** apps@rec+${rel}=${a}  goals/assists@rec+${rel + d}/${rel + d + 1}`)
            }
          }
        }
      }
    }
  }
}

main()
