import { useCallback, useEffect, useState } from 'react'
import type { ClubListRow } from '../ClubBrowsePanel'
import type { ClubFavoriteEntry } from '../../../shared/clubFavoritesTypes'
import { loadClubFavorites, saveClubFavorites } from './clubFavoritesStorage'

export function useClubFavorites(dbPath: string | null) {
  const [favorites, setFavorites] = useState<ClubFavoriteEntry[]>(() => loadClubFavorites(dbPath))

  useEffect(() => {
    setFavorites(loadClubFavorites(dbPath))
  }, [dbPath])

  const persist = useCallback(
    (next: ClubFavoriteEntry[]) => {
      setFavorites(next)
      saveClubFavorites(dbPath, next)
    },
    [dbPath],
  )

  const isFavorite = useCallback((clubId: number) => favorites.some((f) => f.id === clubId), [favorites])

  const addFavorite = useCallback(
    (club: ClubListRow) => {
      if (favorites.some((f) => f.id === club.id)) return
      persist([...favorites, { id: club.id, name: club.name, nation: club.nation, division: club.division }])
    },
    [favorites, persist],
  )

  const removeFavorite = useCallback(
    (clubId: number) => {
      persist(favorites.filter((f) => f.id !== clubId))
    },
    [favorites, persist],
  )

  const toggleFavorite = useCallback(
    (club: ClubListRow) => {
      if (isFavorite(club.id)) removeFavorite(club.id)
      else addFavorite(club)
    },
    [addFavorite, isFavorite, removeFavorite],
  )

  return { favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite }
}
