/**
 * Compare Senior club decode for named players across two saves (same table format).
 *
 * Usage:
 *   npx tsx scripts/compare-senior-club-players.ts <older.sav> <newer.sav> [--names "A,B,C"]
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  parseIndexDat,
  readArchiveBlock,
  staffDisplayName,
} from '../src/main/database/parser.ts'
import {
  inspectSeniorClubAnchorsForPlayer,
  pickSummaryAnchorForPlayer,
  type SeniorClubSlotKind,
} from '../src/main/database/playerStatsSummary.ts'
import { collectPlayerDatIdOccurrences } from '../src/main/database/playerStatsDat.ts'

const DEFAULT_NAMES = ['Kieron Dyer', 'Joe Cole', 'Maxim Tsigalko']

function parseArgs(argv: string[]): { oldPath: string; newPath: string; names: string[] } {
  const oldPath = argv[2]
  const newPath = argv[3]
  if (!oldPath || !newPath) {
    console.error(
      'Usage: npx tsx scripts/compare-senior-club-players.ts <older.sav> <newer.sav> [--names "A,B"]',
    )
    process.exit(1)
  }
  let names = [...DEFAULT_NAMES]
  for (let i = 4; i < argv.length; i++) {
    if (argv[i] === '--names' && argv[i + 1]) {
      names = argv[++i]!.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return { oldPath, newPath, names }
}

function nameMatchesSingle(name: string, target: string): boolean {
  const n = name.toLowerCase()
  const t = target.toLowerCase()
  if (n === t) return true
  if (/tsigalk/i.test(t) && /tsigalk/i.test(name)) return true
  if (/maksim/i.test(t) && /maxim/i.test(name)) return true
  if (/maxim/i.test(t) && /maksim/i.test(name)) return true
  return false
}

type Target = { name: string; playerDatId: number; staffId: number; club: string }

function resolveTargets(db: ReturnType<typeof parseIndexDat>, names: string[]): Target[] {
  const all: Target[] = []
  for (const s of db.staff) {
    if (s.player_id < 0 || s.player_id >= db.players.length) continue
    all.push({
      name: staffDisplayName(s, db.firstNames, db.secondNames, db.commonNames),
      playerDatId: db.players[s.player_id]!.id,
      staffId: s.id,
      club: db.clubNames.get(s.club_job_id) ?? '',
    })
  }
  const out: Target[] = []
  const seen = new Set<number>()
  for (const want of names) {
    const candidates = all.filter((p) => nameMatchesSingle(p.name, want))
    const blackburn = candidates.filter((c) => c.club.toLowerCase().includes('blackburn'))
    const pick = (blackburn.length ? blackburn : candidates).sort((a, b) => a.staffId - b.staffId)[0]
    if (!pick || seen.has(pick.playerDatId)) continue
    seen.add(pick.playerDatId)
    out.push(pick)
  }
  return out
}

type Row = {
  name: string
  playerDatId: number
  saveLabel: string
  gameDate: string | null
  layout: SeniorClubSlotKind | '—'
  apps: number | '—'
  goals: number | '—'
  assists: number | '—'
  anchor: number | '—'
  idHits: number
}

function decodeSave(
  path: string,
  saveLabel: string,
  targets: Target[],
  players: ReturnType<typeof parseIndexDat>['players'],
): Row[] {
  const file = readFileSync(path)
  const db = parseIndexDat(file)
  const statsBuf = readArchiveBlock(file, 'player stats.dat')
  if (!statsBuf?.length) throw new Error(`No player stats.dat in ${path}`)
  const playerIds = new Set(players.map((p) => p.id))
  const occMap = collectPlayerDatIdOccurrences(statsBuf, playerIds)

  const rows: Row[] = []
  for (const t of targets) {
    const picked = pickSummaryAnchorForPlayer(statsBuf, t.playerDatId, players)
    const idHits = occMap.get(t.playerDatId)?.length ?? 0
    const anchors = inspectSeniorClubAnchorsForPlayer(statsBuf, t.playerDatId, idHits)
    const chosenKind =
      picked != null
        ? (anchors.find((a) => a.anchor === picked.anchor)?.kind ?? 'other')
        : '—'

    rows.push({
      name: t.name,
      playerDatId: t.playerDatId,
      saveLabel,
      gameDate: db.gameDateIso,
      layout: chosenKind,
      apps: picked?.decoded.apps ?? '—',
      goals: picked?.decoded.goals ?? '—',
      assists: picked?.decoded.assists ?? '—',
      anchor: picked?.anchor ?? '—',
      idHits,
    })
  }
  return rows
}

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s.padEnd(w)
}

function main(): void {
  const { oldPath, newPath, names } = parseArgs(process.argv)
  const oldFile = readFileSync(oldPath)
  const oldDb = parseIndexDat(oldFile)
  const targets = resolveTargets(oldDb, names)

  console.log(`\nSenior club decode — compare saves`)
  console.log(`  Older: ${basename(oldPath)}`)
  console.log(`  Newer: ${basename(newPath)}`)
  console.log(`  CM: Player → Stats → Senior club (all competitions combined)\n`)

  const oldRows = decodeSave(oldPath, 'older', targets, oldDb.players)
  const newDb = parseIndexDat(readFileSync(newPath))
  const newRows = decodeSave(newPath, 'newer', targets, newDb.players)

  const wName = Math.max(14, ...targets.map((t) => t.name.length))
  console.log(
    pad('Player', wName) +
      '  save     date        layout          apps  g   a   anchor      hits',
  )
  console.log('-'.repeat(wName + 72))

  for (const t of targets) {
    for (const block of [oldRows, newRows]) {
      const r = block.find((x) => x.playerDatId === t.playerDatId)!
      const layout = String(r.layout).padEnd(14)
      console.log(
        pad(r.name, wName) +
          `  ${pad(r.saveLabel, 8)}  ${(r.gameDate ?? '?').slice(0, 10)}  ${layout}  ` +
          `${String(r.apps).padStart(4)}  ${String(r.goals).padStart(2)}  ${String(r.assists).padStart(2)}  ` +
          `${String(r.anchor).padStart(10)}  ${String(r.idHits).padStart(4)}`,
      )
    }
    console.log('')
  }

  console.log('Layout key:')
  console.log('  embedded     = Cole-style record (+13 / +26 / +30 from record start)')
  console.log('  slotB-senior = Dyer-style (+76 / +77 / +78 at id anchor)')
  console.log('  offGrid      = Tsigalko-style (v4 = -1, +52 / +44 / +53)')
  console.log('  —            = no anchor passed filters (tell us CM numbers)\n')
}

main()
