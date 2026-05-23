/**
 * Find Pomaski on save and brute-match display formulas vs in-game profile.
 */
import { readFileSync } from 'fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import { NONPLAYER_ROW_BYTES } from '../src/main/database/nonplayer'
import { readArchiveBlock } from '../src/main/database/parser'
import { highConvert, lowConvert, inMatchValue } from '../src/shared/cm0102AttributeDisplay'

const sav = process.argv[2] ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const IN_GAME: Record<string, number> = {
  coachingGks: 18,
  coaching: 20,
  judgement: 20,
  judgingPotential: 19,
  manHandling: 16,
  motivating: 20,
  tactics: 13,
  discipline: 20,
  directness: 20,
  youngsters: 20,
  attacking: 20,
}

const file = readFileSync(sav)
const staffBuf = readArchiveBlock(file, 'staff.dat')!
const npBuf = readArchiveBlock(file, 'nonplayer.dat')
if (!npBuf?.length) {
  console.error('no nonplayer.dat')
  process.exit(1)
}
console.log('np rows', Math.floor(npBuf.length / NONPLAYER_ROW_BYTES))
const first = readArchiveBlock(file, 'first_names.dat')!
const second = readArchiveBlock(file, 'second_names.dat')!
const common = readArchiveBlock(file, 'common_names.dat')!

function nameAt(map: Buffer, id: number): string {
  if (id <= 0) return ''
  const off = (id - 1) * 51
  return readLatin1String(map.subarray(off, off + 51), 51)
}

function parseNp(rowIndex: number) {
  const off = rowIndex * NONPLAYER_ROW_BYTES
  if (off + NONPLAYER_ROW_BYTES > npBuf.length) return null
  const row = npBuf.subarray(off, off + NONPLAYER_ROW_BYTES)
  let o = 14
  const rb = () => row.readInt8(o++)
  return {
    ca: row.readUInt16LE(4),
    attacking: rb(),
    business: rb(),
    coaching: rb(),
    coachingGks: rb(),
    coachingTechnique: rb(),
    directness: rb(),
    discipline: rb(),
    freeRoles: rb(),
    interference: rb(),
    judgement: rb(),
    judgingPotential: rb(),
    manHandling: rb(),
    marking: rb(),
    motivating: rb(),
    offside: rb(),
    patience: rb(),
    physiotherapy: rb(),
    pressing: rb(),
    resources: rb(),
    tactics: rb(),
    youngsters: rb(),
  }
}

for (let si = 0; si < staffBuf.length / 110; si++) {
  const base = si * 110
  const fn = staffBuf.readInt32LE(base + 4)
  const sn = staffBuf.readInt32LE(base + 8)
  const cn = staffBuf.readInt32LE(base + 12)
  const name = (nameAt(common, cn) || `${nameAt(first, fn)} ${nameAt(second, sn)}`).trim()
  if (!/pomask|giorgos?\s+pom/i.test(name.toLowerCase())) continue

  const link = staffBuf.readInt32LE(base + 0x69)
  console.log('match:', name, 'link', link)
  if (link <= 0) continue
  const np = parseNp(link)
  if (!np) {
    console.log('  bad link', link, 'max', Math.floor(npBuf.length / NONPLAYER_ROW_BYTES))
    continue
  }
  console.log('\n', name, 'non_player_id(row)', link, 'CA', np.ca)
  console.log('raw bytes:', np)

  for (const [k, want] of Object.entries(IN_GAME)) {
    const raw = np[k as keyof typeof np] as number
    const hi = highConvert(np.ca, raw)
    const lo = lowConvert(np.ca, raw)
    const im = inMatchValue(np.ca, raw)
    const best =
      hi === want ? 'high' : lo === want ? 'low' : im === want ? 'inMatch' : raw === want ? 'raw' : '?'
    console.log(
      `  ${k}: raw=${raw} want=${want} high=${hi} low=${lo} inMatch=${im} => ${best}`,
    )
  }
}
