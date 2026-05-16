/**
 * Resolve and load `staff_history.dat` for CM0102 archives (.sav / index).
 * Career apps/goals use TStaffHistory (17 bytes), joined on `staff.dat` `id`.
 */

import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { BlockInfo } from './types'
import {
  mergeStaffHistoryByStaffId,
  tryLoadStaffHistoryMapFromDataDirectories,
  type StaffHistoryRecord,
} from './staffHistory'
import { indexStaffHistoryBuffer } from './staffHistoryIndex'
import { collectGameRoots, getSuggestedDatabaseFolder } from '../cm0102Paths'

export type StaffHistoryLoadResult = {
  byStaffId?: Map<number, StaffHistoryRecord[]>
  parsed: boolean
  /** First `staff_history.dat` path used (for UI/debug). */
  sourcePath?: string
}

/** Block names that hold the canonical TStaffHistory table (not runtime `.tmp` heaps). */
export function findEmbeddedStaffHistoryDatBlock(
  blocks: readonly BlockInfo[],
): BlockInfo | undefined {
  const norm = (name: string) =>
    name
      .replace(/\0+$/g, '')
      .trim()
      .toLowerCase()

  const exact = blocks.find((b) => b.size > 0 && norm(b.name) === 'staff_history.dat')
  if (exact) return exact

  return blocks.find((b) => {
    const n = norm(b.name)
    return (
      b.size > 0 &&
      n.includes('staff') &&
      n.includes('history') &&
      n.endsWith('.dat') &&
      !n.includes('comp') &&
      !n.endsWith('.tmp')
    )
  })
}

/**
 * All folders that may contain `staff_history.dat` when loading a save or index.
 * CM keeps this file in `Game/Data/`, not inside most `.sav` archives.
 */
export function collectStaffHistorySearchDirs(archivePath: string, home = homedir()): string[] {
  const out: string[] = []
  const add = (p: string | undefined) => {
    if (!p) return
    const key = p.trim()
    if (key && !out.includes(key)) out.push(key)
  }

  const dir = dirname(archivePath)
  add(dir)
  add(join(dir, 'Data'))
  add(join(dir, '..', 'Data'))
  add(join(dir, '..', '..', 'Data'))

  let walk = dir
  for (let depth = 0; depth < 8; depth++) {
    add(walk)
    add(join(walk, 'Data'))
    const parent = dirname(walk)
    if (parent === walk) break
    walk = parent
  }

  const envData = process.env.CM_SCOUT_DATA_PATH?.trim()
  if (envData) {
    add(envData)
    if (basename(envData).toLowerCase() !== 'data') add(join(envData, 'Data'))
  }

  const suggestedDb = getSuggestedDatabaseFolder(home)
  add(suggestedDb)

  for (const root of collectGameRoots(home)) {
    add(join(root, 'Data'))
    add(root)
  }

  return out
}

function firstStaffHistoryPath(dirs: readonly string[]): string | undefined {
  for (const dir of dirs) {
    const p = join(dir, 'staff_history.dat')
    if (existsSync(p)) return p
  }
  return undefined
}

export function loadStaffHistoryForArchive(
  embeddedRaw: Buffer | null,
  searchDirs: readonly string[],
): StaffHistoryLoadResult {
  let byStaffId: Map<number, StaffHistoryRecord[]> | undefined
  let sourcePath: string | undefined

  const siblingMap = tryLoadStaffHistoryMapFromDataDirectories(searchDirs)
  if (siblingMap) {
    byStaffId = siblingMap
    sourcePath = firstStaffHistoryPath(searchDirs)
  }

  if (embeddedRaw && embeddedRaw.length >= 17) {
    const embeddedMap = indexStaffHistoryBuffer(embeddedRaw)
    if (embeddedMap.size > 0) {
      byStaffId = mergeStaffHistoryByStaffId(byStaffId, embeddedMap)
      if (!sourcePath) sourcePath = '(embedded in archive)'
    }
  }

  const parsed = (byStaffId?.size ?? 0) > 0
  return { byStaffId, parsed, sourcePath }
}
