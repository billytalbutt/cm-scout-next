import { existsSync, readFileSync } from 'node:fs'
import { readArchiveBlock, parseIndexDat } from '../src/main/database/parser'
import { indexStaffCompHistoryFromPlayerStats } from '../src/main/database/staffCompHistory'

const sav =
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'
if (!existsSync(sav)) {
  console.error('missing', sav)
  process.exit(1)
}
const file = readFileSync(sav)
const db = parseIndexDat(file, { staffHistorySearchDirs: [] })
const buf = readArchiveBlock(file, 'player stats.dat')!
const byStaff = indexStaffCompHistoryFromPlayerStats(
  buf,
  db.players,
  db.staff,
  db.clubCompsById,
  db.staffCompsById,
)
console.log('staff with comp rows:', byStaff.size)
let sample = 0
for (const [staffId, rows] of byStaff) {
  if (sample++ >= 3) break
  const staff = db.staff.find((s) => s.id === staffId)
  const pidx = staff?.player_id
  const pid = pidx != null ? db.players[pidx]?.id : undefined
  console.log('\nstaff', staffId, 'player.dat', pid, 'rows', rows.length)
  for (const r of rows.slice(0, 5)) {
    const name =
      db.clubCompsById?.get(r.competitionId)?.name ??
      db.staffCompsById?.get(r.competitionId)?.name ??
      `#${r.competitionId}`
    console.log(`  ${name}: ${r.apps}a ${r.goals}g ${r.assists}ast av=${r.averageRating ?? '—'}`)
  }
}
