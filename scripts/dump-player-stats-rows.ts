/**
 * Dump Senior-club stats + every `player stats.dat` row for verification players.
 * Same sections for each player so you can compare to CM → Stats → Senior club (all comps).
 *
 * Usage:
 *   npm run dump:player-stats-rows -- <path-to.sav>
 *   npm run dump:player-stats-rows -- <save.sav> --names "Kieron Dyer,Joe Cole,Xavi,Maxim Tsigalko"
 *   npm run dump:player-stats-rows -- <save.sav> --ids 118,5451,14922,27755
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  parseIndexDat,
  readArchiveBlock,
  staffDisplayName,
} from '../src/main/database/parser.ts'
import { collectPlayerDatIdOccurrences } from '../src/main/database/playerStatsDat.ts'
import {
  PLAYER_STATS_RESEARCH_GRID_V0,
  iterPlayerStatsRowStarts,
} from '../src/main/database/playerStatsJoins.ts'
import {
  collectResearchGridRowsForPlayer,
  decodePlayerStatsGridRow,
  isResolvedCompetitionId,
  type DecodedPlayerStatsGridRow,
} from '../src/main/database/playerStatsFields.ts'
import {
  inspectSeniorClubAnchorsForPlayer,
  offGridRecordStart,
  pickSummaryAnchorForPlayer,
  readSummaryStatsAtAnchor,
  PLAYER_STATS_SUMMARY_FIELDS as SF,
} from '../src/main/database/playerStatsSummary.ts'

const DEFAULT_NAMES = ['Kieron Dyer', 'Joe Cole', 'Xavi', 'Maxim Tsigalko']

function parseArgs(argv: string[]): {
  path: string
  names: string[]
  ids: number[]
  maxGridRows: number
} {
  const path = argv[2]
  if (!path || path.startsWith('-')) {
    console.error(
      'Usage: npx tsx scripts/dump-player-stats-rows.ts <save.sav> [--names "A,B"] [--ids 1,2] [--max-rows N]',
    )
    process.exit(1)
  }
  let names = [...DEFAULT_NAMES]
  let ids: number[] = []
  let maxGridRows = 200
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--names' && argv[i + 1]) {
      names = argv[++i]!.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a === '--ids' && argv[i + 1]) {
      ids = argv[++i]!
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))
    } else if (a === '--max-rows' && argv[i + 1]) {
      maxGridRows = Math.max(1, parseInt(argv[++i]!, 10) || 200)
    }
  }
  return { path, names, ids, maxGridRows }
}

function compLabel(
  competitionId: number | null,
  db: ReturnType<typeof parseIndexDat>,
): string {
  if (competitionId == null) return '(null)'
  const cc = db.clubCompsById?.get(competitionId)
  const sc = db.staffCompsById?.get(competitionId)
  const n = cc?.name ?? cc?.shortName ?? sc?.name ?? sc?.shortName
  if (n) return `${n} [${competitionId}]`
  return `#${competitionId}`
}

type PlayerTarget = { name: string; playerDatId: number; staffId: number; club: string }

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function nameMatchesSingle(name: string, target: string): boolean {
  const n = normalizeNameKey(name)
  const t = normalizeNameKey(target)
  if (n === t) return true
  if (/tsigalk/i.test(t) && /tsigalk/i.test(name)) return true
  if (/maksim/i.test(t) && /maxim/i.test(name)) return true
  if (/maxim/i.test(t) && /maksim/i.test(name)) return true
  return false
}

function resolveTargets(
  db: ReturnType<typeof parseIndexDat>,
  names: string[],
  ids: number[],
): PlayerTarget[] {
  const allStaff: PlayerTarget[] = []
  for (const s of db.staff) {
    if (s.player_id < 0 || s.player_id >= db.players.length) continue
    const playerDatId = db.players[s.player_id]!.id
    const name = staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
    const club = db.clubNames.get(s.club_job_id) ?? ''
    allStaff.push({ name, playerDatId, staffId: s.id, club })
  }

  if (ids.length) {
    return ids
      .map(
        (id) =>
          allStaff.find((p) => p.playerDatId === id) ?? {
            name: `player.dat id ${id}`,
            playerDatId: id,
            staffId: -1,
            club: '?',
          },
      )
      .slice(0, 8)
  }

  const pickBestForName = (target: string): PlayerTarget | null => {
    const candidates = allStaff.filter((p) => nameMatchesSingle(p.name, target))
    if (!candidates.length) return null
    const blackburn = candidates.filter((p) => p.club.toLowerCase().includes('blackburn'))
    const pool = blackburn.length ? blackburn : candidates
    pool.sort((a, b) => a.staffId - b.staffId)
    return pool[0]!
  }

  const picked: PlayerTarget[] = []
  const seenPlayerIds = new Set<number>()
  for (const name of names) {
    const p = pickBestForName(name)
    if (!p || seenPlayerIds.has(p.playerDatId)) continue
    seenPlayerIds.add(p.playerDatId)
    picked.push(p)
  }
  if (picked.length) return picked

  return allStaff.slice(0, 4)
}

type ResearchRow = DecodedPlayerStatsGridRow & { source: 'grid' | 'off-grid' }

/** Grid rows + off-grid id anchors (dump only — not gated on empty grid). */
function collectAllResearchRowsForDump(
  buf: Buffer,
  playerDatId: number,
  playerIds: ReadonlySet<number>,
  occ: readonly number[],
): ResearchRow[] {
  const g = PLAYER_STATS_RESEARCH_GRID_V0
  const byRowStart = new Map<number, ResearchRow>()

  for (const rowStart of iterPlayerStatsRowStarts(buf, g)) {
    if (buf.readInt32LE(rowStart + g.idOffsetInRow) !== playerDatId) continue
    const decoded = decodePlayerStatsGridRow(buf, rowStart)
    if (!decoded) continue
    const hasStat =
      decoded.apps != null ||
      decoded.goals != null ||
      decoded.assists != null ||
      decoded.averageRating != null
    if (!hasStat) continue
    byRowStart.set(rowStart, { ...decoded, source: 'grid', idAnchor: rowStart + g.idOffsetInRow })
  }

  for (const anchor of occ) {
    const rowStart = anchor - g.idOffsetInRow
    if (rowStart < 0 || rowStart + g.stride > buf.length) continue
    const decoded = decodePlayerStatsGridRow(buf, rowStart)
    if (!decoded || decoded.playerDatId !== playerDatId) continue
    const hasStat =
      decoded.apps != null ||
      decoded.goals != null ||
      decoded.assists != null ||
      decoded.averageRating != null
    if (!hasStat) continue
    if (!byRowStart.has(rowStart)) {
      byRowStart.set(rowStart, { ...decoded, source: 'off-grid', idAnchor: anchor })
    }
  }

  return [...byRowStart.values()].sort((a, b) => a.rowStart - b.rowStart)
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s.padEnd(n)
}

