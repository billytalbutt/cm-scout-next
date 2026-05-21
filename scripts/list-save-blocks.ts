import { existsSync, readFileSync } from 'node:fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import type { BlockInfo } from '../src/main/database/types'

function readBlocksDirectory(buf: Buffer): { compressed: boolean; blocks: BlockInfo[] } {
  let o = 0
  const marker = buf.readUInt32LE(o)
  o += 4
  const compressed = marker === 4
  o += 4
  const n = buf.readUInt32LE(o)
  o += 4
  const blocks: BlockInfo[] = []
  for (let i = 0; i < n; i++) {
    const position = buf.readInt32LE(o)
    o += 4
    const size = buf.readInt32LE(o)
    o += 4
    const nameBuf = buf.subarray(o, o + 260)
    o += 260
    const name = readLatin1String(nameBuf, 260)
    blocks.push({ position, size, name })
  }
  return { compressed, blocks }
}

const paths = [
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav',
]

for (const p of paths) {
  if (!existsSync(p)) {
    console.log('missing', p)
    continue
  }
  const buf = readFileSync(p)
  const { blocks, compressed } = readBlocksDirectory(buf)
  console.log('\n===', p, compressed ? 'compressed' : 'raw', '===')
  for (const b of blocks) {
    const n = b.name.replace(/\0+$/g, '').trim()
    if (!n) continue
    if (/staff|stat|comp|history|player/i.test(n)) {
      console.log(`${b.size.toString().padStart(10)}  ${n}`)
    }
  }
  const hist = blocks.find((b) => b.name.replace(/\0+$/g, '').trim().toLowerCase() === 'staff_history.dat')
  console.log('staff_history.dat embedded:', hist ? hist.size : 'none')
  const psh = blocks.find((b) => b.name.replace(/\0+$/g, '').trim().toLowerCase() === 'player stats history.tmp')
  if (psh) console.log('player stats history.tmp:', psh.size)
}
