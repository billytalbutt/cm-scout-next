import { useEffect, useMemo, useState } from 'react'
import type { ClubDetailPayload, ClubDetailSquadRow, ClubDetailStaffRow } from '../ClubBrowsePanel'

type RosterTab = 'squad' | 'staff'
type SquadSortKey = 'name' | 'ca' | 'pa' | 'cmScout' | 'eff'
type StaffSortKey = 'name' | 'job' | 'score' | 'staffCa'

type SortState<K extends string> = { key: K; desc: boolean }

function toggleSort<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key === key) return { key, desc: !prev.desc }
  return { key, desc: key === 'name' ? false : true }
}

function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (key: K) => void
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        type="button"
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

function squadEffSortValue(p: ClubDetailSquadRow): number | null {
  if (p.effArchetype === 'Unsure' || p.effPercent == null) return null
  return p.effPercent
}

function formatSquadCmScout(p: ClubDetailSquadRow): string {
  return p.cmScoutRatingBp == null ? '—' : `${p.cmScoutRatingBp.toFixed(1)}%`
}

function formatSquadEff(p: ClubDetailSquadRow): string {
  if (!p.effArchetype) return '—'
  if (p.effArchetype === 'Unsure' || p.effPercent == null) return 'Unsure'
  return `${p.effPercent.toFixed(1)}% (${p.effArchetype})`
}

function compareSquad(a: ClubDetailSquadRow, b: ClubDetailSquadRow, sort: SortState<SquadSortKey>): number {
  const mul = sort.desc ? -1 : 1
  const num = (va: number | null | undefined, vb: number | null | undefined) => {
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return (va - vb) * mul
  }
  switch (sort.key) {
    case 'name':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * mul
    case 'ca':
      return (a.ca - b.ca) * mul || a.name.localeCompare(b.name)
    case 'pa':
      return (a.pa - b.pa) * mul || a.name.localeCompare(b.name)
    case 'cmScout':
      return num(a.cmScoutRatingBp, b.cmScoutRatingBp) || a.name.localeCompare(b.name)
    case 'eff':
      return num(squadEffSortValue(a), squadEffSortValue(b)) || a.name.localeCompare(b.name)
    default:
      return 0
  }
}

function compareStaff(a: ClubDetailStaffRow, b: ClubDetailStaffRow, sort: SortState<StaffSortKey>): number {
  const mul = sort.desc ? -1 : 1
  const num = (va: number | null, vb: number | null) => {
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return (va - vb) * mul
  }
  switch (sort.key) {
    case 'name':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * mul
    case 'job':
      return a.jobLabel.localeCompare(b.jobLabel, undefined, { sensitivity: 'base' }) * mul || a.name.localeCompare(b.name)
    case 'score':
      return num(a.score, b.score) || a.name.localeCompare(b.name)
    case 'staffCa':
      return num(a.staffCa, b.staffCa) || a.name.localeCompare(b.name)
    default:
      return 0
  }
}

type Props = {
  loadInfo: boolean
  detail: ClubDetailPayload | null
  selectedStaffIndex: number | null
  onOpenPlayerProfile: (staffIndex: number) => void
  onOpenStaffProfile: (staffIndex: number) => void
}

function RosterTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill-tab ${active ? 'pill-tab-active' : 'pill-tab-inactive'}`}
    >
      {label} <span className="font-mono tabular-nums text-[10px] opacity-90">({count})</span>
    </button>
  )
}

export function ClubDetailPane({
  loadInfo,
  detail,
  selectedStaffIndex,
  onOpenPlayerProfile,
  onOpenStaffProfile,
}: Props) {
  const [rosterTab, setRosterTab] = useState<RosterTab>('squad')
  const [squadSort, setSquadSort] = useState<SortState<SquadSortKey>>({ key: 'ca', desc: true })
  const [staffSort, setStaffSort] = useState<SortState<StaffSortKey>>({ key: 'score', desc: true })

  useEffect(() => {
    setRosterTab('squad')
    setSquadSort({ key: 'ca', desc: true })
    setStaffSort({ key: 'score', desc: true })
  }, [detail?.id])

  const staffList = detail?.staff ?? []

  const sortedSquad = useMemo(() => {
    if (!detail) return []
    return [...detail.squad].sort((a, b) => compareSquad(a, b, squadSort))
  }, [detail, squadSort])

  const sortedStaff = useMemo(() => {
    return [...staffList].sort((a, b) => compareStaff(a, b, staffSort))
  }, [staffList, staffSort])

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  if (!detail) {
    return (
      <p className="text-sm text-zinc-500">
        Pick a club from the search list on the left to view squad, staff, stadium, and club info here.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{detail.name}</h2>
        <p className="text-sm text-zinc-500">
          {detail.nation} · {detail.division}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-400 sm:grid-cols-3">
          <dt>Reputation</dt>
          <dd className="font-mono text-zinc-200">{detail.reputation}</dd>
          <dt>Club funds</dt>
          <dd className="font-mono text-zinc-200">{detail.cash.toLocaleString()}</dd>
          <dt>Attendance</dt>
          <dd className="font-mono text-zinc-200">{detail.attendance.toLocaleString()}</dd>
          <dt>Training facilities</dt>
          <dd className="font-mono text-zinc-200">
            {detail.training} <span className="text-zinc-500">/ 20</span>
          </dd>
        </dl>
        {detail.stadium && (
          <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Stadium</h3>
            <p className="font-medium text-zinc-200">{detail.stadium.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <dt>Capacity</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.capacity.toLocaleString()}</dd>
              <dt>Seating</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.seatingCapacity.toLocaleString()}</dd>
              <dt>Expansion cap.</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.expansionCapacity.toLocaleString()}</dd>
              <dt>Covered</dt>
              <dd className="text-zinc-200">{detail.stadium.covered ? 'Yes' : 'No'}</dd>
              <dt>Soil heating</dt>
              <dd className="text-zinc-200">{detail.stadium.underSoilHeating ? 'Yes' : 'No'}</dd>
            </dl>
          </div>
        )}
        {detail.xiNames && detail.xiNames.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Team selected (up to 11)
            </h3>
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <RosterTabButton
            active={rosterTab === 'squad'}
            label="Squad"
            count={detail.squad.length}
            onClick={() => setRosterTab('squad')}
          />
          <RosterTabButton
            active={rosterTab === 'staff'}
            label="Staff"
            count={staffList.length}
            onClick={() => setRosterTab('staff')}
          />
        </div>

        <div className="cm-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-800">
          {rosterTab === 'squad' ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <SortableTh
                    label="Player"
                    sortKey="name"
                    sort={squadSort}
                    onSort={(key) => setSquadSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="CA"
                    sortKey="ca"
                    sort={squadSort}
                    onSort={(key) => setSquadSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="PA"
                    sortKey="pa"
                    sort={squadSort}
                    onSort={(key) => setSquadSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="CM Scout %"
                    sortKey="cmScout"
                    sort={squadSort}
                    onSort={(key) => setSquadSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="Eff %"
                    sortKey="eff"
                    sort={squadSort}
                    onSort={(key) => setSquadSort((s) => toggleSort(s, key))}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedSquad.map((p) => (
                  <tr
                    key={p.staffIndex}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenPlayerProfile(p.staffIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenPlayerProfile(p.staffIndex)
                      }
                    }}
                    className={`cursor-pointer border-b border-zinc-800/50 transition ${
                      selectedStaffIndex === p.staffIndex
                        ? 'browse-list-row-selected'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    <td className="px-3 py-1.5 font-medium text-zinc-200">{p.name}</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-300">{p.ca}</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-300">{p.pa}</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-300">{formatSquadCmScout(p)}</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-300">{formatSquadEff(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <SortableTh
                    label="Name"
                    sortKey="name"
                    sort={staffSort}
                    onSort={(key) => setStaffSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="Job"
                    sortKey="job"
                    sort={staffSort}
                    onSort={(key) => setStaffSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="Score"
                    sortKey="score"
                    sort={staffSort}
                    onSort={(key) => setStaffSort((s) => toggleSort(s, key))}
                  />
                  <SortableTh
                    label="CA"
                    sortKey="staffCa"
                    sort={staffSort}
                    onSort={(key) => setStaffSort((s) => toggleSort(s, key))}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-zinc-500">
                      No backroom staff linked to this club in the save.
                    </td>
                  </tr>
                ) : (
                  sortedStaff.map((s) => (
                    <tr
                      key={s.staffIndex}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenStaffProfile(s.staffIndex)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpenStaffProfile(s.staffIndex)
                        }
                      }}
                      className={`cursor-pointer border-b border-zinc-800/50 transition hover:bg-zinc-800/40 ${
                        selectedStaffIndex === s.staffIndex ? 'bg-emerald-950/30' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 font-medium text-zinc-200">{s.name}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{s.jobLabel}</td>
                      <td className="px-3 py-1.5 font-mono text-emerald-200/90" title={s.scoreDetail}>
                        {s.score}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-zinc-300">{s.staffCa ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          {rosterTab === 'squad'
            ? 'Click a column header to sort. Click a player to open their profile on the right.'
            : 'Click a column header to sort. Click a staff member to open their backroom profile on the right.'}
        </p>
      </div>
    </div>
  )
}
