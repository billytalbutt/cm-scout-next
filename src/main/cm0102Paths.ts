import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

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

/** CM0102 Starter Kit (Wineskin): …/Program Files/Starter Kit vX.Y.Z/Game */
function starterKitGameDirs(home: string): string[] {
  const out: string[] = []
  const roots = ['/Applications', join(home, 'Applications'), join(home, 'Downloads')]
  for (const root of roots) {
    if (!existsSync(root)) continue
    let apps: ReturnType<typeof readdirSync>
    try {
      apps = readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of apps) {
      if (!ent.isDirectory() || !ent.name.endsWith('.app')) continue
      if (!/CM0102|StarterKit|Starter Kit/i.test(ent.name)) continue
      const pf = join(root, ent.name, 'Contents/Resources/drive_c/Program Files')
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
  }
  return out
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

/**
 * CM Scout–style: `Data/index.dat` inside the CM0102 install (or Starter Kit `Game/Data`).
 * Falls back to a game root that already contains `index.dat`, then save-game heuristics.
 */
export function getSuggestedDatabaseFolder(home = homedir()): string | undefined {
  const roots = collectGameRoots(home)
  const dataDirs = roots.map((r) => join(r, 'Data')).filter((p) => existsSync(p))
  const dataWithIndex = dataDirs.filter(dirHasIndexDat)
  if (dataWithIndex.length) return dataWithIndex[0]
  if (dataDirs.length) return dataDirs[0]
  const rootsWithIndex = roots.filter((r) => dirHasIndexDat(r))
  if (rootsWithIndex.length) return rootsWithIndex[0]
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
