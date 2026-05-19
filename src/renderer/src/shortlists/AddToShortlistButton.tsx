import { useRef, useState } from 'react'
import type { ShortlistKind } from '../../../shared/shortlistTypes'
import { defaultShortlistName } from '../../../shared/shortlistTypes'
import type { ShortlistMenuTarget } from './ShortlistContextMenu'
import type { ShortlistsApi } from './useShortlists'

type Props = {
  kind: ShortlistKind
  target: ShortlistMenuTarget
  shortlists: ShortlistsApi
  disabled?: boolean
  className?: string
}

export function AddToShortlistButton({ kind, target, shortlists, disabled, className }: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const lists = shortlists.listsForKind(kind)

  const addTo = (listId: string, listName: string) => {
    shortlists.addEntry(listId, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    setMsg(`Added to ${listName}`)
    setOpen(false)
    setCreating(false)
    window.setTimeout(() => setMsg(null), 2500)
  }

  const submitCreate = () => {
    const list = shortlists.createList(kind, newName.trim() || undefined)
    addTo(list.id, list.name)
    setNewName('')
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        className="rounded-md border border-emerald-700/45 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-900/45 disabled:opacity-40"
        onClick={() => setOpen((v) => !v)}
      >
        Add to shortlist
      </button>
      {msg && <span className="ml-2 text-[10px] text-emerald-300/90">{msg}</span>}
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-lg">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={() => addTo(l.id, l.name)}
            >
              {l.name}
            </button>
          ))}
          {creating ? (
            <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={defaultShortlistName(kind, lists.length)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
              />
              <button
                type="button"
                className="w-full rounded bg-emerald-800/50 py-1 text-[11px] text-emerald-100"
                onClick={submitCreate}
              >
                Create & add
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="block w-full border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-emerald-300/90 hover:bg-zinc-800"
              onClick={() => {
                setNewName(defaultShortlistName(kind, lists.length))
                setCreating(true)
              }}
            >
              Create new…
            </button>
          )}
        </div>
      )}
    </div>
  )
}
