/**
 * CM0102 often has both `Game.sav` and `index.dat` in the same folder; the game may update
 * one while the editor opened the other. Keep reads/writes aligned with the newest sibling.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'path'

export type ArchiveSiblingInfo = {
  path: string
  mtimeMs: number
  size: number
}

/** Paths that should receive the same archive bytes as `selectedPath` (e.g. .sav + index.dat). */
export function listArchiveSiblingPaths(selectedPath: string): string[] {
  const dir = dirname(selectedPath)
  const lower = basename(selectedPath).toLowerCase()
  const out = new Set<string>()
  if (existsSync(selectedPath)) out.add(selectedPath)
  if (lower.endsWith('.sav')) {
    const idx = join(dir, 'index.dat')
    if (existsSync(idx)) out.add(idx)
  } else if (lower === 'index.dat') {
    try {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.sav')) continue
        out.add(join(dir, ent.name))
      }
    } catch {
      /* ignore */
    }
  }
  return [...out]
}

export function archiveSiblingStats(selectedPath: string): ArchiveSiblingInfo[] {
  return listArchiveSiblingPaths(selectedPath)
    .filter((p) => existsSync(p))
    .map((path) => {
      const st = statSync(path)
      return { path, mtimeMs: st.mtimeMs, size: st.size }
    })
}

/** Prefer the sibling CM most likely wrote last (newest mtime). */
export function pickNewestArchivePath(selectedPath: string): string {
  const stats = archiveSiblingStats(selectedPath)
  if (stats.length === 0) return selectedPath
  return stats.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]!.path
}

/** True when siblings differ enough that editing one file will not update what CM loads. */
export function archiveSiblingsLookOutOfSync(selectedPath: string): ArchiveSiblingInfo[] | null {
  const stats = archiveSiblingStats(selectedPath)
  if (stats.length < 2) return null
  const sizes = new Set(stats.map((s) => s.size))
  const mtimes = stats.map((s) => s.mtimeMs)
  const spreadMs = Math.max(...mtimes) - Math.min(...mtimes)
  if (spreadMs > 3000 || sizes.size > 1) return stats
  return null
}

export function readArchiveFromDisk(selectedPath: string): {
  buffer: Buffer
  readPath: string
  mtimeMs: number
} {
  const readPath = pickNewestArchivePath(selectedPath)
  const buffer = readFileSync(readPath)
  return { buffer, readPath, mtimeMs: statSync(readPath).mtimeMs }
}

export function writeArchiveToDiskSiblings(selectedPath: string, buffer: Buffer): string[] {
  const written: string[] = []
  for (const path of listArchiveSiblingPaths(selectedPath)) {
    writeFileSync(path, buffer)
    written.push(path)
  }
  return written
}

/** Reload the newest on-disk sibling into memory (keeps editor cash in sync with CM). */
export function refreshArchiveBufferFromDisk(selectedPath: string): {
  buffer: Buffer
  readPath: string
  mtimeMs: number
} {
  return readArchiveFromDisk(selectedPath)
}
