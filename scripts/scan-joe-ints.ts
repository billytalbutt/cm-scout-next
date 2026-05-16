import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const buf = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!
const off = 10614285
const rows: { rel: number; v: number }[] = []
for (let rel = -400; rel < 500; rel += 4) {
  const v = buf.readInt32LE(off + rel)
  if (v > 0 && v < 100000 && v !== 5451) rows.push({ rel, v })
}
rows.sort((a, b) => a.v - b.v)
for (const r of rows.slice(0, 40)) console.log(r.rel, r.v)
