import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname, basename, extname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { computeEffectivenessFull } from '../shared/effectivenessEngine'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'
import { buildUiRows, parseIndexDat, buildUiPlayerRowAtIndex } from './database/parser'
import { collectStaffHistorySearchDirs } from './database/staffHistoryLoad'
import { getDefaultOpenDatabaseDirectory, getSuggestedSaveGameFolder } from './cm0102Paths'
import { applyCmScoutRatings } from './cmScoutRating'
import { applyEffectivenessRatings } from './effectivenessRating'
import { applyEngineMetaProfiles } from './engineMetaProfiles'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { buildProfilePayload } from './profilePayload'
import { mapUiRowToGridPayload } from './gridRowPayload'
import {
  baselineStatusForPath,
  buildBaselineFromRows,
  deleteBaselineFromDisk,
  loadBaselineFromDisk,
  pathKeyForDb,
  saveBaselineToDisk,
} from './regenBaseline'
import { applyRegenPipeline } from './regenDetection'
import type { GridIncludeFlags } from '../shared/gridTypes'
import { ENGINE_SNIFFER_IDS, type EngineSnifferId } from './engineSniffer'
import { filterUiPlayerRows, type GetRowsFilter } from './gridRowFilter'
import { filterStaffGridRows } from './staffBrowse'
import { buildClubSquadPlayerRows, buildClubDetailPayload, filterClubListRows } from './clubBrowse'
import { buildStaffProfilePayload } from './staffProfilePayload'
import {
  buildEditorValueMap,
  buildPatchedArchiveBuffer,
  editorSubjectLabel,
} from './attributeEditorSave'

const __dirname = dirname(fileURLToPath(import.meta.url))

let loaded: {
  db: ParsedDatabase
  rows: UiPlayerRow[]
  indexPath: string
  pathKey: string
  /** Bytes of the archive that was parsed (same buffer we patch for saves). */
  archiveBuf: Buffer
} | null = null

/**
 * CM Scout–style: open *.sav or index.dat; same block directory format.
 * Returns the DB plus the exact buffer that was parsed (for later attribute patching).
 */
function loadArchiveForPath(selectedPath: string): { db: ParsedDatabase; archiveBuf: Buffer } {
  let archiveBuf = readFileSync(selectedPath)
  const historyDirs = collectStaffHistorySearchDirs(selectedPath)
  const parseOpts = { staffHistorySearchDirs: historyDirs }
  try {
    return { db: parseIndexDat(archiveBuf, parseOpts), archiveBuf }
  } catch (e) {
    const lower = basename(selectedPath).toLowerCase()
    if (lower.endsWith('.sav')) {
      const alt = join(dirname(selectedPath), 'index.dat')
      if (existsSync(alt)) {
        archiveBuf = readFileSync(alt)
        return {
          db: parseIndexDat(archiveBuf, {
            staffHistorySearchDirs: collectStaffHistorySearchDirs(alt),
          }),
          archiveBuf,
        }
      }
    }
    throw e
  }
}

