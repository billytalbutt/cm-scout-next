import {
  defaultShortlistName,
  newShortlistId,
  type Shortlist,
  type ShortlistEntry,
  type ShortlistKind,
  type ShortlistStore,
} from '../../../shared/shortlistTypes'

const LS_KEY = 'cm-scout-next-shortlists-v1'

function storageKey(dbPath: string | null): string {
  return dbPath ?? '__no_db__'
}

function readAll(): Record<string, ShortlistStore> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ShortlistStore>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, ShortlistStore>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export function loadShortlistStore(dbPath: string | null): ShortlistStore {
  const all = readAll()
  const store = all[storageKey(dbPath)]
  if (store?.version === 1 && Array.isArray(store.lists)) return store
  return { version: 1, lists: [] }
}

export function saveShortlistStore(dbPath: string | null, store: ShortlistStore): void {
  const all = readAll()
  all[storageKey(dbPath)] = store
  writeAll(all)
}

export function createShortlist(
  store: ShortlistStore,
  kind: ShortlistKind,
  name?: string,
): { store: ShortlistStore; list: Shortlist } {
  const now = new Date().toISOString()
  const list: Shortlist = {
    id: newShortlistId(),
    name: name?.trim() || defaultShortlistName(kind, store.lists.filter((l) => l.kind === kind).length),
    kind,
    entries: [],
    createdAt: now,
    updatedAt: now,
  }
  return { store: { version: 1, lists: [...store.lists, list] }, list }
}

export function addToShortlist(
  store: ShortlistStore,
  listId: string,
  entry: Omit<ShortlistEntry, 'addedAt'>,
): ShortlistStore {
  const now = new Date().toISOString()
  return {
    version: 1,
    lists: store.lists.map((l) => {
      if (l.id !== listId) return l
      if (l.entries.some((e) => e.staffIndex === entry.staffIndex)) return l
      return {
        ...l,
        updatedAt: now,
        entries: [...l.entries, { ...entry, addedAt: now }],
      }
    }),
  }
}

export function removeFromShortlist(store: ShortlistStore, listId: string, staffIndex: number): ShortlistStore {
  const now = new Date().toISOString()
  return {
    version: 1,
    lists: store.lists.map((l) =>
      l.id !== listId
        ? l
        : { ...l, updatedAt: now, entries: l.entries.filter((e) => e.staffIndex !== staffIndex) },
    ),
  }
}

export function renameShortlist(store: ShortlistStore, listId: string, name: string): ShortlistStore {
  const now = new Date().toISOString()
  return {
    version: 1,
    lists: store.lists.map((l) => (l.id === listId ? { ...l, name: name.trim() || l.name, updatedAt: now } : l)),
  }
}

export function deleteShortlist(store: ShortlistStore, listId: string): ShortlistStore {
  return { version: 1, lists: store.lists.filter((l) => l.id !== listId) }
}
