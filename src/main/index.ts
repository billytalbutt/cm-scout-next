import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { buildUiRows, parseIndexDat } from './database/parser'
import { getSuggestedDatabaseFolder, getSuggestedSaveGameFolder } from './cm0102Paths'
import type { ParsedDatabase, UiPlayerRow } from './database/types'
import { DEMO_STAFF_INDEX, getDemoUiPlayerRow } from './demoTsigalko'
import { buildProfilePayload } from './profilePayload'

const __dirname = dirname(fileURLToPath(import.meta.url))

let loaded: { db: ParsedDatabase; rows: UiPlayerRow[] } | null = null

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

function allRowsWithDemo(): UiPlayerRow[] {
  const demo = getDemoUiPlayerRow()
  if (!loaded) return [demo]
  return [demo, ...loaded.rows]
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CM Scout Next',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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
    getSuggestedDatabaseFolder() ?? getSuggestedSaveGameFolder() ?? homedir()
  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined

  const opts = {
    title: 'Load database',
    defaultPath: suggested,
    buttonLabel: 'Load',
    properties: ['openFile'] as const,
    filters: [
      { name: 'index.dat (CM0102 database)', extensions: ['dat'] },
      { name: 'Save games', extensions: ['sav'] },
      { name: 'All files', extensions: ['*'] },
    ],
  }
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return { ok: false as const, error: 'cancelled' }
  try {
    const db = parseSaveOrIndex(r.filePaths[0])
    const rows = buildUiRows(db)
    loaded = { db, rows }
    return {
      ok: true as const,
      path: r.filePaths[0],
      compressed: db.compressed,
      gameDate: db.gameDateIso,
      playerCount: rows.length,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
})

ipcMain.handle('get-rows', async (_e, filter: unknown) => {
  let rows = allRowsWithDemo()
  const f = filter as {
    q?: string
    nation?: string
    club?: string
    caMin?: number
    caMax?: number
    paMin?: number
    paMax?: number
  }
  const q = (f.q ?? '').trim().toLowerCase()
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q))
  if (f.nation?.trim()) {
    const n = f.nation.trim().toLowerCase()
    rows = rows.filter((r) => r.nation.toLowerCase().includes(n))
  }
  if (f.club?.trim()) {
    const c = f.club.trim().toLowerCase()
    rows = rows.filter((r) => r.club.toLowerCase().includes(c))
  }
  if (f.caMin != null) rows = rows.filter((r) => r.ca >= f.caMin!)
  if (f.caMax != null) rows = rows.filter((r) => r.ca <= f.caMax!)
  if (f.paMin != null) rows = rows.filter((r) => r.pa >= f.paMin!)
  if (f.paMax != null) rows = rows.filter((r) => r.pa <= f.paMax!)
  return rows.map((r) => ({
    staffId: r.staffId,
    staffIndex: r.staffIndex,
    name: r.name,
    nation: r.nation,
    club: r.club,
    ca: r.ca,
    pa: r.pa,
    wage: r.wage,
    value: r.value,
    isDemo: r.staffIndex === DEMO_STAFF_INDEX,
  }))
})

ipcMain.handle('get-profile', async (_e, staffIndex: number) => {
  if (staffIndex === DEMO_STAFF_INDEX) {
    const payload = buildProfilePayload(getDemoUiPlayerRow())
    return { ...payload, isDemo: true as const }
  }
  if (!loaded) return null
  const row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) return null
  return { ...buildProfilePayload(row), isDemo: false as const }
})
