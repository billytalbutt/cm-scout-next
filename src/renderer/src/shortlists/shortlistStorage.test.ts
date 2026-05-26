import { describe, expect, it } from 'vitest'
import {
  addToShortlist,
  createShortlist,
  createShortlistAndAddEntry,
  shortlistsContainingEntry,
} from './shortlistStorage'

describe('shortlistStorage', () => {
  const entry = { staffIndex: 42, staffId: 9001, name: 'Test Player' }

  it('createShortlistAndAddEntry adds the player to the new list atomically', () => {
    const empty = { version: 1 as const, lists: [] }
    const { store, list } = createShortlistAndAddEntry(empty, 'players', 'My list', entry)
    expect(list.name).toBe('My list')
    expect(list.entries).toHaveLength(1)
    expect(list.entries[0]?.staffIndex).toBe(42)
    const found = store.lists.find((l) => l.id === list.id)
    expect(found?.entries).toHaveLength(1)
  })

  it('sequential create then add on same store snapshot would miss the list without atomic helper', () => {
    const empty = { version: 1 as const, lists: [] }
    const { store: withList, list } = createShortlist(empty, 'players', 'A')
    const afterAdd = addToShortlist(withList, list.id, entry)
    expect(afterAdd.lists[0]?.entries).toHaveLength(1)
  })

  it('shortlistsContainingEntry returns lists that include the staff index', () => {
    const { store } = createShortlistAndAddEntry({ version: 1, lists: [] }, 'players', 'One', entry)
    const { store: store2, list: list2 } = createShortlist(store, 'players', 'Two')
    const withSecond = addToShortlist(store2, list2.id, entry)
    const hits = shortlistsContainingEntry(withSecond, 'players', 42)
    expect(hits).toHaveLength(2)
  })
})
