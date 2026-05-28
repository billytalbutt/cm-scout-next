import { app, BrowserWindow, ipcMain, dialog, screen, type WebContents } from 'electron'
import { applyAppIcon, resolveAppIcon } from './appIcon'
import { join, dirname, basename, extname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { computeEffectivenessFull } from '../shared/effectivenessEngine'
import { profileNavStep, type ProfileNavigationContext } from '../shared/profileNavigation'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'
import {
  buildUiRows,
  parseIndexDat,
  buildUiPlayerRowAtIndex,
  patchUiRowsCurrentSeason,
} from './database/parser'
import { buildPlayerCurrentSeasonIndex } from './database/playerStatsCurrentSeason'
import type { DatabaseLoadProgress } from '../shared/loadProgress'
import { collectStaffHistorySearchDirs } from './database/staffHistoryLoad'
import { getDefaultOpenDatabaseDirectory, getSuggestedSaveGameFolder } from './cm0102Paths'
import {
  applyCmScoutRatings,
  intrinsicRaw48,
  scoutFilterComparisonVector48,
  scoutDisplayVector48,
} from './cmScoutRating'
import { attrMinStringsFromComparisonVectors } from '../shared/attrFilterMins'
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
import {
  baselineTracksDevelopment,
  buildAllDevelopmentSummaries,
  buildPlayerDevelopmentSummary,
  developmentTotals,
  filterAndSortDevelopmentRows,
} from './playerDevelopment'
import { loadShortlistStoreFromDisk, saveShortlistStoreToDisk } from './shortlistStore'
import type { ShortlistStore } from '../shared/shortlistTypes'
import type { GridIncludeFlags } from '../shared/gridTypes'
import { ENGINE_SNIFFER_IDS, type EngineSnifferId } from './engineSniffer'
import { filterUiPlayerRows, type GetRowsFilter } from './gridRowFilter'
import {
  parsePositionRoleFilterIds,
  parsePositionSideFilterIds,
} from '../shared/playerPositionFilter'
import { filterStaffGridRows } from './staffBrowse'
import {
  buildClubDetailPayload,
  buildClubSquadGridRows,
  buildClubSquadPlayerRows,
  filterClubListRows,
} from './clubBrowse'
import type { ContractTypeCategoryId } from '../shared/contractTypes'
import { buildStaffProfilePayload } from './staffProfilePayload'
import { verifyClubCashOnArchive } from './database/clubCashPatch'
import { refreshClubCashFromArchive } from './database/clubRecords'
import {
  archiveSiblingsLookOutOfSync,
  readArchiveFromDisk,
  refreshArchiveBufferFromDisk,
  writeArchiveToDiskSiblings,
} from './archiveSync'
import { injuryTypeLabel, readPlayerInjuryFromArchive } from './database/injuryHistory'
import { buildClubEditorSnapshot, buildPatchedArchiveForClubEdits } from './clubEditorSave'
import {
  buildEditorValueMap,
  buildPatchedArchiveBuffer,
  editorSubjectLabel,
} from './attributeEditorSave'
import {
  buildContractEditorPatchedBuffer,
  buildContractEditorSnapshot,
} from './contractEditorSave'
import {
  buildStaffEditorPatchedBuffer,
  buildStaffEditorSnapshot,
} from './staffEditorSave'
import { buildCmScoutPlsBuffer, PLS_MAX_PLAYERS, type PlsStaffEntry } from './cmScoutPls'
import type { PitchSlot } from '../shared/tacticsPitchSnap'
import type { GridPlayerRow } from '../shared/gridTypes'
import { pickWorldXiLineup } from './worldXi'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ARCHIVE_SIBLING_SYNC_WARNING =
  'This folder has multiple save files (e.g. Game.sav and index.dat) with different sizes or dates. Open the same file you Continue in CM; quit CM before saving here.'

let loaded: {
  db: ParsedDatabase
  rows: UiPlayerRow[]
  indexPath: string
  pathKey: string
  /** Bytes of the archive that was parsed (same buffer we patch for saves). */
  archiveBuf: Buffer
} | null = null

/** Re-read the loaded .sav path and refresh club bank balances from club.dat on disk. */
/** Refresh club cash from the user-selected path without swapping the parsed archive buffer. */
function syncClubCashFromUserPath(): void {
  if (!loaded) return
  try {
    const fresh = refreshArchiveBufferFromDisk(loaded.indexPath)
    refreshClubCashFromArchive(fresh.buffer, loaded.db.clubsById)
  } catch {
    /* keep in-memory cash if disk read fails */
  }
}

function syncLoadedArchiveFromDisk(): void {
  if (!loaded) return
  try {
    const fresh = refreshArchiveBufferFromDisk(loaded.indexPath)
    loaded.archiveBuf = fresh.buffer
    refreshClubCashFromArchive(loaded.archiveBuf, loaded.db.clubsById)
  } catch {
    /* keep in-memory buffer if disk read fails */
  }
}

const profileWindows = new Map<string, BrowserWindow>()
let mainBrowserWindow: BrowserWindow | null = null

function notifyMainWindowPopoutSelection(staffIndex: number): void {
  if (!mainBrowserWindow || mainBrowserWindow.isDestroyed()) return
  mainBrowserWindow.webContents.send('profile-popout-selection', { staffIndex })
}
const profileNavByWebContents = new Map<
  number,
  { kind: 'player' | 'staff'; nav: ProfileNavigationContext }
>()

function profileWindowKey(kind: 'player' | 'staff'): string {
  return `profile:${kind}`
}

function parseStaffIndexFromProfileUrl(url: string): number | null {
  try {
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    const staffIndex = Number(new URLSearchParams(q).get('staffIndex'))
    return Number.isFinite(staffIndex) && staffIndex >= 0 ? staffIndex : null
  } catch {
    return null
  }
}

function attachProfileNavigation(
  win: BrowserWindow,
  kind: 'player' | 'staff',
  nav: ProfileNavigationContext | undefined,
): void {
  if (nav && nav.orderedStaffIndices.length >= 2) {
    profileNavByWebContents.set(win.webContents.id, { kind, nav })
  }
}

function profileWindowSearch(kind: 'player' | 'staff', staffIndex: number): string {
  return `profileKind=${encodeURIComponent(kind)}&staffIndex=${encodeURIComponent(String(staffIndex))}`
}

function loadProfileWindow(win: BrowserWindow, kind: 'player' | 'staff', staffIndex: number): void {
  const search = profileWindowSearch(kind, staffIndex)
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.split('#')[0]!.split('?')[0]!
    void win.loadURL(`${base}?${search}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { search })
  }
}

function createProfileWindow(kind: 'player' | 'staff', staffIndex: number): BrowserWindow {
  const icon = resolveAppIcon()
  const win = new BrowserWindow({
    width: 520,
    height: 780,
    minWidth: 380,
    minHeight: 520,
    title: 'Profile',
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  loadProfileWindow(win, kind, staffIndex)
  return win
}

/**
 * CM Scout–style: open *.sav or index.dat; same block directory format.
 * Returns the DB plus the exact buffer that was parsed (for later attribute patching).
 */
/** Re-parse `club.dat` / `stadium.dat` (etc.) after patching the in-memory archive. */
function refreshLoadedDbFromArchive(indexPath: string, archiveBuf: Buffer): ParsedDatabase {
  return parseIndexDat(archiveBuf, {
    staffHistorySearchDirs: collectStaffHistorySearchDirs(indexPath),
  })
}

function loadArchiveForPath(
  selectedPath: string,
  opts?: { skipCurrentSeasonIndex?: boolean },
): { db: ParsedDatabase; archiveBuf: Buffer; archiveReadPath: string } {
  const { buffer: archiveBuf, readPath: archiveReadPath } = readArchiveFromDisk(selectedPath)
  const historyDirs = collectStaffHistorySearchDirs(selectedPath)
  const parseOpts = {
    staffHistorySearchDirs: historyDirs,
    skipCurrentSeasonIndex: opts?.skipCurrentSeasonIndex,
  }
  try {
    return { db: parseIndexDat(archiveBuf, parseOpts), archiveBuf, archiveReadPath }
  } catch (e) {
    const lower = basename(selectedPath).toLowerCase()
    if (lower.endsWith('.sav')) {
      const alt = join(dirname(selectedPath), 'index.dat')
      if (existsSync(alt)) {
        const altBuf = readFileSync(alt)
        return {
          db: parseIndexDat(altBuf, {
            staffHistorySearchDirs: collectStaffHistorySearchDirs(alt),
            skipCurrentSeasonIndex: opts?.skipCurrentSeasonIndex,
          }),
          archiveBuf: altBuf,
          archiveReadPath: alt,
        }
      }
    }
    throw e
  }
}

function emitLoadProgress(sender: WebContents, p: DatabaseLoadProgress): void {
  if (!sender.isDestroyed()) sender.send('database-load-progress', p)
}

function sortedCompetitionOptions(db: ParsedDatabase): { id: number; name: string }[] {
  const m = db.competitionNamesById
  if (!m?.size) return []
  return [...m.entries()]
    .filter(([id]) => id > 0)
    .map(([id, name]) => ({
      id,
      name: (name ?? '').trim() || `Competition #${id}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
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

const SPLASH_DURATION_MS = 3200
const SPLASH_FADE_MS = 420
/** Portrait sticker asset (~400×560). */
const SPLASH_STICKER_ASPECT = 400 / 560

function splashWindowSize(): { width: number; height: number } {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const height = Math.min(Math.round(sh * 0.82), 980)
  const width = Math.min(Math.round(height * SPLASH_STICKER_ASPECT), Math.round(sw * 0.48))
  return {
    width: Math.max(520, width),
    height: Math.max(720, height),
  }
}

function splashHtmlPath(): string {
  const built = join(__dirname, '../renderer/splash.html')
  if (existsSync(built)) return built
  return join(__dirname, '../../src/renderer/splash.html')
}

function resolveSplashStickerPath(): string | null {
  const htmlPath = splashHtmlPath()
  const htmlDir = dirname(htmlPath)
  const candidates = [
    join(htmlDir, 'splash-sticker.png'),
    join(htmlDir, 'public', 'splash-sticker.png'),
    join(__dirname, '../renderer/splash-sticker.png'),
    join(__dirname, '../../src/renderer/public/splash-sticker.png'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function setSplashStickerImage(splash: BrowserWindow, stickerPath: string): void {
  const href = pathToFileURL(stickerPath).href
  void splash.webContents
    .executeJavaScript(
      `(() => { const img = document.querySelector('.sticker'); if (img) img.src = ${JSON.stringify(href)}; })()`,
      true,
    )
    .catch(() => {})
}

function createSplashWindow(): Promise<void> {
  return new Promise((resolve) => {
    const { width, height } = splashWindowSize()
    const splash = new BrowserWindow({
      width,
      height,
      useContentSize: true,
      frame: false,
      transparent: true,
      center: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    splash.once('ready-to-show', () => splash.show())

    const finish = () => {
      if (!splash.isDestroyed()) splash.destroy()
      resolve()
    }

    const stickerPath = resolveSplashStickerPath()
    splash.webContents.once('did-finish-load', () => {
      if (stickerPath) setSplashStickerImage(splash, stickerPath)
    })
    void splash.loadFile(splashHtmlPath()).catch(() => finish())

    const fadeAt = Math.max(0, SPLASH_DURATION_MS - SPLASH_FADE_MS)
    setTimeout(() => {
      if (splash.isDestroyed()) {
        resolve()
        return
      }
      void splash.webContents
        .executeJavaScript(
          `document.getElementById('wrap')?.classList.add('is-out')`,
          true,
        )
        .catch(() => {})
      setTimeout(finish, SPLASH_FADE_MS)
    }, fadeAt)
  })
}

function createWindow(): BrowserWindow {
  const icon = resolveAppIcon()
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CM Merlin',
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      // Must be CommonJS: sandboxed preloads cannot use ESM `import` (see Electron docs).
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  mainBrowserWindow = win
  win.on('closed', () => {
    if (mainBrowserWindow === win) mainBrowserWindow = null
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
    if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(async () => {
  applyAppIcon()
  await createSplashWindow()
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
    title: 'Open CM0102 save game (.sav only)',
    defaultPath: suggested,
    buttonLabel: 'Load save',
    properties: ['openFile'] as const,
    filters: [{ name: 'CM0102 save games (*.sav)', extensions: ['sav'] }],
  }
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return { ok: false as const, error: 'cancelled' }
  const sender = event.sender
  try {
    const indexPath = r.filePaths[0]
    emitLoadProgress(sender, {
      phase: 'read',
      message: 'Reading save file from disk…',
      progress: 0.06,
    })
    emitLoadProgress(sender, {
      phase: 'parse',
      message: 'Parsing save file…',
      progress: 0.2,
    })
    const { db, archiveBuf, archiveReadPath } = loadArchiveForPath(indexPath, { skipCurrentSeasonIndex: true })
    const archiveSiblingWarning = archiveSiblingsLookOutOfSync(indexPath)
    emitLoadProgress(sender, {
      phase: 'parse',
      message: 'Parsed players, clubs, contracts, and stats blocks…',
      progress: 0.38,
    })
    emitLoadProgress(sender, {
      phase: 'rows',
      message: 'Building searchable player rows…',
      progress: 0.48,
    })
    const rows = buildUiRows(db)
    emitLoadProgress(sender, {
      phase: 'ratings',
      message: 'Computing CM Scout % and effectiveness…',
      progress: 0.62,
    })
    applyCmScoutRatings(rows)
    applyEffectivenessRatings(rows)
    applyEngineMetaProfiles(rows)
    emitLoadProgress(sender, {
      phase: 'regen',
      message: 'Applying regen snapshot hints…',
      progress: 0.74,
    })
    const pathKey = pathKeyForDb(indexPath)
    const baseline = loadBaselineFromDisk(pathKey)
    applyRegenPipeline(rows, baseline, pathKey)
    if (db.playerStatsHistoryBuf?.length || db.playerStatsDatBuf?.length) {
      emitLoadProgress(sender, {
        phase: 'season',
        message: 'Indexing current-season goals, assists, and competitions…',
        progress: 0.84,
      })
      try {
        db.currentSeasonByPlayerDatId = buildPlayerCurrentSeasonIndex(
          db.players,
          db.staff,
          db.playerStatsHistoryBuf,
          db.playerStatsDatBuf,
          db.competitionNamesById ?? new Map(),
          db.staffCompHistoryByStaffId,
          db.savePerformanceByPlayerDatId,
          (frac) => {
            emitLoadProgress(sender, {
              phase: 'season',
              message:
                frac < 0.4
                  ? 'Scanning season history (47-byte rows)…'
                  : frac < 0.5
                    ? 'Locating player stats anchors (one pass)…'
                    : 'Attaching goals & assists per player…',
              progress: 0.84 + frac * 0.15,
            })
          },
        )
        patchUiRowsCurrentSeason(rows, db)
      } catch {
        db.currentSeasonByPlayerDatId = undefined
      }
    }
    emitLoadProgress(sender, { phase: 'done', message: 'Load complete.', progress: 1 })
    loaded = { db, rows, indexPath, pathKey, archiveBuf }
    return {
      ok: true as const,
      path: indexPath,
      archiveReadPath: archiveReadPath !== indexPath ? archiveReadPath : undefined,
      archiveSiblingWarning: archiveSiblingWarning ? ARCHIVE_SIBLING_SYNC_WARNING : undefined,
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
      competitions: sortedCompetitionOptions(db),
      playerStatsHistoryPresent: !!(db.playerStatsHistoryBuf && db.playerStatsHistoryBuf.length > 0),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
})

ipcMain.handle('get-database-status', () => {
  if (!loaded) return { loaded: false as const }
  return {
    loaded: true as const,
    path: loaded.indexPath,
    playableCount: loaded.rows.length,
    staffDatRows: loaded.db.staff.length,
  }
})

ipcMain.handle('get-rows', async (_e, payload: unknown) => {
  if (!loaded) {
    return { total: 0, rows: [], offset: 0, capped: false }
  }
  try {
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

  const filter = raw as GetRowsFilter
  if (raw.isRegenLikely === true || raw.isRegenLikely === 'true' || raw.isRegenLikely === 1) {
    filter.isRegenLikely = true
  }
  filter.positionRoles = parsePositionRoleFilterIds(raw.positionRoles)
  filter.positionSides = parsePositionSideFilterIds(raw.positionSides)

  const gameDateIso = loaded.db.gameDateIso ?? null
  const rows = filterUiPlayerRows(allRowsForGrid(), filter, { gameDateIso })
  const total = rows.length
  const page = limit === undefined ? rows : rows.slice(offset, offset + limit)
  const mapped = page.map((r) => mapUiRowToGridPayload(r, gridInclude))
  return {
    total,
    rows: mapped,
    offset,
    capped: limit !== undefined && offset + mapped.length < total,
  }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('get-rows failed', e)
    return { total: 0, rows: [], offset: 0, capped: false, error: msg }
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
  } else {
    jobForClub = undefined
  }
  const num = (key: string): number | undefined => {
    const v = raw[key]
    if (v === undefined || v === null || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const attrRaw = raw.attrMins
  const attrMins = Array.isArray(attrRaw)
    ? attrRaw.map((x) => {
        if (x === null || x === undefined || x === '') return null
        const n = Number(x)
        return Number.isFinite(n) && n > 0 ? n : null
      })
    : undefined
  const matchRaw = num('attrMinMatchAtLeast')
  const contractCat = raw.contractTypeCategory
  const all = filterStaffGridRows(loaded.db, {
    q: String(raw.q ?? ''),
    nation: String(raw.nation ?? ''),
    club: String(raw.club ?? ''),
    jobForClub,
    includePlayers: !!raw.includePlayers,
    ageMin: num('ageMin'),
    ageMax: num('ageMax'),
    wageMin: num('wageMin'),
    wageMax: num('wageMax'),
    coachingCaMin: num('coachingCaMin'),
    coachingCaMax: num('coachingCaMax'),
    reputationMin: num('reputationMin'),
    reputationMax: num('reputationMax'),
    coachingPaMin: num('coachingPaMin'),
    coachingPaMax: num('coachingPaMax'),
    contractTypeCategory:
      typeof contractCat === 'string' && contractCat.length > 0
        ? (contractCat as ContractTypeCategoryId)
        : undefined,
    contractExpiresWithinMonths: num('contractExpiresWithinMonths'),
    leavingOnBosman: raw.leavingOnBosman === true ? true : undefined,
    euPassport: raw.euPassport === true ? true : undefined,
    attrMins,
    attrMinMatchAtLeast: matchRaw != null && matchRaw >= 1 ? Math.floor(matchRaw) : undefined,
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
  syncClubCashFromUserPath()
  const id = Math.floor(Number(clubId))
  const payload = buildClubDetailPayload(loaded.db, id)
  if (!payload || typeof payload !== 'object') return payload
  const club = loaded.db.clubsById?.get(id)
  if (club) {
    const snap = buildClubEditorSnapshot(
      loaded.archiveBuf,
      loaded.db.blocks,
      loaded.db.compressed,
      loaded.db,
      id,
    )
    if (!('error' in snap)) {
      ;(payload as { cash: number }).cash = snap.values.cash ?? club.cash
    }
  }
  return payload
})

ipcMain.handle('get-club-squad-grid-rows', async (_e, clubId: unknown) => {
  if (!loaded) return []
  const id = Math.floor(Number(clubId))
  if (!Number.isFinite(id) || id <= 0) return []
  return buildClubSquadGridRows(loaded.db, id)
})

ipcMain.handle('pick-world-xi', async (_e, pitchSlots: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  if (!Array.isArray(pitchSlots) || pitchSlots.length === 0) {
    return { ok: false as const, error: 'Load a tactic preset on the pitch first.' }
  }
  const slots = pitchSlots as PitchSlot[]
  const assignments = pickWorldXiLineup(slots, allRowsForGrid())
  const filled = Object.keys(assignments).length
  if (filled === 0) {
    return { ok: false as const, error: 'Could not fill any positions from the loaded save.' }
  }
  return { ok: true as const, assignments, filled }
})

ipcMain.handle('get-staff-profile', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  return buildStaffProfilePayload(loaded.db, idx)
})

ipcMain.handle(
  'open-profile-window',
  async (
    _e,
    args: {
      staffIndex?: unknown
      kind?: unknown
      navigation?: ProfileNavigationContext
    },
  ) => {
    if (!loaded) return { ok: false as const, error: 'Load a save in the main window first.' }
    const staffIndex = Math.floor(Number(args?.staffIndex))
    const kind = args?.kind === 'staff' ? 'staff' : 'player'
    if (!Number.isFinite(staffIndex) || staffIndex < 0) {
      return { ok: false as const, error: 'Invalid profile.' }
    }
    const nav = args?.navigation
    const key = profileWindowKey(kind)
    const existing = profileWindows.get(key)
    if (existing && !existing.isDestroyed()) {
      loadProfileWindow(existing, kind, staffIndex)
      attachProfileNavigation(existing, kind, nav)
      existing.focus()
      return { ok: true as const }
    }
    const win = createProfileWindow(kind, staffIndex)
    profileWindows.set(key, win)
    attachProfileNavigation(win, kind, nav)
    win.on('closed', () => {
      profileWindows.delete(key)
      profileNavByWebContents.delete(win.webContents.id)
    })
    return { ok: true as const }
  },
)

ipcMain.handle('profile-window-nav-state', (e, payload?: unknown) => {
  const ctx = profileNavByWebContents.get(e.sender.id)
  if (!ctx?.nav.orderedStaffIndices.length || ctx.nav.orderedStaffIndices.length < 2) {
    return { ok: true as const, hasNav: false as const }
  }
  const ordered = ctx.nav.orderedStaffIndices
  const fromArg = (payload as { staffIndex?: unknown } | undefined)?.staffIndex
  const staffIndex =
    fromArg != null && Number.isFinite(Number(fromArg))
      ? Math.floor(Number(fromArg))
      : parseStaffIndexFromProfileUrl(e.sender.getURL())
  const idx = staffIndex != null ? ordered.indexOf(staffIndex) : -1
  return {
    ok: true as const,
    hasNav: true as const,
    index: idx >= 0 ? idx : 0,
    total: ordered.length,
    source: ctx.nav.source,
  }
})

ipcMain.handle(
  'profile-window-navigate',
  async (e, args: { direction?: unknown; staffIndex?: unknown }) => {
    const ctx = profileNavByWebContents.get(e.sender.id)
    if (!ctx) return { ok: false as const, error: 'No navigation list for this window.' }
    const fromArg = args?.staffIndex
    const win = BrowserWindow.fromWebContents(e.sender)
    const current =
      fromArg != null && Number.isFinite(Number(fromArg))
        ? Math.floor(Number(fromArg))
        : win
          ? parseStaffIndexFromProfileUrl(win.webContents.getURL())
          : null
    if (current == null) return { ok: false as const, error: 'Invalid profile.' }
    const direction = args?.direction === 'prev' ? 'prev' : 'next'
    const next = profileNavStep(ctx.nav.orderedStaffIndices, current, direction)
    if (next == null) return { ok: false as const, error: 'Could not navigate.' }
    notifyMainWindowPopoutSelection(next)
    return { ok: true as const, staffIndex: next }
  },
)

ipcMain.handle('get-profile', async (_e, staffIndex: number) => {
  if (!loaded) return null
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  try {
    let row = loaded.rows.find((r) => r.staffIndex === idx)
    if (!row) {
      const built = buildUiPlayerRowAtIndex(loaded.db, idx)
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
        staffCompsById: loaded.db.staffCompsById,
        clubDivisionCompIdByClubId: loaded.db.clubDivisionCompIdByClubId,
        staffHistoryParsed: loaded.db.staffHistoryParsed ?? false,
        staffHistorySourcePath: loaded.db.staffHistorySourcePath,
        playerStatsDatPresent: loaded.db.playerStatsDatPresent ?? false,
        savePerformancePerCompByPlayerDatId: loaded.db.savePerformancePerCompByPlayerDatId,
        savePerformanceByPlayerDatId: loaded.db.savePerformanceByPlayerDatId,
        currentSeasonByPlayerDatId: loaded.db.currentSeasonByPlayerDatId,
      }),
      isDemo: false as const,
    }
  } catch (e) {
    console.error('get-profile failed', idx, e)
    throw e
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

ipcMain.handle('get-development-rows', async (_e, payload: unknown) => {
  if (!loaded) {
    return {
      ready: false,
      reason: 'no_snapshot' as const,
      totals: { inSnapshot: 0, withChanges: 0, attrsImproved: 0, attrsDeclined: 0 },
      total: 0,
      rows: [],
      offset: 0,
      capped: false,
    }
  }
  const baseline = loadBaselineFromDisk(loaded.pathKey)
  if (!baseline) {
    return {
      ready: false,
      reason: 'no_snapshot' as const,
      totals: { inSnapshot: 0, withChanges: 0, attrsImproved: 0, attrsDeclined: 0 },
      total: 0,
      rows: [],
      offset: 0,
      capped: false,
    }
  }
  if (!baselineTracksDevelopment(baseline)) {
    return {
      ready: false,
      reason: 'legacy_snapshot' as const,
      snapshotAt: baseline.createdIso,
      snapshotGameDate: baseline.gameDateIso,
      totals: { inSnapshot: 0, withChanges: 0, attrsImproved: 0, attrsDeclined: 0 },
      total: 0,
      rows: [],
      offset: 0,
      capped: false,
    }
  }
  const raw = { ...(payload as Record<string, unknown>) }
  const offset = Math.max(0, Math.floor(Number(raw.offset) || 0))
  const limitRaw = raw.limit
  const hasLimit =
    limitRaw !== undefined && limitRaw !== null && limitRaw !== '' && Number.isFinite(Number(limitRaw))
  const limit = hasLimit ? Math.max(1, Math.floor(Number(limitRaw))) : undefined
  const onlyChanged = raw.onlyChanged === true || raw.onlyChanged === 'true' || raw.onlyChanged === 1
  const sortRaw = typeof raw.sortBy === 'string' ? raw.sortBy : 'net'
  const sortBy =
    sortRaw === 'name' || sortRaw === 'ca' || sortRaw === 'gains' ? sortRaw : ('net' as const)
  const all = buildAllDevelopmentSummaries(loaded.rows, baseline)
  const filtered = filterAndSortDevelopmentRows(all, {
    q: typeof raw.q === 'string' ? raw.q : undefined,
    club: typeof raw.club === 'string' ? raw.club : undefined,
    onlyChanged,
    sortBy,
  })
  const totals = developmentTotals(all)
  const page = limit === undefined ? filtered : filtered.slice(offset, offset + limit)
  return {
    ready: true,
    snapshotAt: baseline.createdIso,
    snapshotGameDate: baseline.gameDateIso,
    totals,
    total: filtered.length,
    rows: page,
    offset,
    capped: limit !== undefined && offset + page.length < filtered.length,
  }
})

ipcMain.handle('get-player-development-detail', async (_e, staffIndex: unknown) => {
  if (!loaded) return { ready: false, summary: null }
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return { ready: false, summary: null }
  const baseline = loadBaselineFromDisk(loaded.pathKey)
  if (!baseline || !baselineTracksDevelopment(baseline)) {
    return { ready: false, summary: null }
  }
  const row = uiPlayerRowForStaff(idx)
  if (!row) return { ready: false, summary: null }
  const entry = baseline.entries[String(row.staff.id)]
  if (!entry?.attr48) return { ready: false, summary: null }
  const summary = buildPlayerDevelopmentSummary(row, entry, intrinsicRaw48(row.player, row.staff))
  return { ready: true, summary }
})

function uiPlayerRowForStaff(staffIndex: number): UiPlayerRow | null {
  if (!loaded) return null
  let row = loaded.rows.find((r) => r.staffIndex === staffIndex)
  if (!row) {
    const built = buildUiPlayerRowAtIndex(loaded.db, staffIndex)
    if (!built) return null
    row = built
  }
  applyCmScoutRatings([row])
  return row
}

ipcMain.handle('get-attr-filter-mins', async (_e, staffIndex: unknown) => {
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  const row = uiPlayerRowForStaff(idx)
  if (!row) return null
  const inNorm = scoutDisplayVector48(row.player, row.staff)
  const filter48 = scoutFilterComparisonVector48(row.player, row.staff)
  return {
    staffIndex: idx,
    name: editorSubjectLabel(loaded!.db, idx) ?? row.name,
    mins: attrMinStringsFromComparisonVectors(inNorm, filter48),
  }
})

ipcMain.handle('get-editor-snapshot', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  syncLoadedArchiveFromDisk()
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  const values = buildEditorValueMap(loaded.db, idx)
  if (!values) return null
  const s = loaded.db.staff[idx]!
  const injuryState = readPlayerInjuryFromArchive(loaded.archiveBuf, s.id)
  const injuryTypeId = injuryState?.injuryTypeId ?? 0
  return {
    staffIndex: idx,
    staffId: s.id,
    name: editorSubjectLabel(loaded.db, idx) ?? '',
    playerRow: s.player_id,
    values,
    injury: {
      typeId: injuryTypeId,
      label: injuryTypeLabel(injuryTypeId),
      canClear: injuryTypeId > 0,
    },
  }
})

ipcMain.handle('save-attribute-edits', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  syncLoadedArchiveFromDisk()
  const p = payload as { staffIndex?: unknown; changes?: unknown; clearInjury?: unknown }
  const staffIndex = Math.floor(Number(p.staffIndex))
  const ch = p.changes
  if (!Number.isFinite(staffIndex) || staffIndex < 0 || typeof ch !== 'object' || ch === null) {
    return { ok: false as const, error: 'Invalid save payload.' }
  }
  const changes = ch as Record<string, number>
  const clearInjury = p.clearInjury === true
  const clearUnhappiness = p.clearUnhappiness === true
  if (Object.keys(changes).length === 0 && !clearInjury && !clearUnhappiness) {
    return { ok: false as const, error: 'No changes to save.' }
  }
  const built = buildPatchedArchiveBuffer(
    loaded.archiveBuf,
    loaded.db.blocks,
    loaded.db.compressed,
    loaded.db,
    staffIndex,
    changes,
    { clearInjury, clearUnhappiness },
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

ipcMain.handle('get-staff-editor-snapshot', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  syncLoadedArchiveFromDisk()
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  return buildStaffEditorSnapshot(loaded.db, idx)
})

ipcMain.handle('save-staff-edits', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  syncLoadedArchiveFromDisk()
  const p = payload as { staffIndex?: unknown; changes?: unknown }
  const staffIndex = Math.floor(Number(p.staffIndex))
  const ch = p.changes
  if (!Number.isFinite(staffIndex) || staffIndex < 0 || typeof ch !== 'object' || ch === null) {
    return { ok: false as const, error: 'Invalid save payload.' }
  }
  const changes = ch as Record<string, number>
  if (Object.keys(changes).length === 0) {
    return { ok: false as const, error: 'No changes to save.' }
  }
  const built = buildStaffEditorPatchedBuffer(
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
  const suggested = join(dirname(loaded.indexPath), `${stem}-staff-edited${ext}`)
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

ipcMain.handle('get-contract-editor-snapshot', async (_e, staffIndex: unknown) => {
  if (!loaded) return null
  syncLoadedArchiveFromDisk()
  const idx = Math.floor(Number(staffIndex))
  if (!Number.isFinite(idx) || idx < 0) return null
  return buildContractEditorSnapshot(loaded.db, idx)
})

ipcMain.handle('save-contract-edits', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  syncLoadedArchiveFromDisk()
  const p = payload as { staffIndex?: unknown; changes?: unknown }
  const staffIndex = Math.floor(Number(p.staffIndex))
  const ch = p.changes
  if (!Number.isFinite(staffIndex) || staffIndex < 0 || typeof ch !== 'object' || ch === null) {
    return { ok: false as const, error: 'Invalid save payload.' }
  }
  const changes = ch as Record<string, number>
  if (Object.keys(changes).length === 0) {
    return { ok: false as const, error: 'No changes to save.' }
  }
  const built = buildContractEditorPatchedBuffer(
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
  const suggested = join(dirname(loaded.indexPath), `${stem}-contract-edited${ext}`)
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

ipcMain.handle('get-club-editor-snapshot', async (_e, clubId: unknown) => {
  if (!loaded) return null
  syncLoadedArchiveFromDisk()
  const id = Math.floor(Number(clubId))
  if (!Number.isFinite(id) || id <= 0) return null
  const snap = buildClubEditorSnapshot(
    loaded.archiveBuf,
    loaded.db.blocks,
    loaded.db.compressed,
    loaded.db,
    id,
  )
  if ('error' in snap) return { error: snap.error }
  return snap
})

function applyClubEditsToLoadedArchive(
  clubId: number,
  values: Record<string, number>,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (!loaded) return { ok: false, error: 'No database loaded.' }
  const built = buildPatchedArchiveForClubEdits(
    loaded.archiveBuf,
    loaded.db.blocks,
    loaded.db.compressed,
    loaded.db,
    clubId,
    values,
  )
  if (!built.ok) return built
  loaded.archiveBuf = built.buffer
  loaded.pathKey = pathKeyForDb(loaded.indexPath)
  loaded.db = refreshLoadedDbFromArchive(loaded.indexPath, built.buffer)
  return { ok: true, buffer: built.buffer }
}

ipcMain.handle('save-club-edits', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'No database loaded.' }
  syncLoadedArchiveFromDisk()
  const p = payload as { clubId?: unknown; values?: unknown; changes?: unknown; inPlace?: unknown }
  const clubId = Math.floor(Number(p.clubId))
  const ch = p.values ?? p.changes
  if (!Number.isFinite(clubId) || clubId <= 0 || typeof ch !== 'object' || ch === null) {
    return { ok: false as const, error: 'Invalid save payload.' }
  }
  const values = ch as Record<string, number>
  if (Object.keys(values).length === 0) {
    return { ok: false as const, error: 'No club fields to save.' }
  }

  if (p.inPlace === true) {
    try {
      const applied = applyClubEditsToLoadedArchive(clubId, values)
      if (!applied.ok) return { ok: false as const, error: applied.error }
      const writtenPaths = writeArchiveToDiskSiblings(loaded.indexPath, applied.buffer)
      const verifyPath = loaded.indexPath
      const fromDisk = readFileSync(verifyPath)
      if (values.cash !== undefined && Number.isFinite(values.cash)) {
        const verified = verifyClubCashOnArchive(fromDisk, loaded.db.blocks, clubId, values.cash)
        if (!verified.ok) {
          return {
            ok: false as const,
            error: `${verified.error} File: ${verifyPath}`,
          }
        }
      }
      loaded.archiveBuf = fromDisk
      loaded.db = refreshLoadedDbFromArchive(verifyPath, fromDisk)
      return {
        ok: true as const,
        path: verifyPath,
        inPlace: true as const,
        writtenPaths,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: msg }
    }
  }

  const built = buildPatchedArchiveForClubEdits(
    loaded.archiveBuf,
    loaded.db.blocks,
    loaded.db.compressed,
    loaded.db,
    clubId,
    values,
  )
  if (!built.ok) return { ok: false as const, error: built.error }

  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined
  const suggested = loaded.indexPath
  const dlg = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Save club & stadium copy',
        defaultPath: suggested,
        filters: [
          { name: 'CM0102 archive', extensions: ['sav', 'dat'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
    : await dialog.showSaveDialog({
        title: 'Save club & stadium copy',
        defaultPath: suggested,
        filters: [
          { name: 'CM0102 archive', extensions: ['sav', 'dat'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
  if (dlg.canceled || !dlg.filePath) return { ok: false as const, error: 'cancelled' }
  try {
    writeFileSync(dlg.filePath, built.buffer)
    loaded.archiveBuf = built.buffer
    loaded.indexPath = dlg.filePath
    loaded.pathKey = pathKeyForDb(dlg.filePath)
    loaded.db = refreshLoadedDbFromArchive(dlg.filePath, built.buffer)
    return { ok: true as const, path: dlg.filePath, inPlace: false as const }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
})

function plsEntriesFromStaffIndices(db: ParsedDatabase, staffIndices: number[]): PlsStaffEntry[] {
  const out: PlsStaffEntry[] = []
  const seen = new Set<number>()
  for (const idx of staffIndices) {
    if (!Number.isFinite(idx) || idx < 0 || seen.has(idx)) continue
    const s = db.staff[idx]
    if (!s || s.player_id < 0) continue
    seen.add(idx)
    out.push({
      staffId: s.id,
      firstNameId: s.first_name_id,
      secondNameId: s.second_name_id,
      commonNameId: s.common_name_id,
      dobIso: s.dob_iso,
      yearOfBirth: s.year_of_birth,
    })
  }
  return out
}

function gridRowsForStaffIndices(staffIndices: number[], inc?: GridIncludeFlags): GridPlayerRow[] {
  if (!loaded) return []
  const out: GridPlayerRow[] = []
  const seen = new Set<number>()
  for (const idx of staffIndices) {
    if (!Number.isFinite(idx) || idx < 0 || seen.has(idx)) continue
    seen.add(idx)
    let ui = loaded.rows.find((r) => r.staffIndex === idx)
    if (!ui) {
      const built = buildUiPlayerRowAtIndex(loaded.db, idx)
      if (!built) continue
      applyCmScoutRatings([built])
      applyEffectivenessRatings([built])
      applyEngineMetaProfiles([built])
      ui = built
    }
    out.push(mapUiRowToGridPayload(ui, inc ?? { role7: true }))
  }
  return out
}

ipcMain.handle('get-shortlist-store', async () => {
  if (!loaded?.indexPath) return { version: 1 as const, lists: [] }
  return loadShortlistStoreFromDisk(loaded.indexPath)
})

ipcMain.handle('set-shortlist-store', async (_e, store: unknown) => {
  if (!loaded?.indexPath) return { ok: false as const, error: 'Load a save game first.' }
  const s = store as ShortlistStore
  if (s?.version !== 1 || !Array.isArray(s.lists)) {
    return { ok: false as const, error: 'Invalid shortlist data.' }
  }
  try {
    saveShortlistStoreToDisk(loaded.indexPath, s)
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('get-shortlist-player-rows', async (_e, staffIndices: unknown) => {
  const ids = Array.isArray(staffIndices)
    ? staffIndices.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0)
    : []
  return gridRowsForStaffIndices(ids, { role7: true })
})

ipcMain.handle('export-shortlist-pls', async (event, payload: unknown) => {
  if (!loaded) return { ok: false as const, error: 'Load a database first.' }
  const p = payload as { staffIndices?: number[]; defaultName?: string }
  const staffIndices = Array.isArray(p?.staffIndices)
    ? p.staffIndices.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0)
    : []
  const entries = plsEntriesFromStaffIndices(loaded.db, staffIndices)
  if (entries.length === 0) {
    return { ok: false as const, error: 'No playable players in this shortlist.' }
  }
  if (entries.length > PLS_MAX_PLAYERS) {
    return {
      ok: false as const,
      error: `CM0102 supports at most ${PLS_MAX_PLAYERS} players per shortlist (you have ${entries.length}).`,
    }
  }
  const buf = buildCmScoutPlsBuffer(entries, { title: 'CM Scout Search' })
  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined
  const base = (p?.defaultName ?? 'shortlist').replace(/[^\w.\- ]+/g, '_').trim() || 'shortlist'
  const suggested = join(getSuggestedSaveGameFolder(), 'Search', `${base}.pls`)
  const dlg = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Export CM Scout shortlist (.pls)',
        defaultPath: suggested,
        filters: [{ name: 'CM0102 shortlist', extensions: ['pls'] }],
      })
    : await dialog.showSaveDialog({
        title: 'Export CM Scout shortlist (.pls)',
        defaultPath: suggested,
        filters: [{ name: 'CM0102 shortlist', extensions: ['pls'] }],
      })
  if (dlg.canceled || !dlg.filePath) return { ok: false as const, error: 'cancelled' }
  try {
    writeFileSync(dlg.filePath, buf)
    return { ok: true as const, path: dlg.filePath, count: entries.length }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('export-shortlist-json', async (event, payload: unknown) => {
  const p = payload as { json?: string; defaultName?: string }
  if (!p?.json) return { ok: false as const, error: 'Nothing to export.' }
  const parent =
    BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0] ?? undefined
  const base = (p.defaultName ?? 'staff-shortlist').replace(/[^\w.\- ]+/g, '_').trim() || 'staff-shortlist'
  const suggested = join(homedir(), 'Documents', `${base}.json`)
  const dlg = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'Export staff shortlist (JSON)',
        defaultPath: suggested,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
    : await dialog.showSaveDialog({
        title: 'Export staff shortlist (JSON)',
        defaultPath: suggested,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
  if (dlg.canceled || !dlg.filePath) return { ok: false as const, error: 'cancelled' }
  try {
    writeFileSync(dlg.filePath, p.json, 'utf8')
    return { ok: true as const, path: dlg.filePath }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
})
