import { useCallback, useEffect, useRef, useState } from 'react'

export type ClubListRow = {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
}

export type ClubDetailSquadRow = {
  staffIndex: number
  name: string
  ca: number
  pa: number
  club: string
}

export type ClubDetailPayload = {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
  attendance: number
  training: number
  squad: ClubDetailSquadRow[]
  stadium?: {
    name: string
    cityId: number
    capacity: number
    seatingCapacity: number
    expansionCapacity: number
    nearbyStadiumId: number
    covered: boolean
    underSoilHeating: boolean
  } | null
  tacticSelectedId?: number
  tacticTrainingIds?: number[]
  teamSelectedStaffIds?: number[]
  tacticsWire?: {
    tacticsBlockPresent: boolean
    tacticsRowBytes: number | null
    tacticsRowCount: number | null
    tacticRowFound: boolean
    tacticRowHexPrefix: string | null
    experimentalSlots: { x: number; y: number; label: string }[] | null
  }
  xiNames?: { staffId: number; name: string }[]
}

type Props = {
  loadInfo: boolean
  onOpenPlayerProfile: (staffIndex: number) => void
  /** When set, selecting a club updates the tactics tab “seed” club for save wiring. */
  onClubSelectForTactics?: (clubId: number | null) => void
}

const SUGGEST_LIMIT = 40

