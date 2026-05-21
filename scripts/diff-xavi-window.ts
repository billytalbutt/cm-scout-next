import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const oldP = 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const newP = 'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
const id = 14922

function firstOff(buf: Buffer): number {
  const b = Buffer.allocUnsafe(4)
  b.writeInt32LE(id, 0)
  return buf.indexOf(b, 0, undefined)
}

const bo = readArchiveBlock(readFileSync(oldP), 'player stats.dat')!
const bn = readArchiveBlock(readFileSync(newP), 'player stats.dat')!
const o = firstOff(bo)
const n = firstOff(bn)
const lo = -120
const hi = 120
console.log('anchor old', o, 'new', n, 'delta', n - o)
for (let rel = lo; rel < hi; rel++) {
  const a = bo[o + rel]
  const b = bn[n + rel]
  if (a !== b) console.log(rel, 'old', a, 'new', b, 'd', b! - a!)
}
