import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ShortlistStore } from '../shared/shortlistTypes'
import { pathKeyForDb } from './regenBaseline'

function shortlistsDir(): string {
  const d = join(app.getPath('userData'), 'shortlists')
  mkdirSync(d, { recursive: true })
  return d
}

function filePathForDb(absPath: string): string {
  return join(shortlistsDir(), `${pathKeyForDb(absPath)}.json`)
}

export function loadShortlistStoreFromDisk(absPath: string): ShortlistStore {
  const fp = filePathForDb(absPath)
  if (!existsSync(fp)) return { version: 1, lists: [] }
  try {
    const raw = readFileSync(fp, 'utf8')
    const parsed = JSON.parse(raw) as ShortlistStore
    if (parsed?.version === 1 && Array.isArray(parsed.lists)) return parsed
  } catch {
    /* ignore corrupt file */
  }
  return { version: 1, lists: [] }
}

export function saveShortlistStoreToDisk(absPath: string, store: ShortlistStore): void {
  writeFileSync(filePathForDb(absPath), JSON.stringify(store, null, 2), 'utf8')
}
