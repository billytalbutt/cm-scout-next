import {
  defaultShortlistName,
  newShortlistId,
  type Shortlist,
  type ShortlistEntry,
  type ShortlistKind,
  type ShortlistStore,
} from '../../../shared/shortlistTypes'
import { MERLIN_LS } from '../../../shared/merlinStorageKeys'

const LS_KEY = MERLIN_LS.shortlists

function readLocalFallback(): Record<string, ShortlistStore> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ShortlistStore>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalFallback(dbPath: string, store: ShortlistStore): void {
  const all = readLocalFallback()
  all[dbPath] = store
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

/** Load shortlists for this save — persisted in app userData (survives restarts). */
export async function loadShortlistStore(dbPath: string | null): Promise<ShortlistStore> {
  if (!dbPath) return { version: 1, lists: [] }
  if (typeof window.cmapi?.getShortlistStore === 'function') {
    try {
      const store = await window.cmapi.getShortlistStore()
      if (store?.version === 1 && Array.isArray(store.lists)) {
        if (store.lists.length > 0) return store
        const local = readLocalFallback()[dbPath]
        if (local?.version === 1 && local.lists.length > 0) {
          await saveShortlistStore(dbPath, local)
          return local
        }
        return store
      }
    } catch {
      /* fall through */
    }
  }
  const local = readLocalFallback()[dbPath]
  if (local?.version === 1 && Array.isArray(local.lists)) return local
  return { version: 1, lists: [] }
}

export async function saveShortlistStore(dbPath: string | null, store: ShortlistStore): Promise<void> {
  if (!dbPath) return
  if (typeof window.cmapi?.setShortlistStore === 'function') {
    const r = await window.cmapi.setShortlistStore(store)
    if (r.ok) return
  }
  writeLocalFallback(dbPath, store)
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

export function shortlistsContainingEntry(
  store: ShortlistStore,
  kind: ShortlistKind,
  staffIndex: number,
): Shortlist[] {
  return store.lists.filter(
    (l) => l.kind === kind && l.entries.some((e) => e.staffIndex === staffIndex),
  )
}

export function createShortlistAndAddEntry(
  store: ShortlistStore,
  kind: ShortlistKind,
  name: string | undefined,
  entry: Omit<ShortlistEntry, 'addedAt'>,
): { store: ShortlistStore; list: Shortlist } {
  const { store: withList, list } = createShortlist(store, kind, name)
  const next = addToShortlist(withList, list.id, entry)
  const updated = next.lists.find((l) => l.id === list.id)!
  return { store: next, list: updated }
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
