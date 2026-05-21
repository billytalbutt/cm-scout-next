/**
 * Map `club_comp.dat` / `staff_comp.dat` ids to names and list `player stats.dat` rows
 * per player where competition id @ row+8 resolves to a known competition.
 *
 * Usage:
 *   npm run map:competition-ids -- <save.sav>
 *   npm run map:competition-ids -- <save.sav> --club "Blackburn Rovers"
 *   npm run map:competition-ids -- <save.sav> --ids 118,5451 --filter premier,champions,fa,league
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  parseClubCompData,
  parseClubPrimaryDivisionIds,
  parseStaffCompData,
  type ClubCompRecord,
} from '../src/main/database/clubComp.ts'
import { buildCompetitionNamesById, competitionNameFromMaps } from '../src/main/database/competitionNames.ts'
import {
  decodePlayerStatsGridRow,
  isResolvedCompetitionId,
} from '../src/main/database/playerStatsFields.ts'
import {
  parseIndexDat,
  readArchiveBlock,
  staffDisplayName,
} from '../src/main/database/parser.ts'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  iterPlayerStatsRowStarts,
} from '../src/main/database/playerStatsJoins.ts'

const DEFAULT_SAVE =
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'

const DEFAULT_FILTER =
  /premier|champions|uefa|fa cup|league cup|carabao|world club|club championship|community shield/i

function parseArgs(argv: string[]) {
  let path = argv[2]
  if (!path || path.startsWith('-')) path = DEFAULT_SAVE
  let clubName = ''
  let ids: number[] = []
  let filterRe = DEFAULT_FILTER
  let listAllComps = false
  const start = argv[2] && !argv[2]!.startsWith('-') ? 3 : 2
  for (let i = start; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--club' && argv[i + 1]) clubName = argv[++i]!
    else if (a === '--ids' && argv[i + 1]) {
      ids = argv[++i]!
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))
    } else if (a === '--filter' && argv[i + 1]) {
      const parts = argv[++i]!.split(',').map((s) => s.trim()).filter(Boolean)
      filterRe = new RegExp(parts.join('|'), 'i')
    } else if (a === '--all-comps') listAllComps = true
  }
  return { path, clubName, ids, filterRe, listAllComps }
}

function compMatchesFilter(c: ClubCompRecord, re: RegExp): boolean {
  const t = `${c.name} ${c.shortName} ${c.threeLetter}`.toLowerCase()
  return re.test(t)
}

function collectResolvedRowsForPlayer(
  statsBuf: Buffer,
  playerDatId: number,
  competitionNames: ReturnType<typeof buildCompetitionNamesById>,
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: ReturnType<typeof parseStaffCompData>,
  filterRe?: RegExp,
) {
  const g = PLAYER_STATS_RESEARCH_GRID_V0
  const byComp = new Map<
    number,
    {
      competitionId: number
      name: string
      rows: Array<{
        rowStart: number
        apps: number | null
        goals: number | null
        assists: number | null
        rating: number | null
      }>
    }
  >()

  for (const rowStart of iterPlayerStatsRowStarts(statsBuf, g)) {
    if (statsBuf.readInt32LE(rowStart + g.idOffsetInRow) !== playerDatId) continue
    const decoded = decodePlayerStatsGridRow(statsBuf, rowStart, g)
    if (!decoded?.competitionId) continue
    if (!isResolvedCompetitionId(decoded.competitionId, playerDatId, clubCompsById, staffCompsById)) {
      continue
    }
    const clubComp = clubCompsById?.get(decoded.competitionId)
    if (filterRe && clubComp && !compMatchesFilter(clubComp, filterRe)) continue

    const name = competitionNameFromMaps(decoded.competitionId, competitionNames, playerDatId)
    let bucket = byComp.get(decoded.competitionId)
    if (!bucket) {
      bucket = { competitionId: decoded.competitionId, name, rows: [] }
      byComp.set(decoded.competitionId, bucket)
    }
    const hasStat =
      decoded.apps != null ||
      decoded.goals != null ||
      decoded.assists != null ||
      decoded.averageRating != null
    if (!hasStat) continue
    bucket.rows.push({
      rowStart,
      apps: decoded.apps,
      goals: decoded.goals,
      assists: decoded.assists,
      rating: decoded.averageRating,
    })
  }

  return [...byComp.values()].sort((a, b) => a.competitionId - b.competitionId)
}

function main(): void {
  const { path, clubName, ids, filterRe, listAllComps } = parseArgs(process.argv)
  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')

  const competitionNames = buildCompetitionNamesById(db.clubCompsById, db.staffCompsById)

  console.log(`\n=== Competition id map — ${basename(path)} ===`)
  console.log(`gameDate: ${db.gameDateIso ?? '?'}`)
  console.log(`club_comp.dat: ${db.clubCompsById?.size ?? 0} competitions`)
  console.log(`staff_comp.dat: ${db.staffCompsById?.size ?? 0} competitions`)

  let employerClubId = -1
  let divisionCompId = -1
  if (clubName) {
    for (const [id, name] of db.clubNames) {
      if (name.toLowerCase().includes(clubName.toLowerCase())) {
        employerClubId = id
        divisionCompId = db.clubDivisionCompIdByClubId.get(id) ?? -1
        console.log(`\nClub: ${name} (id=${id})`)
        const div = db.clubCompsById?.get(divisionCompId)
        console.log(
          `  Primary league (club.dat Division @ 0x57): comp id ${divisionCompId} → ${div?.name ?? '?'}`,
        )
        break
      }
    }
  }

  const filteredClubComps: { id: number; name: string; short: string; nationId: number }[] = []
  for (const [id, c] of db.clubCompsById ?? []) {
    if (listAllComps || compMatchesFilter(c, filterRe)) {
      filteredClubComps.push({
        id,
        name: c.name,
        short: c.shortName,
        nationId: c.nationId,
      })
    }
  }
  filteredClubComps.sort((a, b) => a.id - b.id)

  console.log(`\n── Club competitions matching filter (${filteredClubComps.length}) ──`)
  console.log('  id     nation  name')
  for (const c of filteredClubComps) {
    const nation = db.nationNames.get(c.nationId) ?? `#${c.nationId}`
    const mark =
      c.id === divisionCompId ? '  ← club primary league' : ''
    console.log(
      `  ${String(c.id).padStart(5)}  ${nation.slice(0, 12).padEnd(12)}  ${c.name}${mark}`,
    )
  }

  const staffFiltered: { id: number; name: string }[] = []
  for (const [id, c] of db.staffCompsById ?? []) {
    const t = `${c.name} ${c.shortName}`.toLowerCase()
    if (listAllComps || filterRe.test(t)) {
      staffFiltered.push({ id, name: c.name })
    }
  }
  if (staffFiltered.length) {
    console.log(`\n── Staff/international comps matching filter (${staffFiltered.length}) ──`)
    for (const c of staffFiltered.sort((a, b) => a.id - b.id)) {
      console.log(`  ${String(c.id).padStart(5)}  ${c.name}`)
    }
  }

  if (!statsBuf?.length) {
    console.log('\n(no player stats.dat)')
    return
  }

  const targets: { name: string; playerDatId: number }[] = []
  if (ids.length) {
    for (const id of ids) {
      const s = db.staff.find(
        (st) => st.player_id >= 0 && db.players[st.player_id]?.id === id,
      )
      const name = s
        ? staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
        : `player.dat ${id}`
      targets.push({ name, playerDatId: id })
    }
  } else {
    for (const s of db.staff) {
      if (s.player_id < 0 || s.player_id >= db.players.length) continue
      const name = staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
      const club = db.clubNames.get(s.club_job_id) ?? ''
      if (clubName && !club.toLowerCase().includes(clubName.toLowerCase())) continue
      targets.push({ name, playerDatId: db.players[s.player_id]!.id })
    }
    if (!targets.length && !clubName) {
      targets.push(
        { name: 'Kieron Dyer', playerDatId: 118 },
        { name: 'Joe Cole', playerDatId: 5451 },
        { name: 'Xavi', playerDatId: 14922 },
        { name: 'Maxim Tsigalko', playerDatId: 27755 },
      )
    }
  }

  console.log(
    `\n── player stats.dat rows with KNOWN competition id (grid V0, comp @ +8, id @ +40) ──`,
  )
  console.log(
    'Only rows where comp id exists in club_comp/staff_comp and is not the player.dat id.\n',
  )

  for (const t of targets.slice(0, 12)) {
    const buckets = collectResolvedRowsForPlayer(
      statsBuf,
      t.playerDatId,
      competitionNames,
      db.clubCompsById,
      db.staffCompsById,
      listAllComps ? undefined : filterRe,
    )
    console.log(`${'─'.repeat(72)}`)
    console.log(`${t.name} (player.dat id=${t.playerDatId}) — ${buckets.length} competition(s)`)
    if (!buckets.length) {
      console.log('  (no grid rows with resolved comp id in filter — try --all-comps)')
      continue
    }
    for (const b of buckets) {
      const best = [...b.rows].sort((a, c) => (c.apps ?? 0) - (a.apps ?? 0))[0]
      console.log(`\n  [${b.competitionId}] ${b.name} — ${b.rows.length} row(s)`)
      for (const r of b.rows.slice(0, 6)) {
        const rat = r.rating != null ? r.rating.toFixed(2) : '—'
        console.log(
          `    row@${r.rowStart}  apps=${r.apps ?? '—'}  goals=${r.goals ?? '—'}  assists=${r.assists ?? '—'}  rat=${rat}`,
        )
      }
      if (b.rows.length > 6) console.log(`    ... ${b.rows.length - 6} more`)
      if (best) {
        console.log(
          `    → highest-apps row: @${best.rowStart} (${best.apps} apps, ${best.goals} g, ${best.assists} a)`,
        )
      }
    }
  }

  console.log(
    '\nNote: comp id @ offset 8 is a hypothesis. Rows where comp id equals the player.dat id are excluded (common false positive for low ids like 118).\n',
  )
}

main()
