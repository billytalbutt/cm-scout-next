import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  pitchSlotsFromPreset,
  snapAndRedistributePitch,
  TACTICAL_ROWS,
  teamRatingFromAssignments,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../shared/tacticsPitchSnap'
import { clearSavedTacticsLayout, saveTacticsLayout } from './tactics/tacticsLayoutStorage'
import {
  TACTIC_PRESETS,
  type TacticArrow,
  type TacticPresetId,
} from '../../shared/tacticsCommunityPresets'
import { TacticsClubPicker } from './tactics/TacticsClubPicker'

type Mentality = 'defensive' | 'normal' | 'attacking'
type PassingStyle = 'short' | 'mixed' | 'direct' | 'long'
type TacklingStyle = 'normal' | 'hard'

function nextArrow(a: TacticArrow): TacticArrow {
  if (a === 'none') return 'forward'
  if (a === 'forward') return 'back'
  return 'none'
}

function tacticBenchmarkScore(args: {
  presetId: TacticPresetId
  pressing: boolean
  passing: PassingStyle
  mentality: Mentality
  offside: boolean
  tackling: TacklingStyle
  forwardArrows: number
  lineupRating: number | null
}): number {
  let s = 42
  if (args.mentality === 'attacking') s += 8
  if (args.mentality === 'defensive') s += 2
  if (args.passing === 'short') s += 5
  if (args.passing === 'mixed') s += 3
  if (args.passing === 'direct') s += 6
  if (args.passing === 'long') s += 4
  if (args.pressing) s += 7
  if (args.offside) s += 2
  if (args.tackling === 'hard') s -= 4
  s += Math.min(9, args.forwardArrows * 2)
  if (args.lineupRating != null) s = Math.round(s * 0.45 + args.lineupRating * 0.55)
  if (args.presetId === '4132_press_short' && args.pressing && args.passing === 'short' && args.mentality === 'attacking')
    s += 14
  if (args.presetId === '442_narrow') s += 7
  if (args.presetId === '352_wb') s += 6
  if (args.presetId === '4321_tree' && args.passing === 'short') s += 5
  if (args.presetId === '4231_shadow') s += 4
  return Math.min(99, Math.max(30, s))
}

