export type ShortlistKind = 'players' | 'staff'

export type ShortlistEntry = {
  staffIndex: number
  staffId: number
  name: string
  addedAt: string
}

export type Shortlist = {
  id: string
  name: string
  kind: ShortlistKind
  entries: ShortlistEntry[]
  createdAt: string
  updatedAt: string
}

export type ShortlistStore = {
  version: 1
  lists: Shortlist[]
}

export function defaultShortlistName(kind: ShortlistKind, existingCount: number): string {
  const n = existingCount + 1
  return kind === 'players' ? `Scout shortlist ${n}` : `Staff shortlist ${n}`
}

export function newShortlistId(): string {
  return `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** CM0102 game limit for `.pls` shortlists. */
export const SHORTLIST_PLS_MAX_PLAYERS = 200
