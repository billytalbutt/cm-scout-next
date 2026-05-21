import { existsSync, readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser'

const sav =
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
if (!existsSync(sav)) {
  console.error('missing save', sav)
  process.exit(1)
}
const file = readFileSync(sav)
const buf = readArchiveBlock(file, 'player stats.dat')
if (!buf) throw new Error('no player stats.dat')
console.log('player stats.dat length', buf.length)
for (const stride of [12, 14, 16, 17, 20, 24, 32, 64, 128]) {
  const rem = buf.length % stride
  console.log(`stride ${stride}: rem=${rem} rows=${Math.floor(buf.length / stride)}`)
}

// sample first row as 16-byte struct: staffId?, compId?, apps, goals, assists, rating*100
const o = 0
console.log('\nfirst 64 bytes hex:', buf.subarray(0, 64).toString('hex'))
for (let i = 0; i < 4; i++) {
  const base = i * 16
  const staffId = buf.readInt32LE(base)
  const compId = buf.readInt32LE(base + 4)
  const apps = buf.readInt16LE(base + 8)
  const goals = buf.readInt16LE(base + 10)
  const ast = buf.readInt16LE(base + 12)
  const av = buf.readInt16LE(base + 14)
  console.log(`row${i} @${base}: staff=${staffId} comp=${compId} a=${apps} g=${goals} ast=${ast} av=${av}`)
}
