import { useEffect, useRef, useState } from 'react'
import { ClubFilterCombo } from './ClubFilterCombo'

export type CommittedTextFilters = { q: string; nation: string; club: string }

type Props = {
  clubList: string[]
  onCommit: (v: CommittedTextFilters) => void
  /** Fires while local text differs from last committed payload (debounce window). */
  onPendingChange?: (pending: boolean) => void
  debounceMs?: number
}

/**
 * Name / nation / club live here so typing does not re-render the whole grid (parent only
 * receives `onCommit` after a short idle period).
 */
export function DebouncedTextFilters({
  clubList,
  onCommit,
  onPendingChange,
  debounceMs = 95,
}: Props) {
  const [q, setQ] = useState('')
  const [nation, setNation] = useState('')
  const [club, setClub] = useState('')
  const lastCommitted = useRef<CommittedTextFilters>({ q: '', nation: '', club: '' })

  useEffect(() => {
    const cur: CommittedTextFilters = { q, nation, club }
    const prev = lastCommitted.current
    if (cur.q === prev.q && cur.nation === prev.nation && cur.club === prev.club) {
      onPendingChange?.(false)
      return
    }
    onPendingChange?.(true)
    const id = window.setTimeout(() => {
      lastCommitted.current = cur
      onCommit(cur)
      onPendingChange?.(false)
    }, debounceMs)
    return () => window.clearTimeout(id)
  }, [q, nation, club, debounceMs, onCommit, onPendingChange])

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Search name</span>
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100 outline-none focus:border-emerald-600"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Zidane"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Nation (1st or 2nd)</span>
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
          value={nation}
          onChange={(e) => setNation(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Club</span>
        <ClubFilterCombo clubs={clubList} value={club} onChange={setClub} />
      </label>
    </>
  )
}