function main(): void {
  const { path, names, ids, maxGridRows } = parseArgs(process.argv)
  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')
  const g = PLAYER_STATS_RESEARCH_GRID_V0
  const playerIds = new Set(db.players.map((p) => p.id))
  const occByPlayer = collectPlayerDatIdOccurrences(statsBuf ?? Buffer.alloc(0), playerIds)
  const targets = resolveTargets(db, names, ids)

  console.log(`\n=== CM Senior club / player stats.dat — ${basename(path)} ===`)
  console.log(`gameDate: ${db.gameDateIso ?? '?'}`)
  console.log(
    `In CM: Player profile → Stats → Senior club (combined league + cups). Compare apps / goals / assists below.`,
  )
  if (!statsBuf?.length) {
    console.error('No player stats.dat block in this archive.')
    process.exit(1)
  }
  console.log(`player stats.dat: ${statsBuf.length} bytes · summary fields +${SF.appsSenior}/+${SF.goalsSenior}/+${SF.assistsSenior} or off-grid +${SF.appsOffGrid}/+${SF.goalsOffGrid}/+${SF.assistsOffGrid}`)
  console.log(`players: ${targets.map((t) => t.name).join(' · ') || '(none)'}\n`)

  for (const t of targets) {
    const occ = occByPlayer.get(t.playerDatId) ?? []
    const idHits = occ.length
    const chosen = pickSummaryAnchorForPlayer(statsBuf, t.playerDatId, db.players)
    const anchors = inspectSeniorClubAnchorsForPlayer(statsBuf, t.playerDatId, idHits)
    const researchRows = collectAllResearchRowsForDump(statsBuf, t.playerDatId, playerIds, occ)
    const gatedResearch = collectResearchGridRowsForPlayer(statsBuf, t.playerDatId, playerIds, g, occ, {
      clubCompsById: db.clubCompsById,
      staffCompsById: db.staffCompsById,
    })

    const hist = db.staffHistoryByStaffId?.get(t.staffId) ?? []
    const maxYear = hist.length ? Math.max(...hist.map((h) => h.year)) : null
    const seasonAtClub =
      maxYear != null
        ? hist.filter((h) => h.year === maxYear && h.clubId > 0)
        : []

    console.log(`${'═'.repeat(72)}`)
    console.log(`${t.name}`)
    console.log(
      `  player.dat id=${t.playerDatId}  staff=${t.staffId}  club=${t.club || '?'}  id hits in blob=${idHits}`,
    )

    console.log(`\n  ── CM compare: Senior club (all competitions) ──`)
    if (chosen?.decoded) {
      const d = chosen.decoded
      console.log(
        `  CHOSEN decode →  apps=${d.apps}  goals=${d.goals}  assists=${d.assists ?? '—'}  (layout=${d.layout})  @anchor ${chosen.anchor}`,
      )
    } else {
      console.log(`  CHOSEN decode →  (none — no summary anchor passed filters)`)
    }
    const appLine = db.savePerformanceByPlayerDatId?.get(t.playerDatId)
    if (appLine && appLine.layout === 'summaryV1') {
      console.log(
        `  Loaded in app →  apps=${appLine.apps ?? '—'}  goals=${appLine.goals ?? '—'}  assists=${appLine.assists ?? '—'}`,
      )
    }

    if (seasonAtClub.length) {
      const apps = seasonAtClub.reduce((a, h) => a + h.apps, 0)
      const goals = seasonAtClub.reduce((a, h) => a + h.goals, 0)
      console.log(
        `  staff_history (${maxYear}, ${seasonAtClub.length} row(s) at club) →  apps=${apps}  goals=${goals}  (no assists in staff_history)`,
      )
    }

    console.log(`\n  ── Every id anchor with Senior-club-style bytes (${anchors.length}) ──`)
    console.log(
      '  pick  anchor     kind           v4    decApps g  a   +76/+77/+78      +91/+92/+93      rec+52/+44/+53',
    )
    for (const c of anchors) {
      const isPick = chosen?.anchor === c.anchor
      const r = c.raw
      const slot76 = `${r.apps76}/${r.goals77}/${r.ast78}`
      const slot91 = `${r.apps91}/${r.goals92}/${r.ast93}`
      const off =
        c.recStart != null ? `${r.apps52}/${r.goals44}/${r.ast53}@${c.recStart}` : '—'
      console.log(
        `  ${isPick ? ' *  ' : '    '} ${String(c.anchor).padStart(7)}  ${pad(c.kind, 14)}  ${String(c.v4).padStart(5)}  ${String(c.stats.apps).padStart(3)} ${String(c.stats.goals).padStart(2)} ${String(c.stats.assists).padStart(2)}   ${pad(slot76, 16)} ${pad(slot91, 16)} ${off}`,
      )
    }
    if (!anchors.length || !chosen?.decoded) {
      console.log(`\n  ── Raw id hits in blob (${occ.length}) ──`)
      if (!occ.length) {
        console.log('    (player.dat id not found as int32 in player stats.dat)')
      }
      for (const anchor of occ) {
        const v4 = statsBuf.readInt32LE(anchor + 4)
        const rec = offGridRecordStart(statsBuf, anchor, t.playerDatId, idHits)
        const stats = readSummaryStatsAtAnchor(statsBuf, anchor, t.playerDatId)
        const recNote = rec != null ? `rec@${rec}` : '—'
        const dec = stats ? `${stats.apps}/${stats.goals}/${stats.assists}` : '—'
        console.log(
          `    @${anchor}  v4=${v4}  offGridRec=${recNote}  summaryDecode=${dec}`,
        )
      }
    }

    const showResearch = researchRows.slice(0, maxGridRows)
    console.log(
      `\n  ── Research grid rows (V0 field map, grid + off-grid) — ${researchRows.length} total, showing ${showResearch.length} ──`,
    )
    console.log('  src       row@     compId  ok?  apps  g   a   rat   competition')
    for (const r of showResearch) {
      const ok = isResolvedCompetitionId(r.competitionId, t.playerDatId, db.clubCompsById, db.staffCompsById)
      const rat = r.averageRating != null ? r.averageRating.toFixed(2) : '—'
      console.log(
        `  ${pad(r.source, 9)} ${String(r.rowStart).padStart(7)}  ${String(r.competitionId ?? '—').padStart(6)}  ${ok ? 'yes' : 'no '}  ${String(r.apps ?? '—').padStart(3)} ${String(r.goals ?? '—').padStart(2)} ${String(r.assists ?? '—').padStart(2)}  ${rat.padStart(5)}  ${compLabel(r.competitionId, db).slice(0, 40)}`,
      )
    }
    if (researchRows.length > showResearch.length) {
      console.log(`    ... ${researchRows.length - showResearch.length} more`)
    }

    if (gatedResearch.length !== researchRows.length) {
      console.log(
        `\n  App research table (gated/deduped): ${gatedResearch.length} row(s) — used in profile per-comp table`,
      )
    }
  }

  console.log(
    '\nDone. For each player, check CM Senior club vs the CHOSEN line. If an anchor row matches, note its kind (+76 vs off-grid).\n',
  )
}

main()
