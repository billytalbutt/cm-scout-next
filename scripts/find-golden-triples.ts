/**
 * Find byte offsets matching CM golden apps/goals/assists near player id anchors.
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const OLD = 'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'
const NEW =
  'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'

const TARGETS: {
  name: string
  id: number
  old: [number, number, number]
  new: [number, number, number]
}[] = [
  { name: 'Tsigalko', id: 27755, old: [7, 6, 2], new: [10, 7, 2] },
  { name: 'Dyer', id: 118, old: [8, 0, 1], new: [11, 1, 2] },
]

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

function scanRecord(
  label: string,
  buf: Buffer,
  id: number,
  want: [number, number, number],
): void {
  const [wa, wg, wst] = want
  console.log(`\n${label} id=${id} want ${wa}/${wg}/${wst}`)
  for (const anchor of allOffsets(buf, id)) {
    const v4 = buf.readInt32LE(anchor + 4)
    const rec = anchor - 40
    console.log(`  anchor@${anchor} v4=${v4} rec@${rec}`)
    const hits: string[] = []
    for (let base = rec; base <= anchor; base += base === rec ? 40 : 1) {
      const span = base === anchor ? 128 : 128
      const start = base === anchor ? anchor - 64 : rec
      const end = base === anchor ? anchor + 64 : rec + 128
      for (let i = Math.max(0, start); i < Math.min(buf.length - 2, end); i++) {
        const a = buf.readUInt8(i)
        const g = buf.readUInt8(i + 1)
        const s = buf.readUInt8(i + 2)
        if (a === wa && g === wg && s === wst) {
          const relRec = i - rec
          const relAnchor = i - anchor
          hits.push(`u8@${i} rec${relRec >= 0 && relRec < 128 ? '+' + relRec : relRec} anc${relAnchor >= 0 ? '+' + relAnchor : relAnchor}`)
        }
      }
    }
    if (hits.length) console.log('    TRIPLE:', [...new Set(hits)].join('; '))
    for (const rel of [13, 26, 30, 44, 52, 53, 60, 61, 76, 77, 78, 91, 92, 93]) {
      if (rec >= 0 && rec + rel < buf.length) {
        const v = buf.readUInt8(rec + rel)
        if (v <= 15 || rel >= 76) console.log(`    rec+${rel}=${v}`)
      }
      if (anchor + rel < buf.length) {
        const v = buf.readUInt8(anchor + rel)
        if (v <= 15 || rel >= 76) console.log(`    anc+${rel}=${v}`)
      }
    }
  }
}

function main(): void {
  const oldBuf = readArchiveBlock(readFileSync(OLD), 'player stats.dat')!
  const newBuf = readArchiveBlock(readFileSync(NEW), 'player stats.dat')!
  for (const t of TARGETS) {
    console.log(`\n======== ${t.name} ========`)
    scanRecord('OLD', oldBuf, t.id, t.old)
    scanRecord('NEW', newBuf, t.id, t.new)
  }
}

main()
