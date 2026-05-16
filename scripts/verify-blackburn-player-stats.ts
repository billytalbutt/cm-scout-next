/**
 * Verify grid V0 decode for named Blackburn players — IDs, per-comp rows, primary summary.
 *
 * Usage:
 *   npx tsx scripts/verify-blackburn-player-stats.ts <path-to.sav>
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseIndexDat, readArchiveBlock, staffDisplayName } from '../src/main/database/parser.ts'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  listEligibleRowStartsForPlayerDatId,
} from '../src/main/database/playerStatsJoins.ts'
import { decodePlayerStatsGridRow } from '../src/main/database/playerStatsFields.ts'

const TARGET_NAMES = new Set([
  'Kieron Dyer',
  'Xavi',
  'Joe Cole',
  'Maxim Tsigalko',
  'Maksim Tsigalko',
])

function isTargetName(name: string): boolean {
  if (TARGET_NAMES.has(name)) return true
  return /tsigalk/i.test(name)
}

function main(): void {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx scripts/verify-blackburn-player-stats.ts <save.sav>')
    process.exit(1)
  }

  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')
  const g = PLAYER_STATS_RESEARCH_GRID_V0
  const playerIds = new Set(db.players.map((p) => p.id))

  console.log(`\n=== ${basename(path)} ===`)
  console.log(`gameDate: ${db.gameDateIso ?? '?'}`)

  const blackburnStaff: {
    name: string
    staffId: number
    playerDatId: number
    club: string
    divCompId: number | undefined
  }[] = []

  for (const s of db.staff) {
    if (s.player_id < 0 || s.player_id >= db.players.length) continue
    const club = db.clubNames.get(s.club_job_id) ?? ''
    if (!club.toLowerCase().includes('blackburn')) continue
    const name = staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
    const playerDatId = db.players[s.player_id]!.id
    const divCompId = db.clubDivisionCompIdByClubId.get(s.club_job_id)
    blackburnStaff.push({ name, staffId: s.id, playerDatId, club, divCompId })
  }

  console.log(`\nBlackburn playable staff (${blackburnStaff.length}):`)
  for (const m of blackburnStaff.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      `  ${m.name.padEnd(22)} player.dat id=${String(m.playerDatId).padStart(5)}  staff=${String(m.staffId).padStart(5)}  divComp=${m.divCompId ?? '?'}`,
    )
  }

  let toReport = blackburnStaff.filter((m) => isTargetName(m.name))
  if (!toReport.length) {
    toReport = blackburnStaff.filter((m) => {
      const sp = db.savePerformanceByPlayerDatId?.get(m.playerDatId)
      const pc = db.savePerformancePerCompByPlayerDatId?.get(m.playerDatId)
      return sp || (pc && pc.length > 0)
    })
  }

  for (const m of toReport) {
    console.log(`\n--- ${m.name} (player.dat id=${m.playerDatId}, divComp=${m.divCompId ?? '?'}) ---`)
    const primary = db.savePerformanceByPlayerDatId?.get(m.playerDatId)
    const perComp = db.savePerformancePerCompByPlayerDatId?.get(m.playerDatId) ?? []
    const hist = db.staffHistoryByStaffId?.get(m.staffId) ?? []
    const maxYear = hist.length ? Math.max(...hist.map((x) => x.year)) : null
    const seasonHist = maxYear != null ? hist.filter((h) => h.year === maxYear) : []
    console.log(
      `  Primary (app): apps=${primary?.apps ?? '—'} goals=${primary?.goals ?? '—'} ast=${primary?.assists ?? '—'} layout=${primary?.layout ?? '—'} compId=${primary?.competitionId ?? '—'}`,
    )
    if (seasonHist.length) {
      const apps = seasonHist.reduce((a, h) => a + h.apps, 0)
      const goals = seasonHist.reduce((a, h) => a + h.goals, 0)
      console.log(`  staff_history (${maxYear}, all clubs): apps=${apps} goals=${goals}`)
    }

    if (statsBuf) {
      const rowStarts = listEligibleRowStartsForPlayerDatId(statsBuf, g, playerIds, m.playerDatId, 30)
      console.log(`  Raw eligible grid rows (first ${Math.min(rowStarts.length, 12)}):`)
      for (const rs of rowStarts.slice(0, 12)) {
        const row = decodePlayerStatsGridRow(statsBuf, rs)!
        const cc = row.competitionId != null ? db.clubCompsById?.get(row.competitionId) : undefined
        const sc = row.competitionId != null ? db.staffCompsById?.get(row.competitionId) : undefined
        const label =
          (cc?.name ?? cc?.shortName ?? sc?.name ?? sc?.shortName ?? `id ${row.competitionId}`)?.slice(0, 42) ?? '?'
        console.log(
          `    @${rs} [${row.competitionId}] ${label}  apps=${row.apps} g=${row.goals} a=${row.assists ?? '—'}`,
        )
      }
    }

    console.log(`  Per-comp table (${perComp.length} rows, first 15):`)
    for (const r of perComp.slice(0, 15)) {
      console.log(
        `    [${r.competitionId}] ${r.competitionName.slice(0, 48)}  apps=${r.apps} g=${r.goals} a=${r.assists ?? '—'}`,
      )
    }
    if (perComp.length > 15) console.log(`    ... ${perComp.length - 15} more`)
  }
}

main()
