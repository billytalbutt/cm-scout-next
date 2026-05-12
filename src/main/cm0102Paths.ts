import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'

const CM_DIR_NAMES = ['Championship Manager 01-02', 'Championship Manager 01/02']

function dirHasSavOrDat(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isFile()) continue
      const lower = ent.name.toLowerCase()
      if (lower.endsWith('.sav') || lower === 'index.dat') return true
    }
  } catch {
    return false
  }
  return false
}

function crossoverBottleGameDirs(bottlesRoot: string): string[] {
  const out: string[] = []
  if (!existsSync(bottlesRoot)) return out
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(bottlesRoot, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const base = join(bottlesRoot, ent.name)
    const rels = [
      join(base, 'drive_c/Program Files (x86)'),
      join(base, 'drive_c/Program Files'),
    ]
    for (const pf of rels) {
      for (const cm of CM_DIR_NAMES) {
        const p = join(pf, cm)
        if (existsSync(p)) out.push(p)
      }
    }
  }
  return out
}

/**
 * Any folder that directly contains `*.app` bundles (e.g. Applications, ~/Downloads, ~/Downloads/cm0102).
 * Resolves …/Contents/Resources/drive_c/Program Files/Starter Kit vX.Y.Z/Game
 */
function collectStarterKitGameFoldersFromAppsParent(appsParent: string): string[] {
  const out: string[] = []
  if (!existsSync(appsParent)) return out
  let apps: ReturnType<typeof readdirSync>
  try {
    apps = readdirSync(appsParent, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of apps) {
    if (!ent.isDirectory() || !ent.name.toLowerCase().endsWith('.app')) continue
    if (!/CM0102|StarterKit|Starter Kit/i.test(ent.name)) continue
    const pf = join(appsParent, ent.name, 'Contents/Resources/drive_c/Program Files')
    if (!existsSync(pf)) continue
    let sk: ReturnType<typeof readdirSync>
    try {
      sk = readdirSync(pf, { withFileTypes: true })
    } catch {
      continue
    }
    for (const d of sk) {
      if (!d.isDirectory() || !/^Starter Kit v/i.test(d.name)) continue
      const game = join(pf, d.name, 'Game')
      if (existsSync(game)) out.push(game)
    }
  }
  return out
}

/** CM0102 Starter Kit (Wineskin): common install locations */
function starterKitGameDirs(home: string): string[] {
  const roots = ['/Applications', join(home, 'Applications'), join(home, 'Downloads')]
  const out: string[] = []
  for (const root of roots) {
    out.push(...collectStarterKitGameFoldersFromAppsParent(root))
  }
  return out
}

/** Typical user layout: ~/Downloads/cm0102/CM0102StarterKit.app/…/Game */
function starterKitGameDirsDownloadsCm0102(home: string): string[] {
  const a = collectStarterKitGameFoldersFromAppsParent(join(home, 'Downloads/cm0102'))
  if (a.length) return a
  return collectStarterKitGameFoldersFromAppsParent(join(home, 'Downloads/CM0102'))
}

function winePrefixGameDirs(home: string): string[] {
  const out: string[] = []
  const dotWine = join(home, '.wine')
  if (existsSync(dotWine)) {
    for (const pf of ['drive_c/Program Files (x86)', 'drive_c/Program Files'] as const) {
      for (const cm of CM_DIR_NAMES) {
        const p = join(dotWine, pf, cm)
        if (existsSync(p)) out.push(p)
      }
    }
  }
  const playOnMac = join(home, 'Library/PlayOnMac/wineprefix')
  if (existsSync(playOnMac)) {
    try {
      for (const ent of readdirSync(playOnMac, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue
        for (const pf of ['drive_c/Program Files (x86)', 'drive_c/Program Files'] as const) {
          for (const cm of CM_DIR_NAMES) {
            const p = join(playOnMac, ent.name, pf, cm)
            if (existsSync(p)) out.push(p)
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

/** Game install roots (same parent as `Data`, saves, etc.). */
export function collectGameRoots(home: string): string[] {
  return process.platform === 'win32' ? windowsCandidates(home) : darwinCandidates(home)
}

function dirHasIndexDat(dir: string): boolean {
  return existsSync(join(dir, 'index.dat'))
}

function pickDatabaseFolderFromGameRoots(gameRoots: string[]): string | undefined {
  const uniq = [...new Set(gameRoots.filter(Boolean))]
  const dataDirs = uniq.map((r) => join(r, 'Data')).filter((p) => existsSync(p))
  const dataWithIndex = dataDirs.filter(dirHasIndexDat)
  if (dataWithIndex.length) return dataWithIndex[0]
  if (dataDirs.length) return dataDirs[0]
  const rootsWithIndex = uniq.filter((r) => dirHasIndexDat(r))
  if (rootsWithIndex.length) return rootsWithIndex[0]
  if (uniq.length) {
    const d = join(uniq[0], 'Data')
    return existsSync(d) ? d : uniq[0]
  }
  return undefined
}

/**
 * Folder the file dialog should open in for “Load database”.
 * CM0102 keeps `index.dat` under `…/Data/` but `*.sav` usually lives in the parent (`…/Game/`).
 * Opening `Data/` as defaultPath makes Mac users go up one level — and with a `.dat`-only filter
 * active first, `.sav` files look unselectable. So we prefer the parent when `Data` was chosen.
 */
export function getDefaultOpenDatabaseDirectory(home = homedir()): string | undefined {
  const dataOrSave = getSuggestedDatabaseFolder(home) ?? getSuggestedSaveGameFolder()
  if (!dataOrSave) return undefined
  if (basename(dataOrSave).toLowerCase() === 'data') {
    const parent = dirname(dataOrSave)
    if (existsSync(parent)) return parent
  }
  return dataOrSave
}

/**
 * CM Scout–style: `Data/index.dat` under the game (Starter Kit: `Game/Data/index.dat`).
 * Prioritises ~/Downloads/cm0102/*.app when present (common Mac layout).
 */
export function getSuggestedDatabaseFolder(home = homedir()): string | undefined {
  const downloadsNested = starterKitGameDirsDownloadsCm0102(home)
  const fromDownloads = pickDatabaseFolderFromGameRoots(downloadsNested)
  if (fromDownloads) return fromDownloads

  const roots = collectGameRoots(home)
  const fromRest = pickDatabaseFolderFromGameRoots(roots)
  if (fromRest) return fromRest

  return getSuggestedSaveGameFolder()
}

function windowsCandidates(home: string): string[] {
  const out: string[] = []
  const profile = process.env.USERPROFILE
  const local = process.env.LOCALAPPDATA
  const programFiles = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles
  const paths = [
    programFiles && join(programFiles, 'Championship Manager 01-02'),
    'C:\\Program Files (x86)\\Championship Manager 01-02',
    profile && join(profile, 'Documents'),
    local && join(local, 'VirtualStore/Program Files (x86)/Championship Manager 01-02'),
    'C:\\CM0102',
  ]
  for (const p of paths) {
    if (p && existsSync(p)) out.push(p)
  }
  return out
}

function darwinCandidates(home: string): string[] {
  const out: string[] = []
  for (const brand of ['CrossOver', 'CrossOver Games'] as const) {
    const bottles = join(home, 'Library/Application Support', brand, 'Bottles')
    out.push(...crossoverBottleGameDirs(bottles))
  }
  out.push(...starterKitGameDirs(home))
  out.push(...winePrefixGameDirs(home))
  return out
}

/**
 * Best-effort folder where CM0102 keeps *.sav (and sometimes index.dat).
 * CrossOver / Starter Kit / Wine layouts differ; we pick the first candidate
 * that exists and looks like a save directory, else first that exists.
 */
export function getSuggestedSaveGameFolder(): string | undefined {
  const home = homedir()
  const list = process.platform === 'win32' ? windowsCandidates(home) : darwinCandidates(home)

  const withSaves = list.filter(dirHasSavOrDat)
  if (withSaves.length) return withSaves[0]
  if (list.length) return list[0]

  const fallback = join(home, 'Documents')
  if (existsSync(fallback)) return fallback
  return undefined
}
