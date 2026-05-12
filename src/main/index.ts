import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { calendarDaysBetween } from './database/dates'
import { buildUiRows, parseIndexDat } from './database/parser'
import { getSuggestedDatabaseFolder, getSuggestedSaveGameFolder } from './cm0102Paths'
import {
  applyCmScoutRatings,
  listedForLoan,
  passesAttributeMins,
  transferListedByClub,
  transferListedByRequest,
} from './cmScoutRating'
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
    applyCmScoutRatings(rows)
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
    ageMin?: number
    ageMax?: number
    valueMin?: number
    valueMax?: number
    wageMin?: number
    wageMax?: number
    contractType?: number
    transferListedClub?: boolean
    transferListedRequest?: boolean
    listedForLoan?: boolean
    euPassport?: boolean
    leavingOnBosman?: boolean
    /** Contract end within this many months from game date (inclusive); requires contract row + valid dates */
    contractExpiresWithinMonths?: number
    hasMinimumReleaseClause?: boolean
    attrMins?: (number | null)[]
  }
  const q = (f.q ?? '').trim().toLowerCase()
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q))
  if (f.nation?.trim()) {
    const n = f.nation.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.nation.toLowerCase().includes(n) ||
        (r.secondNation && r.secondNation.toLowerCase().includes(n)),
    )
  }
  if (f.club?.trim()) {
    const c = f.club.trim().toLowerCase()
    rows = rows.filter((r) => r.club.toLowerCase().includes(c))
  }
  if (f.caMin != null) rows = rows.filter((r) => r.ca >= f.caMin!)
  if (f.caMax != null) rows = rows.filter((r) => r.ca <= f.caMax!)
  if (f.paMin != null) rows = rows.filter((r) => r.pa >= f.paMin!)
  if (f.paMax != null) rows = rows.filter((r) => r.pa <= f.paMax!)
  if (f.ageMin != null) rows = rows.filter((r) => r.age != null && r.age >= f.ageMin!)
  if (f.ageMax != null) rows = rows.filter((r) => r.age != null && r.age <= f.ageMax!)
  if (f.valueMin != null) rows = rows.filter((r) => r.value >= f.valueMin!)
  if (f.valueMax != null) rows = rows.filter((r) => r.value <= f.valueMax!)
  if (f.wageMin != null) rows = rows.filter((r) => r.wage >= f.wageMin!)
  if (f.wageMax != null) rows = rows.filter((r) => r.wage <= f.wageMax!)
  if (typeof f.contractType === 'number' && !Number.isNaN(f.contractType)) {
    rows = rows.filter((r) => r.contract && r.contract.contract_type === f.contractType)
  }
  const wantTl =
    f.transferListedClub === true || f.transferListedRequest === true || f.listedForLoan === true
  if (wantTl) {
    rows = rows.filter((r) => {
      const c = r.contract
      if (!c) return false
      const ts = c.transfer_status
      let ok = false
      if (f.transferListedClub && transferListedByClub(ts)) ok = true
      if (f.transferListedRequest && transferListedByRequest(ts)) ok = true
      if (f.listedForLoan && listedForLoan(ts)) ok = true
      return ok
    })
  }
  if (f.euPassport === true) {
    rows = rows.filter((r) => r.euPassport)
  }
  if (f.leavingOnBosman === true) {
    rows = rows.filter((r) => r.contract != null && r.contract.leaving_on_bosman > 0)
  }
  if (f.hasMinimumReleaseClause === true) {
    rows = rows.filter((r) => r.contract != null && r.contract.minimum_fee_rc > 0)
  }
  if (f.contractExpiresWithinMonths != null && Number.isFinite(f.contractExpiresWithinMonths)) {
    const gameIso = loaded?.db.gameDateIso
    if (gameIso) {
      const maxM = Math.max(0, Math.min(120, f.contractExpiresWithinMonths))
      const maxDays = Math.ceil(maxM * 30.4375)
      rows = rows.filter((r) => {
        const exp = r.contract?.contract_expires_iso
        if (!exp) return false
        const d = calendarDaysBetween(gameIso, exp)
        if (d == null) return false
        return d >= 0 && d <= maxDays
      })
    }
  }
  if (f.attrMins?.length) {
    rows = rows.filter((r) => passesAttributeMins(r.cmAttrNorm, f.attrMins!))
  }
  return rows.map((r) => ({
    staffId: r.staffId,
    staffIndex: r.staffIndex,
    name: r.name,
    nation: r.nation,
    secondNation: r.secondNation,
    club: r.club,
    ca: r.ca,
    pa: r.pa,
    wage: r.wage,
    value: r.value,
    age: r.age,
    euPassport: r.euPassport,
    cmScoutRatingBp: r.cmScoutRatingBp,
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
