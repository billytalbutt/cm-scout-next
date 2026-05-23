import { useEffect, useRef, useState } from 'react'
import { ClubFilterCombo } from './ClubFilterCombo'
import { ListFilterCombo } from './ListFilterCombo'

export type CommittedTextFilters = { q: string; nation: string; club: string }

const NATION_PLACEHOLDER_EXAMPLES = ['France', 'Brazil', 'England', 'Italy', 'Spain', 'Germany', 'Argentina'] as const

type Props = {
  nationList: string[]
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
  nationList,
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
        <span className="filter-field-label">Search name</span>
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Zidane"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      <label className="block">
        <span className="filter-field-label">Nation (1st or 2nd)</span>
        <ListFilterCombo
          items={nationList}
          value={nation}
          onChange={setNation}
          emptyPlaceholder="Nation (load database for nation list)"
          exampleCandidates={NATION_PLACEHOLDER_EXAMPLES}
        />
      </label>
      <label className="block">
        <span className="filter-field-label">Club</span>
        <ClubFilterCombo clubs={clubList} value={club} onChange={setClub} />
      </label>
    </>
  )
}
