import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const paths = [
  'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav',
  'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav',
] as const
const id = 14922

function firstOffset(buf: Buffer, needle: number): number {
  const b = Buffer.allocUnsafe(4)
  b.writeInt32LE(needle, 0)
  return buf.indexOf(b, 0, undefined)
}

function dump(buf: Buffer, off: number, label: string): void {
  console.log(label, 'off=', off)
  for (let r = -96; r <= 128; r += 16) {
    const s = off + r
    if (s < 0) continue
    const line = buf.subarray(s, s + 16)
    console.log(r.toString().padStart(4), line.toString('hex'))
  }
}

for (const p of paths) {
  const file = readFileSync(p)
  const buf = readArchiveBlock(file, 'player stats.dat')
  if (!buf) {
    console.log('no block', p)
    continue
  }
  const off = firstOffset(buf, id)
  console.log('\n', p, 'len', buf.length, 'first', off)
  dump(buf, off, '')
}
