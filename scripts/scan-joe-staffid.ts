import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const buf = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!
const off = 10614285
for (let rel = -400; rel < 500; rel += 4) {
  const v = buf.readInt32LE(off + rel)
  if (v === 6408 || v === 152 || v === 17483 || v === 1165) console.log(rel, v)
}
