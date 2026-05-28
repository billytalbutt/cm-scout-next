import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridPlayerRow } from '../../../shared/gridTypes'
import type { Shortlist, ShortlistKind } from '../../../shared/shortlistTypes'
import { SHORTLIST_PLS_MAX_PLAYERS } from '../../../shared/shortlistTypes'
import type { ShortlistsApi } from './useShortlists'

type Props = {
  loadInfo: boolean
  shortlists: ShortlistsApi
  onOpenPlayer: (staffIndex: number) => void
  onOpenStaff: (staffIndex: number) => void
  onPlayerNavOrderChange?: (staffIndices: number[]) => void
}

export function ShortlistsPanel({
  loadInfo,
  shortlists,
  onOpenPlayer,
  onOpenStaff,
  onPlayerNavOrderChange,
}: Props) {
  const [kind, setKind] = useState<ShortlistKind>('players')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playerRows, setPlayerRows] = useState<GridPlayerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

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

  const loadPlayerRows = useCallback(async (list: Shortlist) => {
    if (list.kind !== 'players' || !loadInfo) {
      setPlayerRows([])
      return
    }
    if (typeof window.cmapi?.getShortlistPlayerRows !== 'function') {
      setPlayerRows([])
      return
    }
    setLoading(true)
    try {
      const indices = list.entries.map((e) => e.staffIndex)
      const rows = await window.cmapi.getShortlistPlayerRows(indices)
      setPlayerRows(rows)
    } finally {
      setLoading(false)
    }
  }, [loadInfo])

  useEffect(() => {
    if (selected) void loadPlayerRows(selected)
  }, [selected, loadPlayerRows])

  useEffect(() => {
    if (selected?.kind === 'players') {
      onPlayerNavOrderChange?.(playerRows.map((r) => r.staffIndex))
    } else {
      onPlayerNavOrderChange?.([])
    }
  }, [playerRows, selected?.kind, onPlayerNavOrderChange])

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Shortlists</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Player lists export as CM Scout <span className="font-mono">.pls</span> for the game Search folder (max{' '}
          {SHORTLIST_PLS_MAX_PLAYERS} players). Lists are saved per save file on this PC (like club favourites). Staff
          lists can also export as JSON for reference.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`pill-tab ${kind === 'players' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
          onClick={() => setKind('players')}
        >
          Player shortlists
        </button>
        <button
          type="button"
          className={`pill-tab ${kind === 'staff' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
          onClick={() => setKind('staff')}
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
            {selected?.kind === 'players' && playerRows.length > 0 && (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Club</th>
                    <th className="px-2 py-2">CA</th>
                    <th className="px-2 py-2">PA</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((r) => (
                    <tr
                      key={r.staffIndex}
                      className="cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      onClick={() => onOpenPlayer(r.staffIndex)}
                    >
                      <td className="px-2 py-1.5 font-medium text-zinc-100">{r.name}</td>
                      <td className="px-2 py-1.5 text-zinc-400">{r.club}</td>
                      <td className="px-2 py-1.5 font-mono">{r.ca}</td>
                      <td className="px-2 py-1.5 font-mono">{r.pa}</td>
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
            {selected?.kind === 'staff' && selected.entries.length > 0 && (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Staff ID</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {selected.entries.map((e) => (
                    <tr
                      key={e.staffIndex}
                      className="cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      onClick={() => onOpenStaff(e.staffIndex)}
                    >
                      <td className="px-2 py-1.5 font-medium text-zinc-100">{e.name}</td>
                      <td className="px-2 py-1.5 font-mono text-zinc-500">{e.staffId}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="text-[10px] text-rose-300/90"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            shortlists.removeEntry(selected.id, e.staffIndex)
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
