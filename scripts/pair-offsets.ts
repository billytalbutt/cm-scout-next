import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

function allOff(buf: Buffer, id: number): number[] {
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

const oldB = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'),
  'player stats.dat',
)!
const newB = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!

for (const id of [5451, 14922, 118]) {
  const o = allOff(oldB, id)
  const n = allOff(newB, id)
  console.log('\nid', id, 'old count', o.length, 'new count', n.length)
  for (const x of o.slice(0, 15)) {
    const match = n.find((y) => Math.abs(y - x) < 5000)
    console.log('  old', x, 'nearest new', match, 'delta', match != null ? match - x : null)
  }
}
