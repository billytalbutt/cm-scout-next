import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridPlayerRow } from '../../../shared/gridTypes'
import type { Shortlist, ShortlistKind } from '../../../shared/shortlistTypes'
import { SHORTLIST_PLS_MAX_PLAYERS } from '../../../shared/shortlistTypes'
import type { StaffBrowseFilter } from '../../../main/staffBrowse'
import type { ShortlistsApi } from './useShortlists'

type StaffGridApiRow = {
  staffIndex: number
  staffId: number
  name: string
  jobLabel: string
  club: string
  nation: string
  reputationLabel: string
  determination: number
  score: number
  staffCa: number | null
  staffPa: number | null
}

type PlayerSortKey = 'name' | 'club' | 'ca' | 'pa' | 'scout' | 'eff'
type StaffSortKey = 'name' | 'job' | 'club' | 'nation' | 'score' | 'staffCa' | 'staffPa'
type SortState<K extends string> = { key: K; desc: boolean }

function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
  title,
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (key: K) => void
  className?: string
  title?: string
}) {
  const active = sort.key === sortKey
  return (
    <th className={`bg-zinc-900/95 px-2 py-2 ${className}`}>
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

function comparePlayerRows(a: GridPlayerRow, b: GridPlayerRow, sort: SortState<PlayerSortKey>): number {
  const mul = sort.desc ? -1 : 1
  const str = (va: string, vb: string) => va.localeCompare(vb, undefined, { sensitivity: 'base' }) * mul
  const num = (va: number | null | undefined, vb: number | null | undefined): number => {
    const aNull = va == null
    const bNull = vb == null
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    return (va - vb) * mul
  }
  switch (sort.key) {
    case 'name':
      return str(a.name, b.name)
    case 'club':
      return str(a.club, b.club) || str(a.name, b.name)
    case 'ca':
      return num(a.ca, b.ca) || str(a.name, b.name)
    case 'pa':
      return num(a.pa, b.pa) || str(a.name, b.name)
    case 'scout':
      return num(a.cmScoutRatingBp, b.cmScoutRatingBp) || str(a.name, b.name)
    case 'eff':
      return num(a.effPercent, b.effPercent) || str(a.name, b.name)
    default:
      return 0
  }
}

function compareStaffRows(a: StaffGridApiRow, b: StaffGridApiRow, sort: SortState<StaffSortKey>): number {
  const mul = sort.desc ? -1 : 1
  const str = (va: string, vb: string) => va.localeCompare(vb, undefined, { sensitivity: 'base' }) * mul
  const num = (va: number | null, vb: number | null): number => {
    const aNull = va == null
    const bNull = vb == null
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    return (va - vb) * mul
  }
  switch (sort.key) {
    case 'name':
      return str(a.name, b.name)
    case 'job':
      return str(a.jobLabel, b.jobLabel) || str(a.name, b.name)
    case 'club':
      return str(a.club, b.club) || str(a.name, b.name)
    case 'nation':
      return str(a.nation, b.nation) || str(a.name, b.name)
    case 'score':
      return num(a.score, b.score) || str(a.name, b.name)
    case 'staffCa':
      return num(a.staffCa, b.staffCa) || str(a.name, b.name)
    case 'staffPa':
      return num(a.staffPa, b.staffPa) || str(a.name, b.name)
    default:
      return 0
  }
}

function scoutCell(r: GridPlayerRow): string {
  return r.cmScoutRatingBp == null ? '—' : `${r.cmScoutRatingBp.toFixed(1)}%`
}

function effCell(r: GridPlayerRow): string {
  if (r.effArchetype === 'Unsure' || r.effPercent == null) return 'Unsure'
  return `${r.effPercent.toFixed(1)}%`
}

type Props = {
  loadInfo: boolean
  shortlists: ShortlistsApi
  kind: ShortlistKind
  onKindChange: (kind: ShortlistKind) => void
  playerFilter: Record<string, unknown>
  staffFilter: StaffBrowseFilter
  onOpenPlayer: (staffIndex: number) => void
  onOpenStaff: (staffIndex: number) => void
  onPlayerNavOrderChange?: (staffIndices: number[]) => void
}

export function ShortlistsPanel({
  loadInfo,
  shortlists,
  kind,
  onKindChange,
  playerFilter,
  staffFilter,
  onOpenPlayer,
  onOpenStaff,
  onPlayerNavOrderChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playerRows, setPlayerRows] = useState<GridPlayerRow[]>([])
  const [staffRows, setStaffRows] = useState<StaffGridApiRow[]>([])
  const [listEntryCount, setListEntryCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [playerSort, setPlayerSort] = useState<SortState<PlayerSortKey>>({ key: 'name', desc: false })
  const [staffSort, setStaffSort] = useState<SortState<StaffSortKey>>({ key: 'name', desc: false })

  const lists = useMemo(() => shortlists.listsForKind(kind), [shortlists, kind])
  const selected: Shortlist | undefined = lists.find((l) => l.id === selectedId) ?? lists[0]

  useEffect(() => {
    if (!lists.some((l) => l.id === selectedId)) {
      setSelectedId(lists[0]?.id ?? null)
    }
  }, [lists, selectedId])

  useEffect(() => {
    if (selected) setRenameDraft(selected.name)
  }, [selected?.id, selected?.name])

  const onPlayerSort = useCallback((key: PlayerSortKey) => {
    setPlayerSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: key === 'name' ? false : true },
    )
  }, [])

  const onStaffSort = useCallback((key: StaffSortKey) => {
    setStaffSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: key === 'name' ? false : true },
    )
  }, [])

  const sortedPlayerRows = useMemo(() => {
    const copy = [...playerRows]
    copy.sort((a, b) => comparePlayerRows(a, b, playerSort))
    return copy
  }, [playerRows, playerSort])

  const sortedStaffRows = useMemo(() => {
    const copy = [...staffRows]
    copy.sort((a, b) => compareStaffRows(a, b, staffSort))
    return copy
  }, [staffRows, staffSort])

  const loadPlayerRows = useCallback(async (list: Shortlist) => {
    if (list.kind !== 'players' || !loadInfo) {
      setPlayerRows([])
      setListEntryCount(0)
      return
    }
    if (typeof window.cmapi?.getShortlistPlayerRows !== 'function') {
      setPlayerRows([])
      setListEntryCount(list.entries.length)
      return
    }
    setLoading(true)
    try {
      const indices = list.entries.map((e) => e.staffIndex)
      setListEntryCount(indices.length)
      const rows = await window.cmapi.getShortlistPlayerRows({
        staffIndices: indices,
        filter: playerFilter,
      })
      setPlayerRows(rows)
    } finally {
      setLoading(false)
    }
  }, [loadInfo, playerFilter])

  const loadStaffRows = useCallback(async (list: Shortlist) => {
    if (list.kind !== 'staff' || !loadInfo) {
      setStaffRows([])
      setListEntryCount(0)
      return
    }
    if (typeof window.cmapi?.getShortlistStaffRows !== 'function') {
      setStaffRows([])
      setListEntryCount(list.entries.length)
      return
    }
    setLoading(true)
    try {
      const indices = list.entries.map((e) => e.staffIndex)
      setListEntryCount(indices.length)
      const rows = await window.cmapi.getShortlistStaffRows({
        staffIndices: indices,
        filter: staffFilter,
      })
      setStaffRows(rows as StaffGridApiRow[])
    } finally {
      setLoading(false)
    }
  }, [loadInfo, staffFilter])

  useEffect(() => {
    if (!selected) return
    if (selected.kind === 'players') void loadPlayerRows(selected)
    else void loadStaffRows(selected)
  }, [selected, loadPlayerRows, loadStaffRows, selected?.entries])

  useEffect(() => {
    if (selected?.kind === 'players') {
      onPlayerNavOrderChange?.(sortedPlayerRows.map((r) => r.staffIndex))
    } else {
      onPlayerNavOrderChange?.([])
    }
  }, [sortedPlayerRows, selected?.kind, onPlayerNavOrderChange])

  const exportList = async () => {
    if (!selected) return
    setExportMsg(null)
    if (selected.kind === 'players') {
      const r = await window.cmapi.exportShortlistPls({
        staffIndices: selected.entries.map((e) => e.staffIndex),
        defaultName: selected.name,
      })
      if (r.ok) setExportMsg(`Saved ${r.count} players to ${r.path}`)
      else if (r.error !== 'cancelled') setExportMsg(r.error)
    } else {
      const json = JSON.stringify(
        {
          name: selected.name,
          kind: 'staff',
          exportedAt: new Date().toISOString(),
          entries: selected.entries,
        },
        null,
        2,
      )
      const r = await window.cmapi.exportShortlistJson({ json, defaultName: selected.name })
      if (r.ok) setExportMsg(`Saved to ${r.path} (reference only — CM0102 has no staff shortlist import).`)
      else if (r.error !== 'cancelled') setExportMsg(r.error)
    }
  }

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to use shortlists.</p>
  }

  const filteredCount = selected?.kind === 'players' ? sortedPlayerRows.length : sortedStaffRows.length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Shortlists</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Player lists export as CM Scout <span className="font-mono">.pls</span> for the game Search folder (max{' '}
          {SHORTLIST_PLS_MAX_PLAYERS} players). Lists are saved per save file on this PC (like club favourites). Staff
          lists can also export as JSON for reference. Left-hand filters apply to the table below.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`pill-tab ${kind === 'players' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
          onClick={() => onKindChange('players')}
        >
          Player shortlists
        </button>
        <button
          type="button"
          className={`pill-tab ${kind === 'staff' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
          onClick={() => onKindChange('staff')}
        >
          Staff shortlists
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          onClick={() => {
            const list = shortlists.createList(kind)
            setSelectedId(list.id)
          }}
        >
          New list
        </button>
      </div>

      {lists.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No {kind === 'players' ? 'player' : 'staff'} shortlists yet. Right-click someone in the grid or use Add to
          shortlist on their profile.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="shrink-0 space-y-2 lg:w-52">
            <label className="block text-[10px] font-medium uppercase text-zinc-500">Lists</label>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.entries.length})
                </option>
              ))}
            </select>
            {selected && (
              <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900/40 p-2">
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => {
                    if (renameDraft.trim() && renameDraft !== selected.name) {
                      shortlists.renameList(selected.id, renameDraft)
                    }
                  }}
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                    onClick={() => void exportList()}
                  >
                    Export {selected.kind === 'players' ? '.pls' : 'JSON'}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
                    onClick={() => {
                      shortlists.removeList(selected.id)
                    }}
                  >
                    Delete list
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800">
            {loading && <p className="p-3 text-xs text-zinc-500">Loading…</p>}
            {!loading && selected && selected.entries.length === 0 && (
              <p className="p-3 text-sm text-zinc-500">This list is empty.</p>
            )}
            {!loading && selected && selected.entries.length > 0 && filteredCount === 0 && (
              <p className="p-3 text-sm text-zinc-500">
                No one in this list matches the current filters ({listEntryCount} on list).
              </p>
            )}
            {!loading && selected?.kind === 'players' && sortedPlayerRows.length > 0 && (
              <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th colSpan={8} className="px-2 py-2 text-left text-[11px] font-normal text-zinc-500">
                      Showing <span className="font-mono text-zinc-300">{sortedPlayerRows.length}</span> of{' '}
                      <span className="font-mono text-zinc-300">{listEntryCount}</span> on list · click a column to sort
                    </th>
                  </tr>
                  <tr className="border-b border-zinc-800">
                    <SortableTh label="Name" sortKey="name" sort={playerSort} onSort={onPlayerSort} />
                    <SortableTh label="Club" sortKey="club" sort={playerSort} onSort={onPlayerSort} />
                    <SortableTh label="CA" sortKey="ca" sort={playerSort} onSort={onPlayerSort} />
                    <SortableTh label="PA" sortKey="pa" sort={playerSort} onSort={onPlayerSort} />
                    <SortableTh
                      label="Scout %"
                      sortKey="scout"
                      sort={playerSort}
                      onSort={onPlayerSort}
                      title="CM Scout rating %"
                    />
                    <SortableTh
                      label="Eff %"
                      sortKey="eff"
                      sort={playerSort}
                      onSort={onPlayerSort}
                      title="Effectiveness % (winning archetype recipe)"
                    />
                    <th className="bg-zinc-900/95 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayerRows.map((r) => (
                    <tr
                      key={r.staffIndex}
                      className="cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      onClick={() => onOpenPlayer(r.staffIndex)}
                    >
                      <td className="px-2 py-1.5 font-medium text-zinc-100">{r.name}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{r.club}</td>
                      <td className="px-2 py-1.5 font-mono">{r.ca}</td>
                      <td className="px-2 py-1.5 font-mono">{r.pa}</td>
                      <td className="px-2 py-1.5 font-mono text-sky-200/90">{scoutCell(r)}</td>
                      <td className="px-2 py-1.5 font-mono text-emerald-200/90">{effCell(r)}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-[10px] text-rose-300/90"
                          onClick={(e) => {
                            e.stopPropagation()
                            shortlists.removeEntry(selected.id, r.staffIndex)
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && selected?.kind === 'staff' && sortedStaffRows.length > 0 && (
              <table className="w-full min-w-[52rem] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th colSpan={9} className="px-2 py-2 text-left text-[11px] font-normal text-zinc-500">
                      Showing <span className="font-mono text-zinc-300">{sortedStaffRows.length}</span> of{' '}
                      <span className="font-mono text-zinc-300">{listEntryCount}</span> on list · click a column to sort
                    </th>
                  </tr>
                  <tr className="border-b border-zinc-800">
                    <SortableTh label="Score" sortKey="score" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Name" sortKey="name" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Job" sortKey="job" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Club" sortKey="club" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Nation" sortKey="nation" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Staff CA" sortKey="staffCa" sort={staffSort} onSort={onStaffSort} />
                    <SortableTh label="Staff PA" sortKey="staffPa" sort={staffSort} onSort={onStaffSort} />
                    <th className="bg-zinc-900/95 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sortedStaffRows.map((r) => (
                    <tr
                      key={r.staffIndex}
                      className="cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      onClick={() => onOpenStaff(r.staffIndex)}
                    >
                      <td className="px-2 py-1.5 font-mono text-zinc-300">{r.score}</td>
                      <td className="px-2 py-1.5 font-medium text-zinc-100">{r.name}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{r.jobLabel}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{r.club}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{r.nation}</td>
                      <td className="px-2 py-1.5 font-mono">{r.staffCa ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{r.staffPa ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-[10px] text-rose-300/90"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            shortlists.removeEntry(selected.id, r.staffIndex)
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {exportMsg && <p className="text-[11px] text-zinc-400">{exportMsg}</p>}
    </div>
  )
}
