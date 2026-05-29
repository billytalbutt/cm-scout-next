import type { ClubFavoriteEntry, ClubFavoritesStore } from '../../../shared/clubFavoritesTypes'

import { MERLIN_LS } from '../../../shared/merlinStorageKeys'

const LS_KEY = MERLIN_LS.clubFavorites

function storageKey(dbPath: string | null): string {
  return dbPath ?? '__no_db__'
}

function readAll(): Record<string, ClubFavoritesStore> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ClubFavoritesStore>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, ClubFavoritesStore>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export function loadClubFavorites(dbPath: string | null): ClubFavoriteEntry[] {
  const store = readAll()[storageKey(dbPath)]
  if (store?.version === 1 && Array.isArray(store.clubs)) return store.clubs
  return []
}

export function saveClubFavorites(dbPath: string | null, clubs: ClubFavoriteEntry[]): void {
  const all = readAll()
  all[storageKey(dbPath)] = { version: 1, clubs }
  writeAll(all)
}
