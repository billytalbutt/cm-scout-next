import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridPlayerRow } from '../../../shared/gridTypes'

type Props = {
  loadInfo: boolean
  selectedStaffIndex: number | null
  onPick: (staffIndex: number) => void
  compact?: boolean
}

export function EditorPlayerPicker({ loadInfo, selectedStaffIndex, onPick, compact }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [suggestions, setSuggestions] = useState<GridPlayerRow[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const blurRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || debouncedQ.length < 2 || typeof window.cmapi?.getRows !== 'function') {
      setSuggestions([])
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const out = await window.cmapi.getRows({ q: debouncedQ, limit: 30, gridInclude: { role7: true } })
      if (seq !== seqRef.current) return
      setSuggestions((out.rows ?? []) as GridPlayerRow[])
    } catch {
      if (seq === seqRef.current) setSuggestions([])
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, debouncedQ])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  if (!loadInfo) return null

  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/40 ${compact ? 'p-2' : 'p-2.5'}`}>
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {compact ? 'Switch player' : 'Search player to edit'}
        </span>
        <div className="relative">
          <input
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (blurRef.current) window.clearTimeout(blurRef.current)
              setMenuOpen(true)
            }}
            onBlur={() => {
              blurRef.current = window.setTimeout(() => setMenuOpen(false), 150)
            }}
            placeholder="Type a player name (2+ letters)…"
            spellCheck={false}
            autoComplete="off"
          />
          {loading && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
              …
            </span>
          )}
        </div>
      </label>
      {selectedStaffIndex != null && compact && (
        <p className="mt-1 text-[10px] text-zinc-600">Grid selection still works on All players / Regens.</p>
      )}
      {menuOpen && debouncedQ.length >= 2 && suggestions.length > 0 && (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-0.5 cm-scroll">
          {suggestions.map((p) => (
            <li key={p.staffIndex}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p.staffIndex)
                  setQ(p.name)
                  setMenuOpen(false)
                  setSuggestions([])
                }}
              >
                <span className="text-zinc-100">{p.name}</span>
                <span className="text-[10px] text-zinc-500">
                  {p.club} · CA {p.ca} / PA {p.pa}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debouncedQ.length >= 2 && !loading && suggestions.length === 0 && (
        <p className="mt-1 text-[10px] text-zinc-600">No players match.</p>
      )}
    </div>
  )
}
