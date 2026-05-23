/**
 * Print build fingerprint + staff attr decode for named coaches (verify save vs formulas).
 * Usage: npx tsx scripts/verify-staff-build.ts [path/to/index.dat or .sav]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parseIndexDat } from '../src/main/database/parser'
import { nonPlayerForStaffLink } from '../src/main/database/nonplayer'
import {
  staffManManagementInGame,
  staffNpAttrInGame,
  staffTacticsInGame,
} from '../src/shared/cm0102StaffNpAttributeDisplay.ts'
import { coachingStyleLabel } from '../src/shared/cm0102StaffProfileText.ts'

const BUILD_ID = '7027cae-staff-v2'

const sav =
  process.argv[2] ??
  'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'

if (!existsSync(sav)) {
  console.error('Save not found:', sav)
  process.exit(1)
}

const needles = ['malkin', 'pomask', 'foster', 'pomaski', 'giorgos']
const buf = readFileSync(sav)
const db = parseIndexDat(buf, { skipCurrentSeasonIndex: true })
const rows = db.nonPlayersByRowIndex

console.log('BUILD_ID', BUILD_ID)
console.log('staff rows', db.staff.length, 'np rows', rows?.length ?? 0)

for (let si = 0; si < db.staff.length; si++) {
  const s = db.staff[si]!
  const fn = db.firstNames[s.first_name_id] ?? ''
  const sn = db.secondNames[s.second_name_id] ?? ''
  const cn = db.commonNames[s.common_name_id] ?? ''
  const name = (cn || `${fn} ${sn}`).trim()
  if (!needles.some((n) => name.toLowerCase().includes(n))) continue

  const link = s.non_player_id
  const np = nonPlayerForStaffLink(link, rows)
  const club = db.clubNames.get(s.club_job_id) ?? ''

  console.log('\n---', name, '@', club, 'staffIdx', si, 'link', link)
  if (!np) {
    console.log('  NO nonplayer link')
    continue
  }
  console.log('  np.id', np.id, 'CA', np.currentAbility, 'PA', np.potentialAbility)
  console.log('  raw tactics', np.tactics, '→', staffTacticsInGame(np.currentAbility, np.tactics))
  console.log('  raw coachingTechnique', np.coachingTechnique, '→', coachingStyleLabel(np.coachingTechnique))
  console.log('  raw manH/res', np.manHandling, np.resources, '→ man', staffManManagementInGame(np.currentAbility, np.manHandling, np.resources))
  console.log('  raw gk', np.coachingGks, '→', staffNpAttrInGame('coachingGks', np.coachingGks, np.currentAbility))
  console.log('  inGame tactics key', staffNpAttrInGame('tactics', np.tactics, np.currentAbility))

  if (link < (rows?.length ?? 0) && rows) {
    const byIdx = rows[link]
    if (byIdx && byIdx !== np) {
      console.log('  WARN index row differs from linked:', 'idx tac', byIdx.tactics, 'id tac', np.tactics)
    }
  }
}
