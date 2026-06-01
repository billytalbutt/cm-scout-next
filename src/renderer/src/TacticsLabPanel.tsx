import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  pitchSlotsFromPreset,
  snapAndRedistributePitch,
  tacticalRowForY,
  TACTICAL_ROWS,
  teamRatingFromAssignments,
  type PitchSlot,
  type TacticsPlayerAssignment,
  type TacticalRowId,
} from '../../shared/tacticsPitchSnap'
import {
  arrowLineEndpoints,
  movementArrowForDrag,
  snapArrowDragTarget,
  type ArrowDragTarget,
} from '../../shared/tacticsArrowDrag'
import { clearSavedTacticsLayout, saveTacticsLayout } from './tactics/tacticsLayoutStorage'
import { TacticArrowGlyph } from './tactics/TacticArrowGlyph'
import {
  TACTIC_PRESETS,
  isForwardishArrow,
  type TacticPresetId,
} from '../../shared/tacticsCommunityPresets'
import { TacticsClubPicker } from './tactics/TacticsClubPicker'
import { PitchMarkings } from './tactics/PitchMarkings'

type Mentality = 'defensive' | 'normal' | 'attacking'
type PassingStyle = 'short' | 'mixed' | 'direct' | 'long'
type TacklingStyle = 'normal' | 'hard'

const DRAG_PX_THRESHOLD = 5

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

