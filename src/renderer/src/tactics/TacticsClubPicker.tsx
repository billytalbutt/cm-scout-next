import { useCallback, useEffect, useRef, useState } from 'react'

type ClubListRow = {
  id: number
  name: string
  nation: string
  division: string
}

type Props = {
  loadInfo: boolean
  clubId: number | null
  clubName: string | null
  onSelect: (clubId: number | null, clubName: string | null) => void
}

export function TacticsClubPicker({ loadInfo, clubId, clubName, onSelect }: Props) {
  const [q, setQ] = useState(clubName ?? '')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [suggestions, setSuggestions] = useState<ClubListRow[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const blurRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    setQ(clubName ?? '')
  }, [clubName])

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || !debouncedQ || typeof window.cmapi?.getClubRows !== 'function') {
      setSuggestions([])
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const out = await window.cmapi.getClubRows({ q: debouncedQ, offset: 0, limit: 30 })
      if (seq !== seqRef.current) return
      setSuggestions((out.rows ?? []) as ClubListRow[])
    } catch {
      if (seq === seqRef.current) setSuggestions([])
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, debouncedQ])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  const pick = (c: ClubListRow) => {
    onSelect(c.id, c.name)
    setQ(c.name)
    setMenuOpen(false)
    setSuggestions([])
  }

  const clear = () => {
    onSelect(null, null)
    setQ('')
  }

  if (!loadInfo) {
    return <p className="text-[11px] text-zinc-500">Load a database to pick a club squad.</p>
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Squad club
        </span>
        <div className="relative flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              if (clubId != null && e.target.value !== clubName) onSelect(null, null)
            }}
            onFocus={() => {
              if (blurRef.current) window.clearTimeout(blurRef.current)
              setMenuOpen(true)
            }}
            onBlur={() => {
              blurRef.current = window.setTimeout(() => setMenuOpen(false), 150)
            }}
            placeholder="Search club…"
            spellCheck={false}
            autoComplete="off"
          />
          {clubId != null && (
            <button
              type="button"
              className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
              onClick={clear}
            >
              Clear
            </button>
          )}
          {loading && (
            <span className="pointer-events-none absolute right-14 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
              …
            </span>
          )}
        </div>
      </label>
      {clubId != null && clubName && (
        <p className="mt-1.5 rounded border border-emerald-900/40 bg-emerald-950/25 px-2 py-1 text-[10px] text-emerald-300/90">
          Selected: <span className="font-medium text-emerald-100">{clubName}</span> — use Club squad only in the
          line-up pane.
        </p>
      )}
      {menuOpen && debouncedQ && suggestions.length > 0 && (
        <ul className="mt-1.5 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-0.5 cm-scroll">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-2 py-1.5 text-left text-[11px] hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <span className="text-zinc-100">{c.name}</span>
                <span className="text-[10px] text-zinc-500">
                  {c.nation} · {c.division}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
