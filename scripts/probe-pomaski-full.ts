import { readFileSync } from 'fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import { NONPLAYER_ROW_BYTES, parseNonPlayerData, nonPlayerForStaffLink } from '../src/main/database/nonplayer'
import { readArchiveBlock } from '../src/main/database/parser'
import { staffNpAttrInGame } from '../src/shared/cm0102StaffNpAttributeDisplay'
import { highConvert, lowConvert } from '../src/shared/cm0102AttributeDisplay'

const sav = process.argv[2] ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const file = readFileSync(sav)
const staffBuf = readArchiveBlock(file, 'staff.dat')!
const npBuf = readArchiveBlock(file, 'nonplayer.dat')!
const first = readArchiveBlock(file, 'first_names.dat')!
const second = readArchiveBlock(file, 'second_names.dat')!
const common = readArchiveBlock(file, 'common_names.dat')!
const rows = parseNonPlayerData(npBuf)

const nameAt = (map: Buffer, id: number) => {
  if (id <= 0) return ''
  const o = (id - 1) * 51
  return readLatin1String(map.subarray(o, o + 51), 51)
}

for (let si = 0; si < staffBuf.length / 110; si++) {
  const b = si * 110
  const n = (
    nameAt(common, staffBuf.readInt32LE(b + 12)) ||
    `${nameAt(first, staffBuf.readInt32LE(b + 4))} ${nameAt(second, staffBuf.readInt32LE(b + 8))}`
  ).trim()
  if (!/pomask/i.test(n)) continue
  const link = staffBuf.readInt32LE(b + 0x69)
  const np = nonPlayerForStaffLink(link, rows)
  if (!np) {
    console.log(n, 'no np at', link)
    continue
  }
  console.log('\n', n, 'link', link, 'CA', np.currentAbility, 'formation', np.formation)
  console.log('raw np:', np)
  const keys = [
    'coachingGks',
    'coaching',
    'judgement',
    'judgingPotential',
    'manHandling',
    'motivating',
    'tactics',
    'coachingTechnique',
    'directness',
    'attacking',
    'pressing',
    'discipline',
  ] as const
  for (const k of keys) {
    const raw = np[k]
    console.log(
      `${k}: raw=${raw} disp=${staffNpAttrInGame(k, raw, np.currentAbility)} hi=${highConvert(np.currentAbility, raw)} lo=${lowConvert(np.currentAbility, raw)}`,
    )
  }
}
