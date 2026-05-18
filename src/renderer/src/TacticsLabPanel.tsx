import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  pitchSlotsFromPreset,
  snapAndRedistributePitch,
  teamRatingFromAssignments,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../shared/tacticsPitchSnap'
import {
  TACTIC_PRESETS,
  type TacticArrow,
  type TacticPresetId,
} from '../../shared/tacticsCommunityPresets'

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
  tacticsSeedClubId,
  pitchSlots,
  onPitchSlotsChange,
  assignments,
}: {
  loadInfo: boolean
  tacticsSeedClubId: number | null
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
  const [saveWireMsg, setSaveWireMsg] = useState<string | null>(null)
  const [saveWireLoading, setSaveWireLoading] = useState(false)

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

  const pullFromSaveClub = useCallback(async () => {
    if (tacticsSeedClubId == null || typeof window.cmapi?.getClubDetail !== 'function') {
      setSaveWireMsg('Select a club in the Clubs tab first (click a club in the list).')
      return
    }
    setSaveWireLoading(true)
    setSaveWireMsg(null)
    try {
      const d = (await window.cmapi.getClubDetail(tacticsSeedClubId)) as Record<string, unknown> | null
      if (!d) {
        setSaveWireMsg('Club detail not available.')
        return
      }
      const tw = d.tacticsWire as
        | {
            experimentalSlots: { x: number; y: number; label: string }[] | null
            tacticRowFound: boolean
            tacticsBlockPresent: boolean
          }
        | undefined
      const exp = tw?.experimentalSlots
      if (exp && exp.length >= 11) {
        onPitchSlotsChange(
          snapAndRedistributePitch(
            exp.map((s, i) => ({
              id: `save-${i}`,
              role: s.label,
              x: s.x,
              y: s.y,
              arrow: 'none' as TacticArrow,
            })),
          ),
        )
        setSaveWireMsg(
          `Experimental: loaded ${exp.length} pitch nodes from tactics.dat for “${String(d.name)}” (heuristic decode — verify in-game).`,
        )
      } else {
        setSaveWireMsg(
          `Loaded “${String(d.name)}”: tactics.dat ${tw?.tacticsBlockPresent ? 'present' : 'missing'}, tactic row ${tw?.tacticRowFound ? 'found' : 'not found'} — no heuristic pitch window matched.`,
        )
      }
    } catch (e) {
      setSaveWireMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveWireLoading(false)
    }
  }, [tacticsSeedClubId, onPitchSlotsChange])

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
        <span className="font-medium text-zinc-300">Tactics Lab</span> — CM0102-style team instructions and a draggable
        pitch (GK at the bottom, forwards at the top). Drag players — they snap invisibly to row/column bands (five
        across, including centre). Right-click for forward / backward arrows.
      </div>
      {loadInfo && (
        <div className="rounded-lg border border-sky-900/30 bg-sky-950/15 p-3 text-[11px] text-zinc-400">
          <span className="font-medium text-sky-200/90">From save</span> — pick a club in the{' '}
          <span className="text-zinc-300">Clubs</span> tab, then use the button here to pull{' '}
          <span className="font-mono text-zinc-300">tactics.dat</span> into the pitch (experimental).
          {tacticsSeedClubId != null ? (
            <span className="ml-1 font-mono text-emerald-300/90"> Seed club id {tacticsSeedClubId}</span>
          ) : (
            <span className="ml-1 text-zinc-500"> No club selected yet.</span>
          )}
          <div className="mt-2">
            <button
              type="button"
              disabled={saveWireLoading}
              onClick={() => void pullFromSaveClub()}
              className="rounded-md border border-sky-700/50 bg-sky-950/50 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-900/50 disabled:opacity-50"
            >
              {saveWireLoading ? 'Loading…' : 'Load tactic snapshot from seed club'}
            </button>
          </div>
          {saveWireMsg && <p className="mt-2 text-[11px] text-zinc-400">{saveWireMsg}</p>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/30 to-zinc-950 p-4">
          <div
            ref={pitchRef}
            className="relative mx-auto aspect-[68/105] max-h-[min(52vh,520px)] w-full max-w-md touch-none rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-inner shadow-black/40"
          >
            <div className="pointer-events-none absolute inset-2 rounded-md border border-zinc-800/60 opacity-40" />
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
            Drag to move (invisible snap). Five columns incl. centre; rows auto-space like CM. Lineup avg:{' '}
            <span className="font-mono text-emerald-300/90">{lineupRating ?? '—'}</span>
          </p>
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
