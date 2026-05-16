import { readFileSync } from 'node:fs'
import { readArchiveBlock, parseIndexDat } from '../src/main/database/parser.ts'

const path = 'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
const file = readFileSync(path)
const db = parseIndexDat(file)
const buf = readArchiveBlock(file, 'player stats.dat')!
const off = 10614285
const club = 1165
const joeStaff = db.staff.find((s) => s.id === 6408)
console.log('joe staff', joeStaff?.club_job_id, 'player', joeStaff?.player_id)
for (let rel = -400; rel < 500; rel += 2) {
  if (rel + 2 <= buf.length) {
    const u16 = buf.readUInt16LE(off + rel)
    if (u16 === club) console.log('u16@', rel, club)
  }
}
for (let rel = -400; rel < 500; rel += 4) {
  const u32 = buf.readInt32LE(off + rel)
  if (u32 === club || u32 === 6408 || u32 === 5451) console.log('i32@', rel, u32)
}
