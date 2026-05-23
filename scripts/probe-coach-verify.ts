import { readFileSync } from 'fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import { parseNonPlayerData, nonPlayerForStaffLink } from '../src/main/database/nonplayer'
import { readArchiveBlock } from '../src/main/database/parser'
import { staffNpAttrInGame } from '../src/shared/cm0102StaffNpAttributeDisplay'
import { highConvert, lowConvert } from '../src/shared/cm0102AttributeDisplay'

const sav = process.argv[2] ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const names = (process.argv[3] ?? 'Malkin,Foster,Pomaski,Osamaski').split(',').map((s) => s.trim().toLowerCase())

const file = readFileSync(sav)
const staffBuf = readArchiveBlock(file, 'staff.dat')!
const rows = parseNonPlayerData(readArchiveBlock(file, 'nonplayer.dat')!)
const first = readArchiveBlock(file, 'first_names.dat')!
const second = readArchiveBlock(file, 'second_names.dat')!
const common = readArchiveBlock(file, 'common_names.dat')!

const nameAt = (map: Buffer, id: number) => {
  if (id <= 0) return ''
  const o = (id - 1) * 51
  return readLatin1String(map.subarray(o, o + 51), 51)
}

function tryConvert(ca: number, raw: number) {
  return {
    high: highConvert(ca, raw),
    low: lowConvert(ca, raw),
    ca25: staffNpAttrInGame('manHandling', raw, ca),
    ca35: staffNpAttrInGame('tactics', raw, ca),
    resources: raw,
    manHandlingKey: staffNpAttrInGame('manHandling', raw, ca),
  }
}

for (let si = 0; si < staffBuf.length / 110; si++) {
  const b = si * 110
  const n = (
    nameAt(common, staffBuf.readInt32LE(b + 12)) ||
    `${nameAt(first, staffBuf.readInt32LE(b + 4))} ${nameAt(second, staffBuf.readInt32LE(b + 8))}`
  ).trim()
  if (!names.some((needle) => n.toLowerCase().includes(needle))) continue
  const link = staffBuf.readInt32LE(b + 0x69)
  const np = nonPlayerForStaffLink(link, rows)
  if (!np) continue
  console.log('\n===', n, 'CA', np.currentAbility, 'link', link)
  console.log(
    'raw: gk',
    np.coachingGks,
    'co',
    np.coaching,
    'jud',
    np.judgement,
    'jp',
    np.judgingPotential,
    'manH',
    np.manHandling,
    'res',
    np.resources,
    'mot',
    np.motivating,
    'phy',
    np.physiotherapy,
    'tac',
    np.tactics,
    'yng',
    np.youngsters,
  )
  for (const [label, raw] of [
    ['gk', np.coachingGks],
    ['manH', np.manHandling],
    ['res', np.resources],
    ['tac', np.tactics],
  ] as const) {
    console.log(label, tryConvert(np.currentAbility, raw))
  }
}
