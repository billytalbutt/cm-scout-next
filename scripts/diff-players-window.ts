import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const oldP = 'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'
const newP = 'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'

function firstOff(buf: Buffer, id: number): number {
  const b = Buffer.allocUnsafe(4)
  b.writeInt32LE(id, 0)
  return buf.indexOf(b, 0, undefined)
}

function diffWindow(label: string, id: number, lo: number, hi: number): void {
  const bo = readArchiveBlock(readFileSync(oldP), 'player stats.dat')!
  const bn = readArchiveBlock(readFileSync(newP), 'player stats.dat')!
  const o = firstOff(bo, id)
  const n = firstOff(bn, id)
  console.log('\n', label, 'id', id, 'oldOff', o, 'newOff', n, 'delta', n - o)
  for (let rel = lo; rel < hi; rel++) {
    const a = bo[o + rel]
    const b = bn[n + rel]
    if (a !== b) console.log(rel, 'old', a, 'new', b, 'd', b! - a!)
  }
}

diffWindow('Joe Cole #0', 5451, -120, 120)
diffWindow('Kieron Dyer', 118, -120, 120)
