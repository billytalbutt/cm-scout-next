import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { computeEffectivenessFull, playerAttrGetter } from '../shared/effectivenessEngine'
import { buildUiRows, parseIndexDat } from './database/parser'
import { getDefaultOpenDatabaseDirectory, getSuggestedSaveGameFolder } from './cm0102Paths'
import { applyCmScoutRatings } from './cmScoutRating'
import { applyEffectivenessRatings } from './effectivenessRating'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { DEMO_STAFF_INDEX, getDemoUiPlayerRow } from './demoTsigalko'
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
import type { EngineSnifferId } from './engineSniffer'
import { filterUiPlayerRows, type GetRowsFilter } from './gridRowFilter'

const __dirname = dirname(fileURLToPath(import.meta.url))

let loaded: { db: ParsedDatabase; rows: UiPlayerRow[]; indexPath: string; pathKey: string } | null = null

/** CM Scout–style: open *.sav or index.dat; same block directory format. */
function parseSaveOrIndex(selectedPath: string): ParsedDatabase {
  const buf = readFileSync(selectedPath)
  try {
    return parseIndexDat(buf)
  } catch (e) {
    const lower = basename(selectedPath).toLowerCase()
    if (lower.endsWith('.sav')) {
      const alt = join(dirname(selectedPath), 'index.dat')
      if (existsSync(alt)) {
        const b2 = readFileSync(alt)
        return parseIndexDat(b2)
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

/** When a save is loaded, return only real rows (demo would bloat IPC and confuse counts). */
function allRowsForGrid(): UiPlayerRow[] {
  if (!loaded) return [getDemoUiPlayerRow()]
  return loaded.rows
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CM Scout Next',
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
    const db = parseSaveOrIndex(indexPath)
    const rows = buildUiRows(db)
    applyCmScoutRatings(rows)
    applyEffectivenessRatings(rows)
    const pathKey = pathKeyForDb(indexPath)
    const baseline = loadBaselineFromDisk(pathKey)
    applyRegenPipeline(rows, baseline, pathKey)
    loaded = { db, rows, indexPath, pathKey }
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
  if (es === 'assist_prospect' || es === 'striker_finisher') {
    ;(raw as GetRowsFilter).engineSniffer = es as EngineSnifferId
  } else {
    delete raw.engineSniffer
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

ipcMain.handle('get-profile', async (_e, staffIndex: number) => {
  if (staffIndex === DEMO_STAFF_INDEX) {
    const demoClub = new Map<number, string>([[0, 'Dinamo Minsk']])
    const payload = buildProfilePayload(getDemoUiPlayerRow(), demoClub, '2002-05-12', {
      nationSeasonUpdateDaySamples: [],
      clubDivisionCompIdByClubId: new Map(),
      staffHistoryParsed: true,
    })
    return { ...payload, isDemo: true as const }
  }
  if (!loaded) return null
  const row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) return null
  return {
    ...buildProfilePayload(row, loaded.db.clubNames, loaded.db.gameDateIso, {
      nationSeasonUpdateDaySamples: loaded.db.nationSeasonUpdateDaySamples,
      clubCompsById: loaded.db.clubCompsById,
      clubDivisionCompIdByClubId: loaded.db.clubDivisionCompIdByClubId,
      staffHistoryParsed: loaded.db.staffHistoryParsed ?? false,
    }),
    isDemo: false as const,
  }
})

ipcMain.handle('get-effectiveness-detail', async (_e, staffIndex: number) => {
  if (staffIndex === DEMO_STAFF_INDEX) {
    const row = getDemoUiPlayerRow()
    return computeEffectivenessFull(playerAttrGetter(row.player as Record<string, number>))
  }
  if (!loaded) return null
  const row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) return null
  return computeEffectivenessFull(playerAttrGetter(row.player as Record<string, number>))
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
