import { readFileSync } from 'node:fs'
import { readArchiveBlock } from '../src/main/database/parser.ts'

const old = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'),
  'player stats.dat',
)!
const neu = readArchiveBlock(
  readFileSync('C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'),
  'player stats.dat',
)!

function scan(buf: Buffer, label: string, anchor: number, wa: number, wg: number, ws: number): void {
  const rec = anchor - 40
  console.log(`\n${label} anchor=${anchor} want ${wa}/${wg}/${ws}`)
  for (let rel = -20; rel <= 120; rel++) {
    const i = anchor + rel
    if (i < 0 || i >= buf.length) continue
    const v = buf.readUInt8(i)
    if (v === wa || v === wg || v === ws) console.log(`  anc+${rel}=${v}`)
  }
  for (let rel = 0; rel < 128; rel++) {
    const v = buf.readUInt8(rec + rel)
    if (v === wa || v === wg || v === ws) console.log(`  rec+${rel}=${v}`)
  }
}

scan(old, 'Tsig OLD', 10485268, 7, 6, 2)
scan(neu, 'Tsig NEW', 10487028, 10, 7, 2)
scan(old, 'Dyer OLD chosen', 6234724, 8, 0, 1)
scan(old, 'Dyer OLD alt', 2119638, 8, 0, 1)
scan(neu, 'Dyer NEW', 7425092, 11, 1, 2)

function triple(buf: Buffer, label: string, anchor: number): void {
  const r = (n: number) => buf.readUInt8(anchor + n)
  console.log(
    `${label} @${anchor}: +57=${r(57)} +53=${r(53)} +64=${r(64)} | +92=${r(92)} +96=${r(96)} | +110=${r(110)} +77=${r(77)} +78=${r(78)} | +18=${r(18)} +19=${r(19)} +20=${r(20)} | +76=${r(76)} +77g=${r(77)}`,
  )
}
console.log('\n--- candidate offsets ---')
triple(old, 'Tsig old', 10485268)
triple(neu, 'Tsig new', 10487028)
triple(old, 'Tsig old #2', 13974751)
triple(neu, 'Tsig new #2', 13976391)
triple(old, 'Dyer old slotB', 6234724)
triple(old, 'Dyer old alt', 2119638)
triple(neu, 'Dyer new', 7425092)

console.log('\n--- Tsigalko byte diffs (rel: old -> new) ---')
const ao = 10485268
const an = 10487028
for (let rel = 0; rel <= 100; rel++) {
  const a = old.readUInt8(ao + rel)
  const b = neu.readUInt8(an + rel)
  if (a !== b) console.log(`  +${rel}: ${a} -> ${b}`)
}
console.log('  +57 old/new', old.readUInt8(ao + 57), neu.readUInt8(an + 57))
console.log('  +92 old/new', old.readUInt8(ao + 92), neu.readUInt8(an + 92))
const needle = Buffer.alloc(4)
needle.writeInt32LE(27755, 0)
let pos = 0
while (true) {
  const i = old.indexOf(needle, pos)
  if (i < 0) break
  for (let rel = -30; rel <= 30; rel++) {
    const o = old.readUInt8(i + rel)
    const n = neu.readUInt8(i + rel + (an - ao))
    if (o === 7 && n === 10) console.log(`  7->10 near id@${i} rel ${rel}`)
  }
  pos = i + 1
}
for (let rel = 0; rel <= 200; rel++) {
  const a = old.readUInt8(ao + rel)
  const b = neu.readUInt8(an + rel)
  if (a !== 10 && b === 10) console.log(`  apps 10 appears: +${rel} was ${a} now ${b}`)
  if (a === 7 && b === 10) console.log(`  7->10: +${rel}`)
}
