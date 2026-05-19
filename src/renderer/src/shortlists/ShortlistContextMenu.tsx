import { useEffect, useRef, useState } from 'react'
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
}

export function ShortlistContextMenu({ open, x, y, kind, target, shortlists, onClose, onAdded }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  if (!open || !target) return null

  const lists = shortlists.listsForKind(kind)

  const addTo = (listId: string, listName: string) => {
    shortlists.addEntry(listId, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    onAdded?.(listName)
    onClose()
  }

  const submitCreate = () => {
    const list = shortlists.createList(kind, newName.trim() || undefined)
    addTo(list.id, list.name)
    setCreating(false)
    setNewName('')
  }

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Add to shortlist</div>
      {lists.length === 0 && !creating && (
        <p className="px-2 py-1 text-[11px] text-zinc-500">No lists yet — create one below.</p>
      )}
      {lists.map((l) => (
        <button
          key={l.id}
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
            className="w-full rounded bg-emerald-800/50 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-800/70"
            onClick={submitCreate}
          >
            Create & add
          </button>
        </div>
      ) : (
        <button
          type="button"
          role="menuitem"
          className="block w-full border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-emerald-300/90 hover:bg-zinc-800"
          onClick={() => {
            setNewName(defaultShortlistName(kind, lists.length))
            setCreating(true)
          }}
        >
          Create new shortlist…
        </button>
      )}
    </div>
  )
}
