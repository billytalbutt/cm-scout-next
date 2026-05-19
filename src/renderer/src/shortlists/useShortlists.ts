import { useCallback, useEffect, useState } from 'react'
import type { Shortlist, ShortlistEntry, ShortlistKind, ShortlistStore } from '../../../shared/shortlistTypes'
import {
  addToShortlist,
  createShortlist,
  deleteShortlist,
  loadShortlistStore,
  removeFromShortlist,
  renameShortlist,
  saveShortlistStore,
} from './shortlistStorage'

export function useShortlists(dbPath: string | null) {
  const [store, setStore] = useState<ShortlistStore>(() => loadShortlistStore(dbPath))

  useEffect(() => {
    setStore(loadShortlistStore(dbPath))
  }, [dbPath])

  const persist = useCallback(
    (next: ShortlistStore) => {
      setStore(next)
      saveShortlistStore(dbPath, next)
    },
    [dbPath],
  )

  const listsForKind = useCallback(
    (kind: ShortlistKind) => store.lists.filter((l) => l.kind === kind),
    [store.lists],
  )

  const createList = useCallback(
    (kind: ShortlistKind, name?: string) => {
      const { store: next, list } = createShortlist(store, kind, name)
      persist(next)
      return list
    },
    [store, persist],
  )

  const addEntry = useCallback(
    (listId: string, entry: Omit<ShortlistEntry, 'addedAt'>) => {
      persist(addToShortlist(store, listId, entry))
    },
    [store, persist],
  )

  const removeEntry = useCallback(
    (listId: string, staffIndex: number) => {
      persist(removeFromShortlist(store, listId, staffIndex))
    },
    [store, persist],
  )

  const renameList = useCallback(
    (listId: string, name: string) => {
      persist(renameShortlist(store, listId, name))
    },
    [store, persist],
  )

  const removeList = useCallback(
    (listId: string) => {
      persist(deleteShortlist(store, listId))
    },
    [store, persist],
  )

  const getList = useCallback((listId: string) => store.lists.find((l) => l.id === listId), [store.lists])

  return {
    store,
    lists: store.lists,
    listsForKind,
    createList,
    addEntry,
    removeEntry,
    renameList,
    removeList,
    getList,
  }
}

export type ShortlistsApi = ReturnType<typeof useShortlists>
