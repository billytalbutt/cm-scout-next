import { useCallback, useEffect, useRef, useState } from 'react'
import { staffJobForClubLabel } from '../../../shared/staffJobCatalog'

type StaffRow = {
  staffIndex: number
  name: string
  jobLabel?: string
  club?: string
}

type Props = {
  loadInfo: boolean
  selectedStaffIndex: number | null
  onPick: (staffIndex: number) => void
  mdOnlyDefault?: boolean
}

export function EditorStaffPicker({ loadInfo, selectedStaffIndex, onPick, mdOnlyDefault }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [mdOnly, setMdOnly] = useState(mdOnlyDefault === true)
  const [suggestions, setSuggestions] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || debouncedQ.length < 2 || typeof window.cmapi?.getStaffRows !== 'function') {
      setSuggestions([])
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const filter: Record<string, unknown> = { q: debouncedQ, limit: 25 }
      if (mdOnly) filter.jobForClub = 2
      const out = await window.cmapi.getStaffRows(filter)
      if (seq !== seqRef.current) return
      setSuggestions(
        (out.rows ?? []).map((r) => ({
          staffIndex: Number(r.staffIndex),
          name: String(r.name ?? ''),
          jobLabel: typeof r.jobLabel === 'string' ? r.jobLabel : staffJobForClubLabel(Number(r.jobForClub ?? 0)),
          club: typeof r.club === 'string' ? r.club : undefined,
        })),
      )
    } catch {
      if (seq === seqRef.current) setSuggestions([])
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, debouncedQ, mdOnly])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  if (!loadInfo) return null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={mdOnly} onChange={(e) => setMdOnly(e.target.checked)} className="rounded" />
        Managing directors only (job id 2)
      </label>
      <input
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search staff name (2+ letters)…"
        spellCheck={false}
      />
      {loading && <p className="mt-1 text-[10px] text-zinc-500">Searching…</p>}
      {debouncedQ.length >= 2 && suggestions.length > 0 && (
        <ul className="mt-1.5 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-0.5">
          {suggestions.map((s) => (
            <li key={s.staffIndex}>
              <button
                type="button"
                className="flex w-full flex-col px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-800"
                onClick={() => {
                  onPick(s.staffIndex)
                  setQ(s.name)
                }}
              >
                <span className="text-zinc-100">{s.name}</span>
                <span className="text-[10px] text-zinc-500">
                  {s.jobLabel}
                  {s.club ? ` · ${s.club}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedStaffIndex != null && (
        <p className="mt-1 text-[10px] text-zinc-600">Selected staff index {selectedStaffIndex}</p>
      )}
    </div>
  )
}
