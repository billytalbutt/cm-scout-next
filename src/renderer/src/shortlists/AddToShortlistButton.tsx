import { useEffect, useMemo, useRef, useState } from 'react'
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
  /** Match profile toolbar buttons (Pop out, Copy attributes). */
  variant?: 'toolbar' | 'accent'
}

const TOOLBAR_BTN =
  'rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700/60 disabled:cursor-not-allowed disabled:opacity-40'

const TOOLBAR_BTN_ON_LIST =
  'rounded-md border border-zinc-500/70 bg-zinc-700/50 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition hover:bg-zinc-600/50 disabled:cursor-not-allowed disabled:opacity-40'

export function AddToShortlistButton({
  kind,
  target,
  shortlists,
  disabled,
  className,
  variant = 'accent',
}: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const lists = shortlists.listsForKind(kind)
  const memberLists = useMemo(
    () => shortlists.listsContainingEntry(kind, target.staffIndex),
    [shortlists, kind, target.staffIndex, lists],
  )
  const addableLists = useMemo(
    () => lists.filter((l) => !memberLists.some((m) => m.id === l.id)),
    [lists, memberLists],
  )
  const onAnyList = memberLists.length > 0

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const flash = (text: string) => {
    setMsg(text)
    window.setTimeout(() => setMsg(null), 2500)
  }

  const addTo = (listId: string, listName: string) => {
    shortlists.addEntry(listId, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    flash(`Added to ${listName}`)
    setOpen(false)
    setCreating(false)
  }

  const removeFrom = (listId: string, listName: string) => {
    shortlists.removeEntry(listId, target.staffIndex)
    flash(`Removed from ${listName}`)
    if (memberLists.length <= 1) setOpen(false)
  }

  const submitCreate = () => {
    const list = shortlists.createListAndAddEntry(kind, newName.trim() || undefined, {
      staffIndex: target.staffIndex,
      staffId: target.staffId,
      name: target.name,
    })
    flash(`Created ${list.name} and added ${target.name}`)
    setNewName('')
    setCreating(false)
    setOpen(false)
  }

  const openMenu = () => {
    if (lists.length === 0) {
      setNewName(defaultShortlistName(kind, 0))
      setCreating(true)
    }
    setOpen(true)
  }

  const buttonLabel =
    memberLists.length > 1
      ? 'Remove from shortlist…'
      : memberLists.length === 1
        ? 'Remove from shortlist'
        : 'Add to shortlist'

  const btnClass =
    variant === 'toolbar'
      ? onAnyList
        ? TOOLBAR_BTN_ON_LIST
        : TOOLBAR_BTN
      : onAnyList
        ? 'rounded-md border border-zinc-600/70 bg-zinc-800/70 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition hover:bg-zinc-700/70 disabled:opacity-40'
        : 'rounded-md border border-emerald-700/45 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-900/45 disabled:opacity-40'

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        className={btnClass}
        onClick={() => {
          if (open) {
            setOpen(false)
            setCreating(false)
          } else {
            openMenu()
          }
        }}
      >
        {buttonLabel}
      </button>
      {msg && <span className="ml-2 text-[10px] text-zinc-400">{msg}</span>}
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[13rem] rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-lg">
          {memberLists.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Remove from
              </div>
              {memberLists.map((l) => (
                <button
                  key={`rm-${l.id}`}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs text-rose-200/90 hover:bg-zinc-800"
                  onClick={() => removeFrom(l.id, l.name)}
                >
                  {l.name}
                </button>
              ))}
            </>
          )}
          {(addableLists.length > 0 || creating || lists.length === 0) && (
            <>
              {memberLists.length > 0 && (
                <div className="mt-0.5 border-t border-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Add to
                </div>
              )}
              {lists.length === 0 && !creating && (
                <p className="px-2 py-1 text-[11px] text-zinc-500">No lists yet — create one below.</p>
              )}
              {addableLists.map((l) => (
                <button
                  key={`add-${l.id}`}
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
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
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
                    className="w-full rounded bg-zinc-700/80 py-1 text-[11px] font-medium text-zinc-100 hover:bg-zinc-600/80"
                    onClick={submitCreate}
                  >
                    Create & add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
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
      )}
    </div>
  )
}