export function ClubBrowsePanel({ loadInfo, onOpenPlayerProfile, onClubSelectForTactics }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [suggestions, setSuggestions] = useState<ClubListRow[]>([])
  const [lockedName, setLockedName] = useState<string | null>(null)
  const [selId, setSelId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClubDetailPayload | null>(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const seqRef = useRef(0)
  const blurCloseRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.getClubRows !== 'function') {
      setSuggestions([])
      return
    }
    if (!debouncedQ) {
      setSuggestions([])
      return
    }
    const seq = ++seqRef.current
    setLoadingSuggest(true)
    setErr(null)
    try {
      const out = await window.cmapi.getClubRows({ q: debouncedQ, offset: 0, limit: SUGGEST_LIMIT })
      if (seq !== seqRef.current) return
      setSuggestions((out.rows ?? []) as ClubListRow[])
    } catch (e) {
      if (seq !== seqRef.current) return
      setErr(e instanceof Error ? e.message : String(e))
      setSuggestions([])
    } finally {
      if (seq === seqRef.current) setLoadingSuggest(false)
    }
  }, [loadInfo, debouncedQ])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  const loadDetail = useCallback(async (id: number) => {
    if (typeof window.cmapi?.getClubDetail !== 'function') return
    setErr(null)
    try {
      const d = (await window.cmapi.getClubDetail(id)) as ClubDetailPayload | null
      setDetail(d)
    } catch (e) {
      setDetail(null)
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (selId == null) {
      setDetail(null)
      onClubSelectForTactics?.(null)
      return
    }
    onClubSelectForTactics?.(selId)
    void loadDetail(selId)
  }, [selId, loadDetail, onClubSelectForTactics])

  const onInputChange = (next: string) => {
    setQ(next)
    if (lockedName != null && next !== lockedName) {
      setLockedName(null)
      setSelId(null)
    }
  }

  const pickClub = (c: ClubListRow) => {
    setLockedName(c.name)
    setQ(c.name)
    setSelId(c.id)
    setMenuOpen(false)
  }

  const onInputBlur = () => {
    blurCloseRef.current = window.setTimeout(() => setMenuOpen(false), 150)
  }

  const onInputFocus = () => {
    if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current)
    setMenuOpen(true)
  }

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  const showSuggestPanel = menuOpen && debouncedQ.length > 0 && suggestions.length > 0

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Search club</span>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 pr-8 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
                value={q}
                onChange={(e) => onInputChange(e.target.value)}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                placeholder="Type a club name…"
                spellCheck={false}
                autoComplete="off"
              />
              {loadingSuggest && (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                  …
                </span>
              )}
            </div>
          </label>
          {showSuggestPanel && (
            <ul
              className="mt-2 max-h-56 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950/80 py-0.5 cm-scroll"
              role="listbox"
            >
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left text-xs transition hover:bg-zinc-800/80 ${
                      selId === c.id ? 'bg-emerald-950/30 text-emerald-100' : 'text-zinc-300'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickClub(c)}
                  >
                    <span className="font-medium text-zinc-100">{c.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      {c.nation} · {c.division}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
        {debouncedQ && !loadingSuggest && suggestions.length === 0 && !err && (
          <p className="mt-2 text-[11px] text-zinc-500">No clubs match that text.</p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        {!detail && <p className="text-sm text-zinc-500">Search and pick a club for squad, stadium, and tactics.</p>}
        {detail && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{detail.name}</h3>
              <p className="text-[11px] text-zinc-500">
                {detail.nation} · {detail.division}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                <dt>Reputation</dt>
                <dd className="font-mono text-zinc-200">{detail.reputation}</dd>
                <dt>Club funds</dt>
                <dd className="font-mono text-zinc-200">{detail.cash.toLocaleString()}</dd>
                <dt>Transfer budget (save)</dt>
                <dd className="text-zinc-500">Not in this row — in-game board / finances</dd>
                <dt>Stadium id</dt>
                <dd className="font-mono text-zinc-200">{detail.stadiumId}</dd>
                <dt>Attendance</dt>
                <dd className="font-mono text-zinc-200">{detail.attendance.toLocaleString()}</dd>
                <dt>Training facilities</dt>
                <dd className="font-mono text-zinc-200">
                  {detail.training} <span className="text-zinc-500">/ 20</span>
                </dd>
                <dt>Youth / other facilities</dt>
                <dd className="text-zinc-500">
                  {detail.stadium
                    ? `Ground data from stadium.dat (capacity ${detail.stadium.capacity.toLocaleString()}; youth/training complex scores are not separate fields in this parser).`
                    : 'No stadium.dat row for this stadium id — ground breakdown unavailable.'}
                </dd>
              </dl>
              {detail.stadium && (
                <div className="mt-2 rounded border border-zinc-800/80 bg-zinc-950/40 p-2 text-[11px] text-zinc-400">
                  <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Stadium (stadium.dat)</h4>
                  <p className="font-medium text-zinc-200">{detail.stadium.name}</p>
                  <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <dt>Capacity</dt>
                    <dd className="font-mono text-zinc-200">{detail.stadium.capacity.toLocaleString()}</dd>
                    <dt>Seating</dt>
                    <dd className="font-mono text-zinc-200">{detail.stadium.seatingCapacity.toLocaleString()}</dd>
                    <dt>Expansion cap.</dt>
                    <dd className="font-mono text-zinc-200">{detail.stadium.expansionCapacity.toLocaleString()}</dd>
                    <dt>City id</dt>
                    <dd className="font-mono text-zinc-200">{detail.stadium.cityId}</dd>
                    <dt>Covered</dt>
                    <dd className="text-zinc-200">{detail.stadium.covered ? 'Yes' : 'No'}</dd>
                    <dt>Soil heating</dt>
                    <dd className="text-zinc-200">{detail.stadium.underSoilHeating ? 'Yes' : 'No'}</dd>
                    <dt>Nearby stadium id</dt>
                    <dd className="font-mono text-zinc-200">{detail.stadium.nearbyStadiumId}</dd>
                  </dl>
                </div>
              )}
              {(detail.tacticSelectedId != null || detail.tacticsWire) && (
                <div className="mt-2 rounded border border-zinc-800/80 bg-zinc-950/40 p-2 text-[11px] text-zinc-400">
                  <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Tactics (club.dat + tactics.dat)</h4>
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <dt>TacticSelected id</dt>
                    <dd className="font-mono text-zinc-200">{detail.tacticSelectedId ?? '—'}</dd>
                    <dt>TacticTraining ids</dt>
                    <dd className="font-mono text-zinc-200">{(detail.tacticTrainingIds ?? []).join(', ') || '—'}</dd>
                    <dt>tactics.dat</dt>
                    <dd className="text-zinc-200">
                      {detail.tacticsWire?.tacticsBlockPresent
                        ? `${detail.tacticsWire.tacticsRowCount ?? '?'} rows × ${detail.tacticsWire.tacticsRowBytes ?? '?'} bytes`
                        : 'block not in index'}
                    </dd>
                    <dt>Row match</dt>
                    <dd className="text-zinc-200">{detail.tacticsWire?.tacticRowFound ? 'Found' : 'Not found'}</dd>
                  </dl>
                  {detail.tacticsWire?.tacticRowHexPrefix && (
                    <p className="mt-1 break-all font-mono text-[10px] text-zinc-500" title="First bytes of tactic row">
                      {detail.tacticsWire.tacticRowHexPrefix}
                    </p>
                  )}
                </div>
              )}
              {detail.xiNames && detail.xiNames.length > 0 && (
                <div className="mt-2 rounded border border-zinc-800/80 bg-zinc-950/40 p-2 text-[11px] text-zinc-400">
                  <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">
                    TeamSelected (first names, up to 11 ids)
                  </h4>
                  <ol className="list-inside list-decimal text-zinc-300">
                    {detail.xiNames.map((x) => (
                      <li key={x.staffId}>
                        {x.name} <span className="font-mono text-zinc-500">({x.staffId})</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Squad (from club slots)</h4>
            <div className="cm-scroll min-h-0 flex-1 overflow-y-auto rounded border border-zinc-800/80">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr>
                    <th className="px-2 py-1.5">Player</th>
                    <th className="px-2 py-1.5">CA</th>
                    <th className="px-2 py-1.5">PA</th>
                    <th className="px-2 py-1.5"> </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.squad.map((p) => (
                    <tr key={p.staffIndex} className="border-b border-zinc-800/50">
                      <td className="px-2 py-1 text-zinc-200">{p.name}</td>
                      <td className="px-2 py-1 font-mono text-zinc-300">{p.ca}</td>
                      <td className="px-2 py-1 font-mono text-zinc-300">{p.pa}</td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          className="rounded border border-emerald-700/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-900/50"
                          onClick={() => onOpenPlayerProfile(p.staffIndex)}
                        >
                          Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
