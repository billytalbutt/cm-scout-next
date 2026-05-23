/**
 * Fast probe: staff.non_player_id → nonplayer.dat (id map vs row index).
 * Usage: npx tsx scripts/probe-nonplayer-link.ts [sav] [name-substring]
 */
import { readFileSync } from 'fs'
import { readLatin1String } from '../src/main/database/cmBinaryReader'
import { NONPLAYER_ROW_BYTES } from '../src/main/database/nonplayer'
import { readArchiveBlock } from '../src/main/database/parser'

const STAFF_ROW = 110
const NAME_ROW = 51

function parseNpRow(row: Buffer) {
  let o = 0
  const id = row.readInt32LE(o)
  o += 4
  const ca = row.readUInt16LE(o)
  o += 2
  const pa = row.readUInt16LE(o)
  o += 2
  o += 6
  const rb = () => row.readInt8(o++)
  return {
    id,
    ca,
    pa,
    coaching: rb(),
    coachingGks: rb(),
    judgement: rb(),
    judgingPotential: rb(),
    tactics: rb(),
    motivating: rb(),
    youngsters: rb(),
  }
}

const sav = process.argv[2] ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
const needle = (process.argv[3] ?? 'Pomiaski').toLowerCase()

const file = readFileSync(sav)
const staffBuf = readArchiveBlock(file, 'staff.dat')!
const npBuf = readArchiveBlock(file, 'nonplayer.dat')!
const first = readArchiveBlock(file, 'first_names.dat')!
const second = readArchiveBlock(file, 'second_names.dat')!
const common = readArchiveBlock(file, 'common_names.dat')!
const clubBuf = readArchiveBlock(file, 'club.dat')!

function nameFromId(map: Buffer, id: number): string {
  if (id <= 0) return ''
  const off = (id - 1) * NAME_ROW
  if (off < 0 || off + NAME_ROW > map.length) return ''
  return readLatin1String(map.subarray(off, off + NAME_ROW), NAME_ROW)
}

function staffName(off: number): string {
  const fn = staffBuf.readInt32LE(off + 4)
  const sn = staffBuf.readInt32LE(off + 8)
  const cn = staffBuf.readInt32LE(off + 12)
  const a = nameFromId(first, fn)
  const b = nameFromId(second, sn)
  const c = nameFromId(common, cn)
  return c || `${a} ${b}`.trim()
}

function clubName(clubId: number): string {
  const nRows = Math.floor(clubBuf.length / 581)
  for (let i = 0; i < nRows; i++) {
    const off = i * 581
    if (clubBuf.readInt32LE(off) === clubId) {
      return readLatin1String(clubBuf.subarray(off + 4, off + 55), 51)
    }
  }
  return ''
}

const nNp = Math.floor(npBuf.length / NONPLAYER_ROW_BYTES)
let found = 0

for (let si = 0; si < staffBuf.length / STAFF_ROW; si++) {
  const off = si * STAFF_ROW
  const name = staffName(off)
  if (!name.toLowerCase().includes(needle)) continue
  found++
  const link = staffBuf.readInt32LE(off + 0x69)
  const clubId = staffBuf.readInt32LE(off + 0x2c)
  const job = staffBuf.readInt8(off + 0x30)
  console.log('\n---', name, '@', clubName(clubId), 'job', job, 'staffIdx', si, 'non_player_id', link)

  if (link > 0 && link < nNp) {
    const viaIndex = parseNpRow(npBuf.subarray(link * NONPLAYER_ROW_BYTES, link * NONPLAYER_ROW_BYTES + NONPLAYER_ROW_BYTES))
    console.log('row[link] (index):', viaIndex)
  }

  // id map: find row where id === link
  let viaIdRow: ReturnType<typeof parseNpRow> | null = null
  let idRowIndex = -1
  for (let ri = 0; ri < nNp; ri++) {
    const r = parseNpRow(npBuf.subarray(ri * NONPLAYER_ROW_BYTES, ri * NONPLAYER_ROW_BYTES + NONPLAYER_ROW_BYTES))
    if (r.id === link) {
      viaIdRow = r
      idRowIndex = ri
      break
    }
  }
  if (viaIdRow) console.log('row where id===link @', idRowIndex, ':', viaIdRow)
  else console.log('no row with id === link')
}

console.log('\nnp rows', nNp, 'matches', found)
