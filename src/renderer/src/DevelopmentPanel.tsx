import { useCallback, useEffect, useState } from 'react'
import type {
  DevelopmentRowsResponse,
  PlayerDevelopmentSummary,
} from '../../shared/playerDevelopmentTypes'

function formatDelta(n: number): string {
  if (n === 0) return '—'
  return n > 0 ? `+${n}` : String(n)
}

function deltaClass(n: number): string {
  if (n > 0) return 'text-zinc-300'
  if (n < 0) return 'text-zinc-400'
  return 'text-zinc-500'
}

type Props = {
  loadInfo: boolean
  regenBaseline: {
    active: boolean
    tracksDevelopment?: boolean
    savedAt?: string
    entryCount?: number
  } | null
  selectedStaffIndex: number | null
  onSelectPlayer: (staffIndex: number) => void
  onSaveSnapshot: () => void
  savingSnapshot: boolean
}

export function DevelopmentPanel({
  loadInfo,
  regenBaseline,
  selectedStaffIndex,
  onSelectPlayer,
  onSaveSnapshot,
  savingSnapshot,
}: Props) {
  const [data, setData] = useState<DevelopmentRowsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [onlyChanged, setOnlyChanged] = useState(true)
  const [sortBy, setSortBy] = useState<'net' | 'name' | 'ca' | 'gains'>('net')
  const [q, setQ] = useState('')
  const [club, setClub] = useState('')

  const fetchRows = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.getDevelopmentRows !== 'function') {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await window.cmapi.getDevelopmentRows({
        onlyChanged,
        sortBy,
        q: q.trim() || undefined,
        club: club.trim() || undefined,
        limit: 500,
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [loadInfo, onlyChanged, sortBy, q, club])

  useEffect(() => {
    const t = window.setTimeout(() => void fetchRows(), q || club ? 120 : 0)
    return () => window.clearTimeout(t)
  }, [fetchRows, q, club])

  const rows = data?.rows ?? []

  return (
    <div className="space-y-4 pb-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-snug text-zinc-500">
        <span className="font-medium text-zinc-300">Player development</span> — Compares each player&apos;s{' '}
        <strong className="font-normal text-zinc-400">in-game attributes (1–20)</strong> against the same display
        values stored in your regen snapshot. Take a snapshot early in a save (same workflow as regen tracking); reload
        the save later to see training gains, CA growth, and attribute drift. Re-save the snapshot to reset the
        baseline.
      </div>

      {!loadInfo && (
        <p className="text-sm text-zinc-500">Load a save to track development against a snapshot.</p>
      )}

      {loadInfo && data && !data.ready && data.reason === 'no_snapshot' && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          <p>No snapshot yet. Save one from the Regens tab (or below) while your squad is loaded — attributes are stored
            alongside regen fingerprints.</p>
          <button
            type="button"
            disabled={savingSnapshot}
            onClick={onSaveSnapshot}
            className="mt-3 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {savingSnapshot ? 'Saving snapshot…' : 'Save snapshot now'}
          </button>
        </div>
      )}

      {loadInfo && data && !data.ready && data.reason === 'legacy_snapshot' && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-snug text-zinc-500">
          <p>
            Your snapshot predates attribute tracking. Save a{' '}
            <span className="font-medium text-zinc-300">new snapshot</span> to capture current attributes — existing regen
            links are kept, but development comparison needs a fresh save.
          </p>
          <button
            type="button"
            disabled={savingSnapshot}
            onClick={onSaveSnapshot}
            className="mt-3 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {savingSnapshot ? 'Saving snapshot…' : 'Re-save snapshot with attributes'}
          </button>
        </div>
      )}

      {loadInfo && data?.ready && (
        <>
          {data.legacySnapshot && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[11px] leading-snug text-zinc-500">
              <span className="font-medium text-zinc-300">Legacy snapshot.</span> Stored raw disk values from an older
              Merlin version — comparisons are converted to in-game 1–20 display. Re-save the snapshot when you can for
              the most accurate baseline.
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="In snapshot" value={data.totals.inSnapshot.toLocaleString()} />
            <StatCard label="With changes" value={data.totals.withChanges.toLocaleString()} />
            <StatCard label="Attr improvements" value={data.totals.attrsImproved.toLocaleString()} sub="across squad" />
            <StatCard label="Attr declines" value={data.totals.attrsDeclined.toLocaleString()} sub="across squad" />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[10rem] flex-1">
              <span className="filter-field-label-sm">Player name</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter…"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              />
            </label>
            <label className="min-w-[10rem] flex-1">
              <span className="filter-field-label-sm">Club</span>
              <input
                type="search"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="Filter…"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              />
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
              />
              Only players with changes
            </label>
            <label>
              <span className="filter-field-label-sm">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value="net">Net attribute progress</option>
                <option value="gains">Most improvements</option>
                <option value="ca">CA growth</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {regenBaseline?.active && (
            <p className="text-[10px] text-zinc-600">
              Snapshot · {regenBaseline.entryCount?.toLocaleString() ?? '—'} players
              {regenBaseline.savedAt && (
                <>
                  {' '}
                  · {regenBaseline.savedAt.slice(0, 19).replace('T', ' ')}
                </>
              )}
              {data.snapshotGameDate && (
                <>
                  {' '}
                  · game date {data.snapshotGameDate.slice(0, 10)}
                </>
              )}
            </p>
          )}

          {loading && <p className="text-xs text-zinc-500">Updating development list…</p>}

          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <th className="hidden px-3 py-2 font-semibold sm:table-cell">Club</th>
                  <th className="px-3 py-2 font-semibold text-right">CA Δ</th>
                  <th className="px-3 py-2 font-semibold text-right">Net attrs</th>
                  <th className="hidden px-3 py-2 font-semibold md:table-cell">Top gains</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      No players match these filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <DevelopmentRow
                    key={r.staffId}
                    row={r}
                    selected={selectedStaffIndex === r.staffIndex}
                    onSelect={() => onSelectPlayer(r.staffIndex)}
                  />
                ))}
              </tbody>
            </table>
            {data.capped && (
              <p className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">
                Showing first {rows.length} of {data.total.toLocaleString()} — narrow filters to see more.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}

function DevelopmentRow({
  row,
  selected,
  onSelect,
}: {
  row: PlayerDevelopmentSummary
  selected: boolean
  onSelect: () => void
}) {
  const topGain = row.topGains[0]
  return (
    <tr
      className={`cursor-pointer border-b border-zinc-800/80 transition hover:bg-zinc-800/40 ${
        selected ? 'browse-list-row-selected' : ''
      }`}
      onClick={onSelect}
    >
      <td className="px-3 py-2 font-medium text-zinc-200">{row.name}</td>
      <td className="hidden px-3 py-2 text-zinc-500 sm:table-cell">{row.club}</td>
      <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(row.caDelta)}`}>
        {formatDelta(row.caDelta)}
      </td>
      <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(row.netAttrPoints)}`}>
        {formatDelta(row.netAttrPoints)}
        <span className="ml-1 text-[10px] text-zinc-600">
          ({row.attrsUp}↑ {row.attrsDown}↓)
        </span>
      </td>
      <td className="hidden px-3 py-2 text-zinc-500 md:table-cell">
        {topGain ? (
          <span>
            {topGain.label}{' '}
            <span className={topGain.improved ? 'text-zinc-300' : 'text-zinc-400'}>
              {topGain.delta > 0 ? '+' : ''}
              {topGain.delta}
            </span>
          </span>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}
