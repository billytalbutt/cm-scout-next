import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const buf = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!
const off = 10614285
const seen = new Map<number, number[]>()
for (let rel = -256; rel < 256; rel += 4) {
  const v = buf.readInt32LE(off + rel)
  if (v === 0 || v === -1) continue
  if (v > -10 && v < 200) {
    const a = seen.get(v) ?? []
    a.push(rel)
    seen.set(v, a)
  }
}
for (const [k, arr] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
  if (arr.length <= 8) console.log(k, arr.join(','))
}
