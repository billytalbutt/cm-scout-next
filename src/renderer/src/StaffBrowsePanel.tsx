import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type { StaffBrowseFilter } from '../../main/staffBrowse'

export type StaffGridApiRow = {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  jobByte: number
  club: string
  nation: string
  reputationCurrent: number | null
  determination: number
  score: number
  scoreDetail: string
  nonPlayerCa: number | null
}

type StaffSortKey =
  | 'score'
  | 'name'
  | 'job'
  | 'club'
  | 'nation'
  | 'reputation'
  | 'determination'
  | 'coachingCa'

type SortState = { key: StaffSortKey; desc: boolean }

function compareStaffRows(a: StaffGridApiRow, b: StaffGridApiRow, sort: SortState): number {
  const { key, desc } = sort
  const mul = desc ? -1 : 1

  const num = (va: number | null, vb: number | null): number => {
    const aNull = va == null
    const bNull = vb == null
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    return (va - vb) * mul
  }

  const str = (va: string, vb: string) => va.localeCompare(vb, undefined, { sensitivity: 'base' }) * mul

  switch (key) {
    case 'score':
      return num(a.score, b.score) || str(a.name, b.name)
    case 'name':
      return str(a.name, b.name)
    case 'job':
      return str(a.jobLabel, b.jobLabel) || str(a.name, b.name)
    case 'club':
      return str(a.club, b.club) || str(a.name, b.name)
    case 'nation':
      return str(a.nation, b.nation) || str(a.name, b.name)
    case 'reputation':
      return num(a.reputationCurrent, b.reputationCurrent) || str(a.name, b.name)
    case 'determination':
      return num(a.determination, b.determination) || str(a.name, b.name)
    case 'coachingCa':
      return num(a.nonPlayerCa, b.nonPlayerCa) || str(a.name, b.name)
    default:
      return 0
  }
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
  title,
}: {
  label: string
  sortKey: StaffSortKey
  sort: SortState
  onSort: (key: StaffSortKey) => void
  className?: string
  title?: string
}) {
  const active = sort.key === sortKey
  return (
    <th className={`bg-zinc-950 px-2 py-2 ${className}`}>
      <button
        type="button"
        title={title}
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-normal transition hover:text-zinc-200 ${
          active ? 'text-emerald-200/90' : 'text-zinc-500'
        }`}
      >
        {label}
        <span className="font-mono text-[10px] text-zinc-600" aria-hidden>
          {active ? (sort.desc ? '▼' : '▲') : '↕'}
        </span>
      </button>
    </th>
  )
}

type Props = {
  loadInfo: boolean
  filter: StaffBrowseFilter
  selectedStaffIndex: number | null
  onSelectStaff: (staffIndex: number) => void
  onOpenPlayerProfile: (staffIndex: number) => void
  onRowContextMenu?: (e: ReactMouseEvent, row: StaffGridApiRow) => void
}

export function StaffBrowsePanel({
  loadInfo,
  filter,
  selectedStaffIndex,
  onSelectStaff,
  onOpenPlayerProfile,
  onRowContextMenu,
}: Props) {
  const [rows, setRows] = useState<StaffGridApiRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'score', desc: true })
  const seqRef = useRef(0)

  const onSort = useCallback((key: StaffSortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== 'name' && key !== 'job' && key !== 'club' && key !== 'nation' },
    )
  }, [])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => compareStaffRows(a, b, sort))
    return copy
  }, [rows, sort])

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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {loading && <p className="shrink-0 text-xs text-zinc-500">Loading staff…</p>}
      {err && <p className="shrink-0 text-xs text-rose-300">{err}</p>}
      <div className="cm-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[48rem] border-collapse text-left text-xs">
          <thead className="cm-grid-sticky-head">
            <tr className="border-b border-zinc-800/80 text-zinc-500">
              <th colSpan={9} className="bg-zinc-950 px-2 py-2 text-left text-[11px] font-normal text-zinc-500">
                Showing <span className="font-mono text-zinc-300">{rows.length}</span> of{' '}
                <span className="font-mono text-zinc-300">{total}</span> matching rows · click a column header to sort
              </th>
            </tr>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <SortableTh label="Score" sortKey="score" sort={sort} onSort={onSort} />
              <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
              <SortableTh label="Job" sortKey="job" sort={sort} onSort={onSort} />
              <SortableTh label="Club" sortKey="club" sort={sort} onSort={onSort} />
              <SortableTh label="Nation" sortKey="nation" sort={sort} onSort={onSort} />
              <SortableTh label="Reputation" sortKey="reputation" sort={sort} onSort={onSort} />
              <SortableTh label="Det" sortKey="determination" sort={sort} onSort={onSort} />
              <SortableTh
                label="Coaching CA"
                sortKey="coachingCa"
                sort={sort}
                onSort={onSort}
                title="Backroom current ability from nonplayer.dat (coaches, scouts, physios)"
              />
              <th className="bg-zinc-950 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={r.staffIndex}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStaff(r.staffIndex)}
                onContextMenu={(e) => onRowContextMenu?.(e, r)}
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
                <td className="px-2 py-1.5 font-mono text-zinc-300">
                  {r.reputationCurrent != null ? r.reputationCurrent.toLocaleString() : '—'}
                </td>
                <td className="px-2 py-1.5 font-mono text-zinc-400">{r.determination}</td>
                <td className="px-2 py-1.5 font-mono text-zinc-400">{r.nonPlayerCa ?? '—'}</td>
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
