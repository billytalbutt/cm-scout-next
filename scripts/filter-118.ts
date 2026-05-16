import { readFileSync } from 'node:fs'
import { readArchiveBlock, parseIndexDat } from '../src/main/database/parser.ts'

const file = readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav')
const db = parseIndexDat(file)
const buf = readArchiveBlock(file, 'player stats.dat')!

function allOff(id: number): number[] {
  const b = Buffer.allocUnsafe(4)
  b.writeInt32LE(id, 0)
  const out: number[] = []
  let p = 0
  while (true) {
    const i = buf.indexOf(b, p)
    if (i < 0) break
    out.push(i)
    p = i + 1
  }
  return out
}

const cands = allOff(118)
let inBand = 0
for (const c of cands) {
  const v4 = buf.readInt32LE(c + 4)
  if (v4 > 2000 && v4 < 5000) {
    inBand++
    if (inBand < 15) console.log('c', c, 'v4', v4)
  }
}
console.log('total', cands.length, 'inBand', inBand)