export function TacticsLabPanel({
  loadInfo,
  dbPath,
  tacticsSeedClubId,
  tacticsSeedClubName,
  onTacticsSeedClubChange,
  clubsTabHasSelection,
  tacticsClearNotice,
  onClearTacticsSquadClub,
  pitchSlots,
  onPitchSlotsChange,
  assignments,
}: {
  loadInfo: boolean
  dbPath?: string | null
  tacticsSeedClubId: number | null
  tacticsSeedClubName: string | null
  onTacticsSeedClubChange: (clubId: number | null, clubName: string | null) => void
  clubsTabHasSelection: boolean
  tacticsClearNotice: string | null
  onClearTacticsSquadClub: () => void
  pitchSlots: PitchSlot[]
  onPitchSlotsChange: (slots: PitchSlot[]) => void
  assignments: Partial<Record<string, TacticsPlayerAssignment | null>>
}) {
  const [preset, setPreset] = useState<TacticPresetId>('4132_press_short')
  const [pressing, setPressing] = useState(true)
  const [passing, setPassing] = useState<PassingStyle>('short')
  const [mentality, setMentality] = useState<Mentality>('attacking')
  const [offside, setOffside] = useState(false)
  const [tackling, setTackling] = useState<TacklingStyle>('normal')
  const [layoutMsg, setLayoutMsg] = useState<string | null>(null)
  const p = useMemo(() => TACTIC_PRESETS.find((x) => x.id === preset)!, [preset])
  const forwardArrows = useMemo(() => pitchSlots.filter((z) => z.arrow === 'forward').length, [pitchSlots])
  const lineupRating = useMemo(
    () => teamRatingFromAssignments(pitchSlots, assignments),
    [pitchSlots, assignments],
  )

  const score = useMemo(
    () =>
      tacticBenchmarkScore({
        presetId: preset,
        pressing,
        passing,
        mentality,
        offside,
        tackling,
        forwardArrows,
        lineupRating,
      }),
    [preset, pressing, passing, mentality, offside, tackling, forwardArrows, lineupRating],
  )

  const pitchRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)

  const onPresetChange = (id: TacticPresetId) => {
    setPreset(id)
    const next = TACTIC_PRESETS.find((x) => x.id === id)!
    onPitchSlotsChange(pitchSlotsFromPreset(next))
  }

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current
      const el = pitchRef.current
      if (!d || !el) return
      const r = el.getBoundingClientRect()
      const centerPxX = e.clientX - d.dx
      const centerPxY = e.clientY - d.dy
      const nx = Math.min(0.94, Math.max(0.06, (centerPxX - r.left) / r.width))
      const fracFromTop = (centerPxY - r.top) / r.height
      const ny = Math.min(0.92, Math.max(0.04, 1 - fracFromTop))
      onPitchSlotsChange((prev) => prev.map((s) => (s.id === d.id ? { ...s, x: nx, y: ny } : s)))
    },
    [onPitchSlotsChange],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    onPitchSlotsChange((prev) => snapAndRedistributePitch(prev))
  }, [onPointerMove, onPitchSlotsChange])

  const onSlotPointerDown = (e: React.PointerEvent, slot: PitchSlot) => {
    if (e.button !== 0) return
    const el = pitchRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + slot.x * r.width
    const cy = r.top + (1 - slot.y) * r.height
    dragRef.current = { id: slot.id, dx: e.clientX - cx, dy: e.clientY - cy }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [onPointerMove, endDrag])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-snug text-zinc-500">
        <span className="font-medium text-zinc-300">Tactics Lab</span> — Drag icons between the seven tactical lines
        (GK, sweeper, defence, DM, midfield, AM, forward). They snap to that line, space evenly (up to five per line, one
        GK only), and the badge updates to the CM role for that row (e.g. AMC → MC on the midfield line). Right-click for
        forward / backward arrows. Save your layout per save file.
      </div>
      {loadInfo && (
        <TacticsClubPicker
          loadInfo={loadInfo}
          clubId={tacticsSeedClubId}
          clubName={tacticsSeedClubName}
          clubsTabHasSelection={clubsTabHasSelection}
          clearNotice={tacticsClearNotice}
          onSelect={onTacticsSeedClubChange}
          onClearSquadClub={onClearTacticsSquadClub}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div
            ref={pitchRef}
            className="relative mx-auto aspect-[68/105] max-h-[min(52vh,520px)] w-full max-w-md touch-none rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-inner shadow-black/40"
          >
            <div className="pointer-events-none absolute inset-2 rounded-md border border-zinc-800/60 opacity-40" />
            {TACTICAL_ROWS.map((row) => (
              <div
                key={row.id}
                className="pointer-events-none absolute left-[6%] right-[6%] border-t border-dashed border-zinc-700/50"
                style={{ top: `${(1 - row.y) * 100}%` }}
                title={row.label}
              />
            ))}
            {pitchSlots.map((slot) => {
              const a = assignments[slot.id]
              const shortName = a?.name?.split(' ').pop()
              const rating = a?.rolePercent ?? a?.cmScoutBp
              return (
                <button
                  key={slot.id}
                  type="button"
                  title={`${slot.role}${a?.name ? ` — ${a.name}` : ''}${rating != null ? ` · ${Math.round(rating)}%` : ''} — drag · right-click arrow`}
                  className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none flex-col items-center justify-center rounded-full border border-emerald-600/60 bg-emerald-950/85 text-[9px] font-semibold text-emerald-100 shadow hover:bg-emerald-900/90 active:cursor-grabbing"
                  style={{ left: `${slot.x * 100}%`, top: `${(1 - slot.y) * 100}%` }}
                  onPointerDown={(e) => onSlotPointerDown(e, slot)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onPitchSlotsChange((prev) =>
                      prev.map((s) => (s.id === slot.id ? { ...s, arrow: nextArrow(s.arrow) } : s)),
                    )
                  }}
                >
                  <span className="leading-none">{slot.role.slice(0, 2)}</span>
                  {slot.arrow === 'forward' && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] leading-none text-sky-300">
                      ▲
                    </span>
                  )}
                  {slot.arrow === 'back' && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] leading-none text-amber-300">
                      ▼
                    </span>
                  )}
                  {shortName && (
                    <span className="pointer-events-none absolute -bottom-3.5 max-w-[3rem] truncate text-[7px] font-normal text-zinc-300">
                      {shortName}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Release drag to snap to the nearest line. Lineup avg:{' '}
            <span className="font-mono text-emerald-300/90">{lineupRating ?? '—'}</span>
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={!dbPath}
              className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-40"
              onClick={() => {
                if (!dbPath) return
                const snapped = snapAndRedistributePitch(pitchSlots)
                onPitchSlotsChange(snapped)
                saveTacticsLayout(dbPath, snapped)
                setLayoutMsg('Layout saved for this database')
                window.setTimeout(() => setLayoutMsg(null), 2500)
              }}
            >
              Save layout
            </button>
            <button
              type="button"
              disabled={!dbPath}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
              onClick={() => {
                if (!dbPath) return
                clearSavedTacticsLayout(dbPath)
                setLayoutMsg('Saved layout cleared — pick a preset to reset')
                window.setTimeout(() => setLayoutMsg(null), 2500)
              }}
            >
              Clear saved
            </button>
            {layoutMsg && <span className="self-center text-[10px] text-zinc-500">{layoutMsg}</span>}
          </div>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Community preset</span>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              value={preset}
              onChange={(e) => onPresetChange(e.target.value as TacticPresetId)}
            >
              {TACTIC_PRESETS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-zinc-400">{p.blurb}</p>
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Team instructions (CM0102 labels)
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="w-28 shrink-0 text-zinc-500">Pressing</span>
              <select
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={pressing ? 'yes' : 'no'}
                onChange={(e) => setPressing(e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="w-28 shrink-0 text-zinc-500">Passing</span>
              <select
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={passing}
                onChange={(e) => setPassing(e.target.value as PassingStyle)}
              >
                <option value="short">Short</option>
                <option value="mixed">Mixed</option>
                <option value="direct">Direct</option>
                <option value="long">Long</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="w-28 shrink-0 text-zinc-500">Mentality</span>
              <select
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={mentality}
                onChange={(e) => setMentality(e.target.value as Mentality)}
              >
                <option value="defensive">Defensive</option>
                <option value="normal">Normal</option>
                <option value="attacking">Attacking</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="w-28 shrink-0 text-zinc-500">Offside trap</span>
              <select
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={offside ? 'yes' : 'no'}
                onChange={(e) => setOffside(e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="w-28 shrink-0 text-zinc-500">Tackling</span>
              <select
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={tackling}
                onChange={(e) => setTackling(e.target.value as TacklingStyle)}
              >
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-sky-300/90">Heuristic benchmark</div>
            <div className="mt-1 font-mono text-2xl text-sky-100">{score}</div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Preset + team instructions + forward arrows + lineup role ratings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
