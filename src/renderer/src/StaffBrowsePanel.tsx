import { useCallback, useEffect, useRef, useState } from 'react'
import type { StaffBrowseFilter } from '../../main/staffBrowse'

export type StaffGridApiRow = {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  jobByte: number
  club: string
  nation: string
  determination: number
  score: number
  scoreDetail: string
  nonPlayerCa: number | null
}

type Props = {
  loadInfo: boolean
  filter: StaffBrowseFilter
  selectedStaffIndex: number | null
  onSelectStaff: (staffIndex: number) => void
  onOpenPlayerProfile: (staffIndex: number) => void
}

export function StaffBrowsePanel({
  loadInfo,
  filter,
  selectedStaffIndex,
  onSelectStaff,
  onOpenPlayerProfile,
}: Props) {
  const [rows, setRows] = useState<StaffGridApiRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const seqRef = useRef(0)

  const load = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.getStaffRows !== 'function') {
      setRows([])
      setTotal(0)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    setErr(null)
    try {
      const out = await window.cmapi.getStaffRows({
        ...filter,
        offset: 0,
        limit: 8000,
      })
      if (seq !== seqRef.current) return
      setRows((out.rows ?? []) as StaffGridApiRow[])
      setTotal(typeof out.total === 'number' ? out.total : 0)
    } catch (e) {
      if (seq !== seqRef.current) return
      setErr(e instanceof Error ? e.message : String(e))
      setRows([])
      setTotal(0)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, filter])

  useEffect(() => {
    void load()
  }, [load])

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse staff.</p>
  }

  return (
    <div className="space-y-3">
      {loading && <p className="text-xs text-zinc-500">Loading staff…</p>}
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <p className="text-[11px] text-zinc-500">
        Showing <span className="font-mono text-zinc-300">{rows.length}</span> of{' '}
        <span className="font-mono text-zinc-300">{total}</span> matching rows · use filters on the left
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-900/95">
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-2 py-2">Score</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Job</th>
              <th className="px-2 py-2">Club</th>
              <th className="px-2 py-2">Nation</th>
              <th className="px-2 py-2">Det</th>
              <th className="px-2 py-2">NPCA</th>
              <th className="px-2 py-2">Heuristic detail</th>
              <th className="px-2 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.staffIndex}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStaff(r.staffIndex)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectStaff(r.staffIndex)
                  }
                }}
                className={`cursor-pointer border-b border-zinc-800/60 hover:bg-zinc-800/30 ${
                  selectedStaffIndex === r.staffIndex ? 'bg-emerald-950/25' : ''
                }`}
              >
                <td className="px-2 py-1.5 font-mono text-emerald-200/90">{r.score}</td>
                <td className="px-2 py-1.5 font-medium text-zinc-200">{r.name}</td>
                <td className="px-2 py-1.5 text-zinc-400">{r.jobLabel}</td>
                <td className="max-w-[14rem] truncate px-2 py-1.5 text-zinc-400" title={r.club}>
                  {r.club}
                </td>
                <td className="max-w-[12rem] truncate px-2 py-1.5 text-zinc-500" title={r.nation}>
                  {r.nation}
                </td>
                <td className="px-2 py-1.5 font-mono text-zinc-400">{r.determination}</td>
                <td className="px-2 py-1.5 font-mono text-zinc-400">{r.nonPlayerCa ?? '—'}</td>
                <td className="max-w-xl px-2 py-1.5 text-[10px] text-zinc-500">{r.scoreDetail}</td>
                <td className="px-2 py-1.5">
                  {(r.jobByte === 11 ||
                    r.jobByte === 12 ||
                    r.jobByte === 13 ||
                    r.jobByte === 14 ||
                    r.jobByte === 15) && (
                    <button
                      type="button"
                      className="rounded border border-emerald-700/50 bg-emerald-950/40 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-900/50"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenPlayerProfile(r.staffIndex)
                      }}
                    >
                      Player profile
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