function pointerToPitchNorm(el: HTMLDivElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  const x = Math.min(0.94, Math.max(0.06, (clientX - r.left) / r.width))
  const fracFromTop = (clientY - r.top) / r.height
  const y = Math.min(0.92, Math.max(0.04, 1 - fracFromTop))
  return { x, y }
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
  const [arrowPreview, setArrowPreview] = useState<{
    slotId: string
    target: ArrowDragTarget
  } | null>(null)

  const p = useMemo(() => TACTIC_PRESETS.find((x) => x.id === preset)!, [preset])
  const forwardArrows = useMemo(
    () => pitchSlots.filter((z) => isForwardishArrow(z.arrow)).length,
    [pitchSlots],
  )
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
  const pointerModeRef = useRef<'move' | 'arrow' | null>(null)
  const moveDragRef = useRef<{
    id: string
    dx: number
    dy: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const arrowDragRef = useRef<{ id: string; fromRow: TacticalRowId; fromX: number } | null>(null)
  const arrowPreviewRef = useRef<{ slotId: string; target: ArrowDragTarget } | null>(null)

  const onPresetChange = (id: TacticPresetId) => {
    setPreset(id)
    const next = TACTIC_PRESETS.find((x) => x.id === id)!
    onPitchSlotsChange(pitchSlotsFromPreset(next))
  }

  const onSlotPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, slot: PitchSlot) => {
      e.preventDefault()
      e.stopPropagation()
      const btn = e.currentTarget
      btn.setPointerCapture(e.pointerId)

      const pitch = pitchRef.current
      if (!pitch) return
      const r = pitch.getBoundingClientRect()
      const cx = r.left + slot.x * r.width
      const cy = r.top + (1 - slot.y) * r.height

      if (e.button === 2) {
        pointerModeRef.current = 'arrow'
        arrowDragRef.current = {
          id: slot.id,
          fromRow: tacticalRowForY(slot.y),
          fromX: slot.x,
        }
        const initial = { slotId: slot.id, target: snapArrowDragTarget(slot.x, slot.y) }
        arrowPreviewRef.current = initial
        setArrowPreview(initial)
        return
      }

      if (e.button !== 0) {
        pointerModeRef.current = null
        btn.releasePointerCapture(e.pointerId)
        return
      }

      pointerModeRef.current = 'move'
      moveDragRef.current = {
        id: slot.id,
        dx: e.clientX - cx,
        dy: e.clientY - cy,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      }
    },
    [],
  )

  const onSlotPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const mode = pointerModeRef.current
      const pitch = pitchRef.current
      if (!pitch || !mode) return

      if (mode === 'arrow') {
        const d = arrowDragRef.current
        if (!d) return
        const { x, y } = pointerToPitchNorm(pitch, e.clientX, e.clientY)
        const next = { slotId: d.id, target: snapArrowDragTarget(x, y) }
        arrowPreviewRef.current = next
        setArrowPreview(next)
        return
      }

      const d = moveDragRef.current
      if (!d) return
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_PX_THRESHOLD) {
        d.moved = true
      }
      const { x, y } = pointerToPitchNorm(pitch, e.clientX - d.dx, e.clientY - d.dy)
      onPitchSlotsChange((prev) => prev.map((s) => (s.id === d.id ? { ...s, x, y } : s)))
    },
    [onPitchSlotsChange],
  )

  const onSlotPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const btn = e.currentTarget
      try {
        btn.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      const mode = pointerModeRef.current
      pointerModeRef.current = null

      if (mode === 'arrow') {
        const d = arrowDragRef.current
        arrowDragRef.current = null
        const preview = arrowPreviewRef.current
        arrowPreviewRef.current = null
        setArrowPreview(null)
        if (!d) return
        onPitchSlotsChange((prev) =>
          prev.map((s) => {
            if (s.id !== d.id) return s
            const target =
              preview?.slotId === d.id ? preview.target : snapArrowDragTarget(s.x, s.y)
            const arrow = movementArrowForDrag(d.fromRow, d.fromX, target)
            return {
              ...s,
              arrow,
              arrowTargetRow: arrow === 'none' ? null : target.rowId,
              arrowTargetX: arrow === 'none' ? null : target.x,
            }
          }),
        )
        return
      }

      if (mode !== 'move') return
      const d = moveDragRef.current
      moveDragRef.current = null
      if (!d) return
      if (!d.moved) {
        onPitchSlotsChange((prev) =>
          prev.map((s) =>
            s.id === d.id ? { ...s, arrow: 'none', arrowTargetRow: null, arrowTargetX: null } : s,
          ),
        )
        return
      }
      onPitchSlotsChange((prev) => snapAndRedistributePitch(prev))
    },
    [onPitchSlotsChange],
  )

  const previewLine = useMemo(() => {
    if (!arrowPreview) return null
    const slot = pitchSlots.find((s) => s.id === arrowPreview.slotId)
    if (!slot) return null
    return arrowLineEndpoints(slot.x, slot.y, arrowPreview.target.rowId, arrowPreview.target.x)
  }, [arrowPreview, pitchSlots])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-snug text-zinc-500">
        <span className="font-medium text-zinc-300">Tactics Lab</span> —{' '}
        <span className="text-zinc-400">Left-click and drag</span> to move players between snap positions.{' '}
        <span className="text-zinc-400">Right-click and drag</span> to draw a movement arrow to any line (player stays
        put). Quick <span className="text-zinc-400">left-click</span> without dragging clears an arrow.
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
            onContextMenu={(e) => e.preventDefault()}
          >
            <PitchMarkings />
            {previewLine && (
              <svg
                className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
                aria-hidden
              >
                <line
                  x1={`${previewLine.x1}%`}
                  y1={`${previewLine.y1}%`}
                  x2={`${previewLine.x2}%`}
                  y2={`${previewLine.y2}%`}
                  stroke="rgb(161 161 170)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              </svg>
            )}
            {pitchSlots.map((slot) => {
              const line =
                slot.arrow !== 'none' && slot.arrowTargetRow
                  ? arrowLineEndpoints(
                      slot.x,
                      slot.y,
                      slot.arrowTargetRow,
                      slot.arrowTargetX ?? slot.x,
                    )
                  : null
              return line ? (
                <svg
                  key={`line-${slot.id}`}
                  className="pointer-events-none absolute inset-0 z-[4] h-full w-full overflow-visible"
                  aria-hidden
                >
                  <line
                    x1={`${line.x1}%`}
                    y1={`${line.y1}%`}
                    x2={`${line.x2}%`}
                    y2={`${line.y2}%`}
                    stroke="rgb(113 113 122)"
                    strokeWidth="1.25"
                    strokeDasharray="3 2"
                  />
                </svg>
              ) : null
            })}
            {pitchSlots.map((slot) => {
              const a = assignments[slot.id]
              const shortName = a?.name?.split(' ').pop()
              const rating = a?.rolePercent ?? a?.cmScoutBp
              return (
                <button
                  key={slot.id}
                  type="button"
                  title={`${slot.role}${a?.name ? ` — ${a.name}` : ''}${rating != null ? ` · ${Math.round(rating)}%` : ''} — left-drag move · right-drag arrow · left-click clears arrow`}
                  className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none flex-col items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-900/90 text-[9px] font-semibold text-zinc-200 shadow hover:bg-zinc-800/90 active:cursor-grabbing"
                  style={{ left: `${slot.x * 100}%`, top: `${(1 - slot.y) * 100}%` }}
                  onPointerDown={(e) => onSlotPointerDown(e, slot)}
                  onPointerMove={onSlotPointerMove}
                  onPointerUp={onSlotPointerUp}
                  onPointerCancel={onSlotPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="leading-none">{slot.role.slice(0, 2)}</span>
                  <TacticArrowGlyph arrow={slot.arrow} />
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
            Release drag to snap. Lineup avg:{' '}
            <span className="font-mono text-zinc-300">{lineupRating ?? '—'}</span>
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
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Heuristic benchmark</div>
            <div className="mt-1 font-mono text-2xl text-zinc-200">{score}</div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Preset + team instructions + forward arrows + lineup role ratings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
