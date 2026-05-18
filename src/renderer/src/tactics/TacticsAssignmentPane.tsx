import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridPlayerRow } from '../../../shared/gridTypes'
import {
  cmScoutRoleIndexForPosition,
  LINEUP_GROUPS,
  slotsInLineupGroup,
  teamRatingFromAssignments,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../../shared/tacticsPitchSnap'

function rolePercentForPlayer(row: GridPlayerRow, role: string): number | null {
  const idx = cmScoutRoleIndexForPosition(role)
  const r7 = row.role7
  if (r7 && r7.length === 7 && Number.isFinite(r7[idx]!)) return r7[idx]!
  if (row.cmScoutRatingBp != null && Number.isFinite(row.cmScoutRatingBp)) return row.cmScoutRatingBp
  return null
}

function assignmentFromRow(row: GridPlayerRow, role: string): TacticsPlayerAssignment {
  return {
    staffIndex: row.staffIndex,
    name: row.name,
    rolePercent: rolePercentForPlayer(row, role),
    cmScoutBp: row.cmScoutRatingBp ?? null,
  }
}

function SlotAssignRow({
  slot,
  assignment,
  loadInfo,
  onAssign,
  onClear,
}: {
  slot: PitchSlot
  assignment: TacticsPlayerAssignment | null | undefined
  loadInfo: boolean
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
    const t = window.setTimeout(() => {
      if (open && q.trim().length >= 2 && q !== assignment?.name) void search(q)
    }, 150)
    return () => window.clearTimeout(t)
  }, [q, open, search, assignment?.name])

  const posLabel = slot.role || '—'
  const pct = assignment?.rolePercent ?? assignment?.cmScoutBp

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-1.5">
      <span className="font-mono text-[10px] font-semibold text-amber-200/90">{posLabel}</span>
      <div className="relative min-w-0">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
          value={q}
          placeholder={loadInfo ? 'Search player…' : 'Load database'}
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
              const rp = rolePercentForPlayer(p, slot.role)
              return (
                <li key={p.staffIndex}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-2 py-1 text-left text-[11px] hover:bg-zinc-800"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onAssign(slot.id, assignmentFromRow(p, slot.role))
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
        {loading && <span className="pointer-events-none absolute right-2 top-1 text-[10px] text-zinc-500">…</span>}
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
  onAssign,
  onClearSlot,
}: {
  loadInfo: boolean
  pitchSlots: PitchSlot[]
  assignments: Partial<Record<string, TacticsPlayerAssignment | null>>
  onAssign: (slotId: string, a: TacticsPlayerAssignment | null) => void
  onClearSlot: (slotId: string) => void
}) {
  const teamRating = useMemo(
    () => teamRatingFromAssignments(pitchSlots, assignments),
    [pitchSlots, assignments],
  )

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Line-up</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
          Top to bottom: goalkeeper, defenders, midfielders, attackers (pitch still has GK at the bottom). Search and
          assign any player; ratings use CM Scout % for that role.
        </p>
      </div>
      {!loadInfo && <p className="text-xs text-zinc-500">Load a database to search players.</p>}
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/90">Team rating</div>
        <div className="font-mono text-2xl text-emerald-100">{teamRating != null ? teamRating : '—'}</div>
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
                    loadInfo={loadInfo}
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
