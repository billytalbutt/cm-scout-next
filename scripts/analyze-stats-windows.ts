/**
 * Compare fixed windows around known `player.dat` row id occurrences in `player stats.dat`
 * between two saves (handles block size growth / insertion).
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const OLD =
  process.argv[2] ?? 'C:\\Users\\bitalb\\Downloads\\Game\\Game\\Blackburn Uncompressed.sav'
const NEW =
  process.argv[3] ??
  'C:\\Users\\bitalb\\Downloads\\Blackburn_Uncompressed_New\\Blackburn Uncompressed New.sav'

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

function hexSlice(buf: Buffer, off: number, len: number): string {
  const s = Math.max(0, off - 32)
  const e = Math.min(buf.length, off + len)
  return buf.subarray(s, e).toString('hex')
}

function compareWindows(
  label: string,
  oldBuf: Buffer,
  newBuf: Buffer,
  oldOff: number,
  newOff: number,
  span = 96,
): void {
  const half = Math.floor(span / 2)
  const o0 = oldOff - half
  const n0 = newOff - half
  const sliceOld = oldBuf.subarray(Math.max(0, o0), Math.min(oldBuf.length, oldOff + half))
  const sliceNew = newBuf.subarray(Math.max(0, n0), Math.min(newBuf.length, newOff + half))
  const L = Math.min(sliceOld.length, sliceNew.length)
  const diffs: { rel: number; o: number; n: number }[] = []
  for (let i = 0; i < L; i++) {
    if (sliceOld[i] !== sliceNew[i]) diffs.push({ rel: i - (oldOff - Math.max(0, o0)), o: sliceOld[i]!, n: sliceNew[i]! })
  }
  console.log(`\n## ${label}`)
  console.log(`oldOff=${oldOff} newOff=${newOff} delta=${newOff - oldOff}`)
  console.log(`byte diffs in window (${diffs.length}):`)
  for (const d of diffs.slice(0, 40)) {
    console.log(`  rel=${d.rel} old=0x${d.o.toString(16)} new=0x${d.n.toString(16)} (${d.n - d.o >= 0 ? '+' : ''}${d.n - d.o})`)
  }
  if (diffs.length > 40) console.log(`  ... ${diffs.length - 40} more`)
  console.log(`old hex @-32..+${half}:`)
  console.log(hexSlice(oldBuf, oldOff, half))
  console.log(`new hex:`)
  console.log(hexSlice(newBuf, newOff, half))
}

function main(): void {
  const oFile = readFileSync(OLD)
  const nFile = readFileSync(NEW)
  const oldS = readArchiveBlock(oFile, 'player stats.dat')
  const newS = readArchiveBlock(nFile, 'player stats.dat')
  if (!oldS || !newS) throw new Error('missing player stats.dat')
  console.log(`old size=${oldS.length} new size=${newS.length} delta=${newS.length - oldS.length}`)

  // Joe Cole player.dat id 5451 — two occurrences each; pair by order
  const jOld = allOffsets(oldS, 5451)
  const jNew = allOffsets(newS, 5451)
  console.log('\nJoe Cole player id 5451 offsets old:', jOld.join(', '))
  console.log('Joe Cole player id 5451 offsets new:', jNew.join(', '))
  for (let k = 0; k < Math.min(jOld.length, jNew.length); k++) {
    compareWindows(`Joe Cole id=5451 pair #${k}`, oldS, newS, jOld[k]!, jNew[k]!)
  }

  const xOld = allOffsets(oldS, 14922)
  const xNew = allOffsets(newS, 14922)
  console.log('\nXavi player id 14922 offsets old:', xOld.join(', '))
  console.log('Xavi player id 14922 offsets new:', xNew.join(', '))
  for (let k = 0; k < Math.min(xOld.length, xNew.length); k++) {
    compareWindows(`Xavi id=14922 pair #${k}`, oldS, newS, xOld[k]!, xNew[k]!)
  }

  // Kieron Dyer 118 — pick offsets where old/new differ by 0 or 1760 (stable pair)
  const dOld = allOffsets(oldS, 118)
  const dNew = allOffsets(newS, 118)
  console.log('\nKieron Dyer player id 118 old count', dOld.length, 'new count', dNew.length)
  for (const a of dOld) {
    const b = dNew.find((n) => n === a || n === a + 1760)
    if (b != null) compareWindows(`Dyer id=118 old=${a} new=${b}`, oldS, newS, a, b)
  }
}

main()
