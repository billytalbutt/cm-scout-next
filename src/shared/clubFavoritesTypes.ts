export type ClubFavoriteEntry = {
  id: number
  name: string
  nation: string
  division: string
}

export type ClubFavoritesStore = {
  version: 1
  clubs: ClubFavoriteEntry[]
}
