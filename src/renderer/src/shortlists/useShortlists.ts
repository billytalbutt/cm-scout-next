import { useCallback, useEffect, useRef, useState } from 'react'
import type { Shortlist, ShortlistEntry, ShortlistKind, ShortlistStore } from '../../../shared/shortlistTypes'
import {
  addToShortlist,
  createShortlist,
  createShortlistAndAddEntry,
  deleteShortlist,
  loadShortlistStore,
  removeFromShortlist,
  renameShortlist,
  saveShortlistStore,
  shortlistsContainingEntry,
} from './shortlistStorage'

const EMPTY_STORE: ShortlistStore = { version: 1, lists: [] }

export function useShortlists(dbPath: string | null) {
  const [store, setStore] = useState<ShortlistStore>(EMPTY_STORE)
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    if (!dbPath) {
      setStore(EMPTY_STORE)
      return
    }
    let cancelled = false
    void loadShortlistStore(dbPath).then((s) => {
      if (!cancelled) setStore(s)
    })
    return () => {
      cancelled = true
    }
  }, [dbPath])

  const persist = useCallback(
    (next: ShortlistStore) => {
      storeRef.current = next
      setStore(next)
      if (dbPath) void saveShortlistStore(dbPath, next)
    },
    [dbPath],
  )

  const listsForKind = useCallback(
    (kind: ShortlistKind) => store.lists.filter((l) => l.kind === kind),
    [store.lists],
  )

  const listsContainingEntry = useCallback(
    (kind: ShortlistKind, staffIndex: number) =>
      shortlistsContainingEntry(storeRef.current, kind, staffIndex),
    [store.lists],
  )

  const createList = useCallback(
    (kind: ShortlistKind, name?: string) => {
      const { store: next, list } = createShortlist(storeRef.current, kind, name)
      persist(next)
      return list
    },
    [persist],
  )

  const createListAndAddEntry = useCallback(
    (kind: ShortlistKind, name: string | undefined, entry: Omit<ShortlistEntry, 'addedAt'>) => {
      const { store: next, list } = createShortlistAndAddEntry(storeRef.current, kind, name, entry)
      persist(next)
      return list
    },
    [persist],
  )

  const addEntry = useCallback(
    (listId: string, entry: Omit<ShortlistEntry, 'addedAt'>) => {
      persist(addToShortlist(storeRef.current, listId, entry))
    },
    [persist],
  )

  const removeEntry = useCallback(
    (listId: string, staffIndex: number) => {
      persist(removeFromShortlist(storeRef.current, listId, staffIndex))
    },
    [persist],
  )

  const renameList = useCallback(
    (listId: string, name: string) => {
      persist(renameShortlist(storeRef.current, listId, name))
    },
    [persist],
  )

  const removeList = useCallback(
    (listId: string) => {
      persist(deleteShortlist(storeRef.current, listId))
    },
    [persist],
  )

  const getList = useCallback((listId: string) => store.lists.find((l) => l.id === listId), [store.lists])

  return {
    store,
    lists: store.lists,
    listsForKind,
    listsContainingEntry,
    createList,
    createListAndAddEntry,
    addEntry,
    removeEntry,
    renameList,
    removeList,
    getList,
  }
}

export type ShortlistsApi = ReturnType<typeof useShortlists>
