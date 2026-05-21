/**
 * Forensic discovery export for CM0102 in-game player stats (all sources, provenance).
 *
 * Usage:
 *   npm run discover:player-stats -- <path-to.sav>
 *   npm run discover:player-stats -- <save.sav> --names "Kieron Dyer,Joe Cole"
 *   npm run discover:player-stats -- <save.sav> --ids 118,5451 --json out/stats-discovery.json
 *   npm run discover:player-stats -- <save.sav> --expect "apps=12,goals=3,assists=1,rating=7.1"
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import {
  parseIndexDat,
  readArchiveBlock,
  staffDisplayName,
} from '../src/main/database/parser.ts'
import { parseStaffHistoryData } from '../src/main/database/staffHistory.ts'
import { collectStaffHistorySearchDirs } from '../src/main/database/staffHistoryLoad.ts'
import { tryReadStaffHistorySiblingFile } from '../src/main/database/staffHistory.ts'
import {
  buildPlayerDiscoveryReport,
  flattenCandidates,
  formatDiscoveryReportText,
  listSaveBlockInventory,
  parseExpectedStats,
  type ExpectedStats,
} from '../src/main/database/statsDiscovery.ts'

const DEFAULT_SAVE =
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'

const DEFAULT_NAMES = ['Kieron Dyer', 'Joe Cole', 'Xavi', 'Maxim Tsigalko']

function parseArgs(argv: string[]): {
  path: string
  names: string[]
  ids: number[]
  jsonPath: string | null
  expected: ExpectedStats | null
} {
  let path = argv[2]
  if (!path || path.startsWith('-')) {
    path = DEFAULT_SAVE
  }
  let names = [...DEFAULT_NAMES]
  let ids: number[] = []
  let jsonPath: string | null = null
  let expected: ExpectedStats | null = null

  const startIdx = argv[2] && !argv[2]!.startsWith('-') ? 3 : 2
  for (let i = startIdx; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--names' && argv[i + 1]) {
      names = argv[++i]!.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a === '--ids' && argv[i + 1]) {
      ids = argv[++i]!
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))
    } else if (a === '--json' && argv[i + 1]) {
      jsonPath = argv[++i]!
    } else if (a === '--expect' && argv[i + 1]) {
      expected = parseExpectedStats(argv[++i]!)
    }
  }

  return { path, names, ids, jsonPath, expected }
}

function normalizeNameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
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

type PlayerTarget = {
  name: string
  playerDatId: number
  staffId: number
  staffRowOffset: number
  club: string
  clubJobId: number
}

function resolveTargets(
  db: ReturnType<typeof parseIndexDat>,
  names: string[],
  ids: number[],
): PlayerTarget[] {
  const allStaff: PlayerTarget[] = []
  for (let si = 0; si < db.staff.length; si++) {
    const s = db.staff[si]!
    if (s.player_id < 0 || s.player_id >= db.players.length) continue
    const playerDatId = db.players[s.player_id]!.id
    const name = staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames)
    const club = db.clubNames.get(s.club_job_id) ?? ''
    allStaff.push({
      name,
      playerDatId,
      staffId: s.id,
      staffRowOffset: si * 110,
      club,
      clubJobId: s.club_job_id,
    })
  }

  if (ids.length) {
    return ids
      .map(
        (id) =>
          allStaff.find((p) => p.playerDatId === id) ?? {
            name: `player.dat id ${id}`,
            playerDatId: id,
            staffId: -1,
            staffRowOffset: -1,
            club: '?',
            clubJobId: -1,
          },
      )
      .slice(0, 8)
  }

  const picked: PlayerTarget[] = []
  const seen = new Set<number>()
  for (const name of names) {
    const candidates = allStaff.filter((p) => nameMatchesSingle(p.name, name))
    if (!candidates.length) continue
    const blackburn = candidates.filter((p) => p.club.toLowerCase().includes('blackburn'))
    const pool = blackburn.length ? blackburn : candidates
    pool.sort((a, b) => a.staffId - b.staffId)
    const p = pool[0]!
    if (seen.has(p.playerDatId)) continue
    seen.add(p.playerDatId)
    picked.push(p)
  }
  if (picked.length) return picked
  return allStaff.slice(0, 4)
}

function loadStaffHistoryRows(
  db: ReturnType<typeof parseIndexDat>,
  savePath: string,
): { rows: ReturnType<typeof parseStaffHistoryData>; source: 'embedded' | 'sibling' | 'none' } {
  const fromMap = db.staffHistoryByStaffId
  if (fromMap?.size) {
    const rows: ReturnType<typeof parseStaffHistoryData> = []
    for (const list of fromMap.values()) rows.push(...list)
    return { rows, source: 'embedded' }
  }

  for (const dir of collectStaffHistorySearchDirs(savePath)) {
    const raw = tryReadStaffHistorySiblingFile(dir)
    if (raw?.length) {
      return { rows: parseStaffHistoryData(raw), source: 'sibling' }
    }
  }

  return { rows: [], source: 'none' }
}

function main(): void {
  const { path, names, ids, jsonPath, expected } = parseArgs(process.argv)
  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const targets = resolveTargets(db, names, ids)

  const readBlock = (name: string) => readArchiveBlock(file, name)
  const blockInventory = listSaveBlockInventory(readBlock)
  const playerStatsBuf = readBlock('player stats.dat')
  const playerStatsHistoryBuf = readBlock('player stats history.tmp')
  const { rows: staffHistoryRows, source: staffHistorySource } = loadStaffHistoryRows(db, path)

  const staffById = new Map<number, { int_apps: number; int_goals: number }>()
  for (const s of db.staff) {
    staffById.set(s.id, { int_apps: s.int_apps, int_goals: s.int_goals })
  }

  const report = buildPlayerDiscoveryReport({
    savePath: path,
    gameDateIso: db.gameDateIso ?? null,
    blockInventory,
    playerStatsBuf,
    playerStatsHistoryBuf,
    staffHistoryRows,
    staffHistorySource,
    players: targets,
    clubCompsById: db.clubCompsById,
    staffCompsById: db.staffCompsById,
    staffById,
    expected,
  })

  console.log(formatDiscoveryReportText(report))
  console.log(`staff_history source: ${staffHistorySource}`)

  if (jsonPath) {
    const dir = dirname(jsonPath)
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* exists */
    }
    const payload = {
      ...report,
      allCandidates: flattenCandidates(report),
      meta: {
        generatedAt: new Date().toISOString(),
        saveBasename: basename(path),
        staffHistorySource,
      },
    }
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8')
    console.log(`Wrote JSON → ${jsonPath}`)
  }
}

main()
