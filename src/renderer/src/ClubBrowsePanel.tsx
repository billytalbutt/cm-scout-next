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
}

type Props = {
  loadInfo: boolean
  onOpenPlayerProfile: (staffIndex: number) => void
}

export function ClubBrowsePanel({ loadInfo, onOpenPlayerProfile }: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [rows, setRows] = useState<ClubListRow[]>([])
  const [total, setTotal] = useState(0)
  const [selId, setSelId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ClubDetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadList = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.getClubRows !== 'function') {
      setRows([])
      setTotal(0)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    setErr(null)
    try {
      const out = await window.cmapi.getClubRows({ q: debouncedQ, offset: 0, limit: 5000 })
      if (seq !== seqRef.current) return
      setRows((out.rows ?? []) as ClubListRow[])
      setTotal(typeof out.total === 'number' ? out.total : 0)
    } catch (e) {
      if (seq !== seqRef.current) return
      setErr(e instanceof Error ? e.message : String(e))
      setRows([])
      setTotal(0)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, debouncedQ])

  useEffect(() => {
    void loadList()
  }, [loadList])

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
      return
    }
    void loadDetail(selId)
  }, [selId, loadDetail])

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <label className="mb-2 block">
          <span className="mb-1 block text-xs text-zinc-500">Search club</span>
          <input
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Blackburn"
            spellCheck={false}
          />
        </label>
        {loading && <p className="text-xs text-zinc-500">Loading…</p>}
        {err && <p className="text-xs text-rose-300">{err}</p>}
        <p className="mb-1 text-[10px] text-zinc-600">
          {total} clubs · cash &amp; reputation from <span className="font-mono">club.dat</span>
        </p>
        <div className="cm-scroll min-h-0 flex-1 overflow-y-auto rounded border border-zinc-800/80">
          <ul className="divide-y divide-zinc-800/80">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelId(c.id)}
                  className={`flex w-full flex-col items-start gap-0.5 px-2 py-2 text-left text-xs transition hover:bg-zinc-800/50 ${
                    selId === c.id ? 'bg-emerald-950/25 text-emerald-100' : 'text-zinc-300'
                  }`}
                >
                  <span className="font-medium text-zinc-100">{c.name}</span>
                  <span className="text-[10px] text-zinc-500">
                    {c.nation} · {c.division} · rep{' '}
                    <span className="font-mono text-zinc-400">{c.reputation}</span> · cash{' '}
                    <span className="font-mono text-zinc-400">{c.cash.toLocaleString()}</span> · stadium id{' '}
                    <span className="font-mono text-zinc-400">{c.stadiumId}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        {!detail && <p className="text-sm text-zinc-500">Select a club for squad list and finances.</p>}
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
                <dt>Cash</dt>
                <dd className="font-mono text-zinc-200">{detail.cash.toLocaleString()}</dd>
                <dt>Stadium id</dt>
                <dd className="font-mono text-zinc-200">{detail.stadiumId}</dd>
                <dt>Attendance</dt>
                <dd className="font-mono text-zinc-200">{detail.attendance.toLocaleString()}</dd>
                <dt>Training (byte)</dt>
                <dd className="font-mono text-zinc-200">{detail.training}</dd>
              </dl>
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
