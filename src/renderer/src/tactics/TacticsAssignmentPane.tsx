import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridPlayerRow } from '../../../shared/gridTypes'
import {
  LINEUP_GROUPS,
  slotsInLineupGroup,
  teamRatingFromAssignments,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../../shared/tacticsPitchSnap'
import { autoPickClubSquadLineup } from '../../../shared/tacticsAutoPick'
import {
  assignmentFromSquadRow,
  comparePlayersForSlot,
  rolePercentForSlot,
} from '../../../shared/tacticsLineupRating'
import { filterSquadRowsForPitchSlot } from '../../../shared/tacticsSquadFilter'

function SlotAssignRow({
  slot,
  assignment,
  loadInfo,
  clubSquadOnly,
  squadRows,
  onAssign,
  onClear,
}: {
  slot: PitchSlot
  assignment: TacticsPlayerAssignment | null | undefined
  loadInfo: boolean
  clubSquadOnly: boolean
  squadRows: GridPlayerRow[]
  onAssign: (slotId: string, a: TacticsPlayerAssignment | null) => void
  onClear: (slotId: string) => void
}) {
  const [q, setQ] = useState(assignment?.name ?? '')
  const [suggestions, setSuggestions] = useState<GridPlayerRow[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const blurRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    if (assignment?.name) setQ(assignment.name)
  }, [assignment?.name])

  const search = useCallback(
    async (text: string) => {
      if (!loadInfo || text.trim().length < 2 || typeof window.cmapi?.getRows !== 'function') {
        setSuggestions([])
        return
      }
      const seq = ++seqRef.current
      setLoading(true)
      try {
        const out = await window.cmapi.getRows({
          q: text.trim(),
          limit: 25,
          gridInclude: { role7: true },
        })
        if (seq !== seqRef.current) return
        setSuggestions((out.rows ?? []) as GridPlayerRow[])
      } catch {
        if (seq === seqRef.current) setSuggestions([])
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [loadInfo],
  )

  useEffect(() => {
    if (clubSquadOnly) return
    const t = window.setTimeout(() => {
      if (open && q.trim().length >= 2 && q !== assignment?.name) void search(q)
    }, 150)
    return () => window.clearTimeout(t)
  }, [q, open, search, assignment?.name, clubSquadOnly])

  const squadSorted = useMemo(() => {
    const role = slot.role
    let pool = clubSquadOnly ? filterSquadRowsForPitchSlot(squadRows, slot) : squadRows
    if (clubSquadOnly && assignment?.staffIndex != null) {
      const assigned = squadRows.find((p) => p.staffIndex === assignment.staffIndex)
      if (assigned && !pool.some((p) => p.staffIndex === assigned.staffIndex)) {
        pool = [assigned, ...pool]
      }
    }
    return [...pool].sort((a, b) => comparePlayersForSlot(a, b, role))
  }, [squadRows, slot, clubSquadOnly, assignment?.staffIndex])

  const posLabel = slot.role || '—'
  const pct = assignment?.rolePercent ?? assignment?.cmScoutBp
  const selectValue = assignment?.staffIndex != null ? String(assignment.staffIndex) : ''

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-1.5">
      <span className="font-mono text-[10px] font-semibold text-amber-200/90">{posLabel}</span>
      <div className="relative min-w-0">
        {clubSquadOnly ? (
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-600 disabled:opacity-50"
            value={selectValue}
            disabled={!loadInfo || squadRows.length === 0}
            onChange={(e) => {
              const v = e.target.value
              if (!v) {
                onClear(slot.id)
                return
              }
              const si = Number(v)
              const row = squadRows.find((p) => p.staffIndex === si)
              if (row) onAssign(slot.id, assignmentFromSquadRow(row, slot.role))
            }}
          >
            <option value="">
              {squadRows.length === 0
                ? 'No squad loaded'
                : squadSorted.length === 0
                  ? 'No players for this position'
                  : '— Pick player —'}
            </option>
            {squadSorted.map((p) => {
              const rp = rolePercentForSlot(p, slot.role)
              return (
                <option key={p.staffIndex} value={p.staffIndex}>
                  {p.name}
                  {rp != null ? ` · ${Math.round(rp)}%` : ''}
                  {` · CA ${p.ca}`}
                </option>
              )
            })}
          </select>
        ) : (
          <>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
              value={q}
              placeholder={loadInfo ? 'Search any player…' : 'Load database'}
              disabled={!loadInfo}
              onChange={(e) => {
                setQ(e.target.value)
                if (assignment && e.target.value !== assignment.name) onClear(slot.id)
              }}
              onFocus={() => {
                if (blurRef.current) window.clearTimeout(blurRef.current)
                setOpen(true)
              }}
              onBlur={() => {
                blurRef.current = window.setTimeout(() => setOpen(false), 160)
              }}
            />
            {open && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 z-20 mt-0.5 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 py-0.5 shadow-lg cm-scroll">
                {suggestions.map((p) => {
                  const rp = rolePercentForSlot(p, slot.role)
                  return (
                    <li key={p.staffIndex}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-2 py-1 text-left text-[11px] hover:bg-zinc-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onAssign(slot.id, assignmentFromSquadRow(p, slot.role))
                          setQ(p.name)
                          setOpen(false)
                        }}
                      >
                        <span className="text-zinc-100">{p.name}</span>
                        <span className="text-[10px] text-zinc-500">
                          {p.club} · {slot.role}
                          {rp != null && (
                            <span className="font-mono text-emerald-300/90"> {Math.round(rp)}%</span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {loading && (
              <span className="pointer-events-none absolute right-2 top-1 text-[10px] text-zinc-500">…</span>
            )}
          </>
        )}
      </div>
      <span className="text-right font-mono text-[10px] tabular-nums text-emerald-300/90">
        {pct != null ? `${Math.round(pct)}` : '—'}
      </span>
    </div>
  )
}

export function TacticsAssignmentPane({
  loadInfo,
  pitchSlots,
  assignments,
  seedClubId,
  seedClubName,
  onAssign,
  onClearSlot,
  onReplaceAssignments,
  onClearAll,
}: {
  loadInfo: boolean
  pitchSlots: PitchSlot[]
  assignments: Partial<Record<string, TacticsPlayerAssignment | null>>
  seedClubId: number | null
  seedClubName: string | null
  onAssign: (slotId: string, a: TacticsPlayerAssignment | null) => void
  onClearSlot: (slotId: string) => void
  onReplaceAssignments: (next: Partial<Record<string, TacticsPlayerAssignment | null>>) => void
  onClearAll: () => void
}) {
  const [clubSquadOnly, setClubSquadOnly] = useState(false)
  const [squadRows, setSquadRows] = useState<GridPlayerRow[]>([])
  const [squadLoading, setSquadLoading] = useState(false)
  const [worldPickBusy, setWorldPickBusy] = useState(false)
  const [worldPickMsg, setWorldPickMsg] = useState<string | null>(null)

  const teamRating = useMemo(
    () => teamRatingFromAssignments(pitchSlots, assignments),
    [pitchSlots, assignments],
  )

  useEffect(() => {
    if (!clubSquadOnly || seedClubId == null || !loadInfo) {
      setSquadRows([])
      return
    }
    if (typeof window.cmapi?.getClubSquadGridRows !== 'function') {
      setSquadRows([])
      return
    }
    let cancelled = false
    setSquadLoading(true)
    void window.cmapi.getClubSquadGridRows(seedClubId).then((rows) => {
      if (cancelled) return
      setSquadRows(rows)
      setSquadLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [clubSquadOnly, seedClubId, loadInfo])

  const clubOnlyReady = clubSquadOnly && seedClubId != null && squadRows.length > 0

  const handleAutoPick = useCallback(() => {
    if (!clubOnlyReady || squadRows.length === 0) return
    setWorldPickMsg(null)
    const picked = autoPickClubSquadLineup(pitchSlots, squadRows)
    const next: Partial<Record<string, TacticsPlayerAssignment | null>> = {}
    for (const slot of pitchSlots) {
      const a = picked[slot.id]
      if (a) next[slot.id] = a
    }
    onReplaceAssignments(next)
  }, [clubOnlyReady, squadRows, pitchSlots, onReplaceAssignments])

  const handleWorld11 = useCallback(async () => {
    if (!loadInfo || typeof window.cmapi?.pickWorldXi !== 'function') return
    setWorldPickBusy(true)
    setWorldPickMsg(null)
    try {
      const out = await window.cmapi.pickWorldXi(pitchSlots)
      if (out && typeof out === 'object' && 'ok' in out && out.ok && 'assignments' in out) {
        onReplaceAssignments(out.assignments as Partial<Record<string, TacticsPlayerAssignment | null>>)
        setWorldPickMsg(`World 11 — ${out.filled} positions filled from the entire save.`)
      } else if (out && typeof out === 'object' && 'error' in out) {
        setWorldPickMsg(String((out as { error: string }).error))
      }
    } catch (e) {
      setWorldPickMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setWorldPickBusy(false)
    }
  }, [loadInfo, pitchSlots, onReplaceAssignments])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Line-up</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
          Assign players by position. Club squad picks from your selected team;{' '}
          <span className="text-zinc-400">World 11</span> fills the tactic with the best player in each slot from the
          entire save.
        </p>
      </div>
      {!loadInfo && <p className="text-xs text-zinc-500">Load a database to search players.</p>}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={clubSquadOnly}
          onChange={(e) => setClubSquadOnly(e.target.checked)}
          disabled={!loadInfo}
        />
        <span className="text-[11px] leading-snug text-zinc-300">
          <span className="font-medium text-zinc-100">Club squad only</span>
          <span className="block text-zinc-500">
            {seedClubId != null && seedClubName
              ? `Dropdowns list ${seedClubName} (${squadLoading ? 'loading…' : `${squadRows.length} players`}).`
              : 'Pick a squad club on the tactics pitch panel first.'}
          </span>
        </span>
      </label>
      {clubSquadOnly && seedClubId == null && (
        <p className="text-[11px] text-amber-200/90">Select a club under Squad club on the tactics screen.</p>
      )}
      {loadInfo && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {clubSquadOnly && seedClubId != null && (
              <button
                type="button"
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!clubOnlyReady || squadLoading || worldPickBusy}
                onClick={handleAutoPick}
              >
                Auto pick best XI
              </button>
            )}
            <button
              type="button"
              title="Best CM Scout role % per slot across every club in the loaded save"
              className={`min-w-0 rounded-lg border border-sky-800/60 bg-sky-950/40 px-3 py-2 text-xs font-medium text-sky-100/95 transition hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                clubSquadOnly && seedClubId != null ? 'flex-1' : 'w-full sm:flex-1'
              }`}
              disabled={worldPickBusy || pitchSlots.length === 0}
              onClick={() => void handleWorld11()}
            >
              {worldPickBusy ? 'Building World 11…' : 'World 11'}
            </button>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
              disabled={!loadInfo || worldPickBusy}
              onClick={onClearAll}
            >
              Clear all
            </button>
          </div>
          {worldPickMsg && (
            <p className="text-[11px] leading-snug text-zinc-500">{worldPickMsg}</p>
          )}
        </div>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Team rating</div>
        <div className="font-mono text-2xl text-zinc-100">{teamRating != null ? teamRating : '—'}</div>
        <p className="text-[10px] text-zinc-500">Average of assigned players’ role % in their slot.</p>
      </div>
      <div className="space-y-3">
        {LINEUP_GROUPS.map((group) => {
          const groupSlots = slotsInLineupGroup(pitchSlots, group.id)
          if (groupSlots.length === 0) return null
          return (
            <section key={group.id}>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {group.label}
              </h3>
              <div className="space-y-1">
                {groupSlots.map((slot) => (
                  <SlotAssignRow
                    key={slot.id}
                    slot={slot}
                    assignment={assignments[slot.id]}
                    loadInfo={loadInfo && (!clubSquadOnly || clubOnlyReady || !squadLoading)}
                    clubSquadOnly={clubSquadOnly && seedClubId != null}
                    squadRows={squadRows}
                    onAssign={onAssign}
                    onClear={onClearSlot}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
