/**
 * Probe tactical knowledge bytes + formulas for named coaches.
 * Usage: npx tsx scripts/probe-tactics-coaches.ts [path-to.sav] "Malkin,Pomaski,Kidd"
 */
import { readFileSync, existsSync } from 'fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import { parseNonPlayerData, nonPlayerForStaffLink } from '../src/main/database/nonplayer'
import { readArchiveBlock } from '../src/main/database/parser'
import {
  staffTacticsInGame,
  staffNpAttrInGame,
  staffNpCaDivConvert,
} from '../src/shared/cm0102StaffNpAttributeDisplay'
import { highConvert } from '../src/shared/cm0102AttributeDisplay'

const sav =
  process.argv[2] ??
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'

const names = (process.argv[3] ?? 'Malkin,Pomaski,Kidd,Brian').split(',').map((s) => s.trim().toLowerCase())

if (!existsSync(sav)) {
  console.error('Save not found:', sav)
  process.exit(1)
}

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

function tryFormula(ca: number, raw: number) {
  const r = raw < 0 ? 0 : raw
  return {
    current: staffTacticsInGame(ca, raw),
    ca35t: staffNpCaDivConvert(ca, r, 35),
    ca25r: staffNpCaDivConvert(ca, r, 25),
    ca20r: staffNpCaDivConvert(ca, r, 20),
    hi: highConvert(ca, raw),
    hiR: highConvert(ca, r),
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
  const byIdx = link > 0 && link < rows.length ? rows[link] : undefined
  const byId = rows.find((r) => r.id === link)

  console.log('\n===', n, '===')
  console.log('link', link, 'club_job', staffBuf.readInt32LE(b + 0x5d))
  if (!np) {
    console.log('NO linked np')
    continue
  }
  console.log('linked: CA', np.currentAbility, 'PA', np.potentialAbility, 'np.id', np.id)
  console.log(
    'bytes: tac',
    np.tactics,
    'co',
    np.coaching,
    'gk',
    np.coachingGks,
    'jud',
    np.judgement,
    'mot',
    np.motivating,
  )
  console.log('tool tactics:', staffNpAttrInGame('tactics', np.tactics, np.currentAbility))
  console.log('formulas @ linked CA/raw:', tryFormula(np.currentAbility, np.tactics))

  if (byIdx && byIdx !== np) {
    console.log('-- index row (not chosen): CA', byIdx.currentAbility, 'tac', byIdx.tactics, '→', staffTacticsInGame(byIdx.currentAbility, byIdx.tactics))
  }
  if (byId && byId !== np) {
    console.log('-- id row (not chosen): CA', byId.currentAbility, 'tac', byId.tactics, '→', staffTacticsInGame(byId.currentAbility, byId.tactics))
  }

  for (let raw = 0; raw <= 10; raw++) {
    const v = staffTacticsInGame(np.currentAbility, raw)
    if (v === 13 || v === 16 || v === 17) {
      console.log(`  raw ${raw} → ${v}`)
    }
  }
}
