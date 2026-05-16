import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const buf = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!
const off = 10614285
const club = 1165
for (let rel = -200; rel < 300; rel += 4) {
  const v = buf.readInt32LE(off + rel)
  if (v === club || v === 5451 || (v > 0 && v < 5000 && rel % 20 === 0)) {
    /* sparse */
  }
  if (v === club || v === 5451) console.log('rel', rel, 'v', v)
}