function sortedUniqueClubNames(db: ParsedDatabase): string[] {
  const seen = new Set<string>()
  for (const name of db.clubNames.values()) {
    const t = name.trim()
    if (t) seen.add(t)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function sortedUniqueNationNames(db: ParsedDatabase): string[] {
  const seen = new Set<string>()
  for (const name of db.nationNames.values()) {
    const t = name.trim()
    if (t) seen.add(t)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function allRowsForGrid(): UiPlayerRow[] {
  if (!loaded) return []
  return loaded.rows
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CM Merlin Scout',
    webPreferences: {
      // Must be CommonJS: sandboxed preloads cannot use ESM `import` (see Electron docs).
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('open-database', async (event) => {
  const suggested =
    getDefaultOpenDatabaseDirectory() ?? getSuggestedSaveGameFolder() ?? homedir()
  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined

  const opts = {
    title: 'Load database',
    defaultPath: suggested,
    buttonLabel: 'Load',
    properties: ['openFile'] as const,
    /** One filter with both extensions so macOS NSSavePanel does not grey out .sav when .dat is first. */
    filters: [
      { name: 'CM0102 (index.dat, .sav)', extensions: ['dat', 'sav'] },
      { name: 'All files', extensions: ['*'] },
    ],
  }
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return { ok: false as const, error: 'cancelled' }
  try {
    const indexPath = r.filePaths[0]
    const { db, archiveBuf } = loadArchiveForPath(indexPath)
    const rows = buildUiRows(db)
    applyCmScoutRatings(rows)
    applyEffectivenessRatings(rows)
    applyEngineMetaProfiles(rows)
    const pathKey = pathKeyForDb(indexPath)
    const baseline = loadBaselineFromDisk(pathKey)
    applyRegenPipeline(rows, baseline, pathKey)
    loaded = { db, rows, indexPath, pathKey, archiveBuf }
    return {
      ok: true as const,
      path: indexPath,
      compressed: db.compressed,
      gameDate: db.gameDateIso,
      playerCount: rows.length,
      staffDatRows: db.staff.length,
      playerBlobRows: db.players.length,
      clubs: sortedUniqueClubNames(db),
      nations: sortedUniqueNationNames(db),
      regenBaseline: baselineStatusForPath(pathKey),
      staffHistoryParsed: db.staffHistoryParsed ?? false,
      staffHistorySourcePath: db.staffHistorySourcePath,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
})

ipcMain.handle('get-rows', async (_e, payload: unknown) => {
  const raw = { ...(payload as Record<string, unknown>) }
  const offset = Math.max(0, Math.floor(Number(raw.offset) || 0))
  const limitRaw = raw.limit
  const hasLimit =
    limitRaw !== undefined && limitRaw !== null && limitRaw !== '' && Number.isFinite(Number(limitRaw))
  const limit = hasLimit ? Math.max(1, Math.floor(Number(limitRaw))) : undefined

  const gridInclude = (raw.gridInclude ?? {}) as GridIncludeFlags
  delete raw.offset
  delete raw.limit
  delete raw.gridInclude

  const es = raw.engineSniffer
  if (typeof es === 'string' && (ENGINE_SNIFFER_IDS as readonly string[]).includes(es)) {
    ;(raw as GetRowsFilter).engineSniffer = es as EngineSnifferId
  } else {
    delete raw.engineSniffer
  }

  const ammRaw = raw.attrMinMatchAtLeast
  delete raw.attrMinMatchAtLeast
  if (ammRaw !== undefined && ammRaw !== null && ammRaw !== '') {
    const n = Math.floor(Number(ammRaw))
    if (Number.isFinite(n) && n >= 1) {
      ;(raw as GetRowsFilter).attrMinMatchAtLeast = n
    }
  }

  const gameDateIso = loaded?.db.gameDateIso ?? null
  const rows = filterUiPlayerRows(allRowsForGrid(), raw as GetRowsFilter, { gameDateIso })
  const total = rows.length
  const page = limit === undefined ? rows : rows.slice(offset, offset + limit)
  const mapped = page.map((r) => mapUiRowToGridPayload(r, gridInclude))
  return {
    total,
    rows: mapped,
    offset,
    capped: limit !== undefined && offset + mapped.length < total,
  }
})

ipcMain.handle('get-staff-rows', async (_e, payload: unknown) => {
  if (!loaded) return { total: 0, rows: [], offset: 0, capped: false }
  const raw = { ...(payload as Record<string, unknown>) }
  const offset = Math.max(0, Math.floor(Number(raw.offset) || 0))
  const limit = Math.max(1, Math.floor(Number(raw.limit) || 80))
  delete raw.offset
  delete raw.limit
  const jobRaw = raw.jobForClub ?? raw.job
  let jobForClub: number | undefined
  if (jobRaw !== undefined && jobRaw !== null && jobRaw !== '') {
    const jn = Math.floor(Number(jobRaw))
    if (Number.isFinite(jn)) jobForClub = jn
  }
  const all = filterStaffGridRows(loaded.db, {
    q: String(raw.q ?? ''),
    nation: String(raw.nation ?? ''),
    club: String(raw.club ?? ''),
    jobForClub,
    includePlayers: !!raw.includePlayers,
  })
  const total = all.length
  const page = all.slice(offset, offset + limit)
  return { total, rows: page, offset, capped: offset + page.length < total }
})

ipcMain.handle('get-club-rows', async (_e, payload: unknown) => {
  if (!loaded) return { total: 0, rows: [], offset: 0, capped: false }
  const raw = payload as Record<string, unknown>
  const offset = Math.max(0, Math.floor(Number(raw.offset) || 0))
  const limit = Math.max(1, Math.floor(Number(raw.limit) || 80))
  const q = String(raw.q ?? '')
  const all = filterClubListRows(loaded.db, q)
  const total = all.length
  const page = all.slice(offset, offset + limit)
  return { total, rows: page, offset, capped: offset + page.length < total }
})

ipcMain.handle('get-club-detail', async (_e, clubId: unknown) => {
  if (!loaded) return null
  const id = Math.floor(Number(clubId))
  return buildClubDetailPayload(loaded.db, id)
})

ipcMain.handle('get-staff-profile', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  return buildStaffProfilePayload(loaded.db, idx)
})

ipcMain.handle('get-profile', async (_e, staffIndex: number) => {
  if (!loaded) return null
  let row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) {
    const built = buildUiPlayerRowAtIndex(loaded.db, staffIndex)
    if (!built) return null
    applyCmScoutRatings([built])
    applyEffectivenessRatings([built])
    applyEngineMetaProfiles([built])
    row = built
  }
  return {
    ...buildProfilePayload(row, loaded.db.clubNames, loaded.db.gameDateIso, {
      nationSeasonUpdateDaySamples: loaded.db.nationSeasonUpdateDaySamples,
      clubCompsById: loaded.db.clubCompsById,
      clubDivisionCompIdByClubId: loaded.db.clubDivisionCompIdByClubId,
      staffHistoryParsed: loaded.db.staffHistoryParsed ?? false,
      staffHistorySourcePath: loaded.db.staffHistorySourcePath,
      playerStatsDatPresent: loaded.db.playerStatsDatPresent ?? false,
      savePerformancePerCompByPlayerDatId: loaded.db.savePerformancePerCompByPlayerDatId,
      savePerformanceByPlayerDatId: loaded.db.savePerformanceByPlayerDatId,
    }),
    isDemo: false as const,
  }
})

ipcMain.handle('get-effectiveness-detail', async (_e, staffIndex: number) => {
  if (!loaded) return null
  let row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) {
    const built = buildUiPlayerRowAtIndex(loaded.db, staffIndex)
    if (!built) return null
    applyCmScoutRatings([built])
    applyEffectivenessRatings([built])
    row = built
  }
  return computeEffectivenessFull(
    effectivenessAttrGetter(row.player, row.staff),
    eligibleEffectivenessArchetypeIds(row.player),
  )
})

ipcMain.handle('save-regen-baseline', async () => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  const file = buildBaselineFromRows(loaded.rows, loaded.indexPath, loaded.db.gameDateIso ?? null)
  saveBaselineToDisk(file)
  applyRegenPipeline(loaded.rows, file, loaded.pathKey)
  return { ok: true as const, ...baselineStatusForPath(loaded.pathKey) }
})

ipcMain.handle('clear-regen-baseline', async () => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  deleteBaselineFromDisk(loaded.pathKey)
  applyRegenPipeline(loaded.rows, null, loaded.pathKey)
  return { ok: true as const, ...baselineStatusForPath(loaded.pathKey) }
})

ipcMain.handle('get-editor-snapshot', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  const values = buildEditorValueMap(loaded.db, idx)
  if (!values) return null
  const s = loaded.db.staff[idx]!
  return {
    staffIndex: idx,
    staffId: s.id,
    name: editorSubjectLabel(loaded.db, idx) ?? '',
    playerRow: s.player_id,
    values,
  }
})

ipcMain.handle('save-attribute-edits', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  const p = payload as { staffIndex?: unknown; changes?: unknown }
  const staffIndex = Math.floor(Number(p.staffIndex))
  const ch = p.changes
  if (!Number.isFinite(staffIndex) || staffIndex < 0 || typeof ch !== 'object' || ch === null) {
    return { ok: false as const, error: 'Invalid save payload.' }
  }
  const changes = ch as Record<string, number>
  const built = buildPatchedArchiveBuffer(
    loaded.archiveBuf,
    loaded.db.blocks,
    loaded.db.compressed,
    loaded.db,
    staffIndex,
    changes,
  )
  if (!built.ok) return { ok: false as const, error: built.error }

  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined
  const base = basename(loaded.indexPath)
  const ext = extname(base) || '.dat'
  const stem = ext.length > 0 ? base.slice(0, -ext.length) : base
  const suggested = join(dirname(loaded.indexPath), `${stem}-edited${ext}`)
  const dlg = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Save edited database',
        defaultPath: suggested,
        filters: [
          { name: 'CM0102 archive', extensions: ['sav', 'dat'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
    : await dialog.showSaveDialog({
        title: 'Save edited database',
        defaultPath: suggested,
        filters: [
          { name: 'CM0102 archive', extensions: ['sav', 'dat'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
  if (dlg.canceled || !dlg.filePath) return { ok: false as const, error: 'cancelled' }
  try {
    writeFileSync(dlg.filePath, built.buffer)
    return { ok: true as const, path: dlg.filePath }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
})
