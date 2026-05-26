import { useEffect, useMemo, useRef, useState } from 'react'
import type { ShortlistKind } from '../../../shared/shortlistTypes'
import { defaultShortlistName } from '../../../shared/shortlistTypes'
import type { ShortlistsApi } from './useShortlists'

export type ShortlistMenuTarget = {
  staffIndex: number
  staffId: number
  name: string
}

type Props = {
  open: boolean
  x: number
  y: number
  kind: ShortlistKind
  target: ShortlistMenuTarget | null
  shortlists: ShortlistsApi
  onClose: () => void
  onAdded?: (listName: string) => void
  onRemoved?: (listName: string) => void
}

export function ShortlistContextMenu({
  open,
  x,
  y,
  kind,
  target,
  shortlists,
  onClose,
  onAdded,
  onRemoved,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const lists = shortlists.listsForKind(kind)
  const memberLists = useMemo(
    () => (target ? shortlists.listsContainingEntry(kind, target.staffIndex) : []),
    [shortlists, kind, target, lists],
  )
  const addableLists = useMemo(
    () => lists.filter((l) => !memberLists.some((m) => m.id === l.id)),
    [lists, memberLists],
  )

  useEffect(() => {
    if (!open) {
      setCreating(false)
      return
    }
    if (lists.length === 0) {
      setNewName(defaultShortlistName(kind, 0))
      setCreating(true)
    }
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, lists.length, kind])

  if (!open || !target) return null

  const addTo = (listId: string, listName: string) => {
    shortlists.addEntry(listId, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    onAdded?.(listName)
    onClose()
  }

  const removeFrom = (listId: string, listName: string) => {
    shortlists.removeEntry(listId, target.staffIndex)
    onRemoved?.(listName)
    onClose()
  }

  const submitCreate = () => {
    const list = shortlists.createListAndAddEntry(kind, newName.trim() || undefined, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    onAdded?.(list.name)
    setCreating(false)
    setNewName('')
    onClose()
  }

  const menuTitle =
    memberLists.length > 0 && addableLists.length === 0 && !creating
      ? 'Remove from shortlist'
      : memberLists.length > 0
        ? 'Shortlists'
        : 'Add to shortlist'

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{menuTitle}</div>
      {memberLists.length > 0 && (
        <>
          <div className="px-2 pb-0.5 text-[10px] text-zinc-600">On these lists</div>
          {memberLists.map((l) => (
            <button
              key={`rm-${l.id}`}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-xs text-rose-200/90 hover:bg-zinc-800"
              onClick={() => removeFrom(l.id, l.name)}
            >
              Remove from {l.name}
            </button>
          ))}
        </>
      )}
      {(addableLists.length > 0 || creating || lists.length === 0) && (
        <>
          {memberLists.length > 0 && addableLists.length > 0 && (
            <div className="mt-0.5 border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-600">Add to</div>
          )}
          {lists.length === 0 && !creating && (
            <p className="px-2 py-1 text-[11px] text-zinc-500">No lists yet — create one below.</p>
          )}
          {addableLists.map((l) => (
            <button
              key={`add-${l.id}`}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={() => addTo(l.id, l.name)}
            >
              {l.name}
              <span className="ml-1 text-zinc-500">({l.entries.length})</span>
            </button>
          ))}
          {creating ? (
            <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={defaultShortlistName(kind, lists.length)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate()
                  if (e.key === 'Escape') {
                    setCreating(false)
                    onClose()
                  }
                }}
              />
              <button
                type="button"
                className="w-full rounded bg-zinc-700/80 py-1 text-[11px] font-medium text-zinc-100 hover:bg-zinc-600/80"
                onClick={submitCreate}
              >
                Create & add
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="block w-full border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                setNewName(defaultShortlistName(kind, lists.length))
                setCreating(true)
              }}
            >
              Create new shortlist…
            </button>
          )}
        </>
      )}
    </div>
  )
}
