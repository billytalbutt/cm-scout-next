import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { UiPlayerRow } from './database/types'

export type RegenBaselineEntry = {
  /** Resolved display name at snapshot time */
  name: string
  firstNameId: number
  secondNameId: number
  commonNameId: number
  playerId: number
  pa: number
  /** Current ability at snapshot — useful when regen CA grows later. */
  ca: number
  staffIndex: number
}

/** Sidecar-style snapshot (same idea as GPF2’s `.gpf2` next to a save). */
export type RegenBaselineFile = {
  version: 1
  /** Absolute path of the loaded index/save when the snapshot was taken (informational). */
  indexPath: string
  /** Hash key for the file on disk — must match current load to apply. */
  pathKey: string
  gameDateIso: string | null
  createdIso: string
  /** Keyed by `StaffRecord.id` (stable person id in `staff.dat`). */
  entries: Record<string, RegenBaselineEntry>
}

export function pathKeyForDb(absPath: string): string {
  return createHash('sha256').update(absPath.replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 32)
}

export function baselineDir(): string {
  const d = join(app.getPath('userData'), 'regen-baselines')
  mkdirSync(d, { recursive: true })
  return d
}

export function baselineFilePath(pathKey: string): string {
  return join(baselineDir(), `${pathKey}.json`)
}

export function buildBaselineFromRows(
  rows: UiPlayerRow[],
  indexPath: string,
  gameDateIso: string | null,
): RegenBaselineFile {
  const pathKey = pathKeyForDb(indexPath)
  const entries: Record<string, RegenBaselineEntry> = {}
  for (const r of rows) {
    if (r.staffIndex < 0) continue
    const s = r.staff
    entries[String(s.id)] = {
      name: r.name,
      firstNameId: s.first_name_id,
      secondNameId: s.second_name_id,
      commonNameId: s.common_name_id,
      playerId: s.player_id,
      pa: r.pa,
      ca: r.ca,
      staffIndex: r.staffIndex,
    }
  }
  return {
    version: 1,
    indexPath,
    pathKey,
    gameDateIso,
    createdIso: new Date().toISOString(),
    entries,
  }
}

export function saveBaselineToDisk(file: RegenBaselineFile): void {
  writeFileSync(baselineFilePath(file.pathKey), JSON.stringify(file), 'utf8')
}

export function loadBaselineFromDisk(pathKey: string): RegenBaselineFile | null {
  const p = baselineFilePath(pathKey)
  if (!existsSync(p)) return null
  try {
    const j = JSON.parse(readFileSync(p, 'utf8')) as RegenBaselineFile
    if (j.version !== 1 || !j.entries || typeof j.pathKey !== 'string') return null
    return j
  } catch {
    return null
  }
}

export function deleteBaselineFromDisk(pathKey: string): void {
  const p = baselineFilePath(pathKey)
  if (existsSync(p)) unlinkSync(p)
}

export function baselineStatusForPath(pathKey: string): {
  active: boolean
  savedAt?: string
  entryCount?: number
  indexPath?: string
} {
  const b = loadBaselineFromDisk(pathKey)
  if (!b) return { active: false }
  return {
    active: true,
    savedAt: b.createdIso,
    entryCount: Object.keys(b.entries).length,
    indexPath: b.indexPath,
  }
}
