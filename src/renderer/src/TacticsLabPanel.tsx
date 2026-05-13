import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TACTIC_PRESETS,
  type TacticArrow,
  type TacticPreset,
  type TacticPresetId,
} from '../../shared/tacticsCommunityPresets'

type Mentality = 'defensive' | 'normal' | 'attacking'
type PassingStyle = 'short' | 'mixed' | 'direct' | 'long'
type TacklingStyle = 'normal' | 'hard'

type LabSlot = {
  id: string
  role: string
  x: number
  y: number
  arrow: TacticArrow
}

const SNAP_X = [0.1, 0.28, 0.5, 0.72, 0.9]
const SNAP_Y = [0.06, 0.22, 0.28, 0.3, 0.32, 0.38, 0.4, 0.42, 0.44, 0.48, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.68, 0.72, 0.8, 0.82, 0.84, 0.9]

function snapTo(n: number, arr: number[]): number {
  let best = arr[0]!
  let bd = Infinity
  for (const v of arr) {
    const d = Math.abs(v - n)
    if (d < bd) {
      bd = d
      best = v
    }
  }
  return best
}

function clonePresetSlots(preset: TacticPreset): LabSlot[] {
  return preset.slots.map((s, i) => ({
    id: `${preset.id}-${i}`,
    role: s.role,
    x: s.x,
    y: s.y,
    arrow: s.arrow ?? 'none',
  }))
}

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
  if (args.presetId === '4132_press_short' && args.pressing && args.passing === 'short' && args.mentality === 'attacking')
    s += 14
  if (args.presetId === '442_narrow') s += 7
  if (args.presetId === '352_wb') s += 6
  if (args.presetId === '4321_tree' && args.passing === 'short') s += 5
  if (args.presetId === '4231_shadow') s += 4
  return Math.min(99, Math.max(30, s))
}

export function TacticsLabPanel() {
  const [preset, setPreset] = useState<TacticPresetId>('4132_press_short')
  const [slots, setSlots] = useState<LabSlot[]>(() => clonePresetSlots(TACTIC_PRESETS.find((x) => x.id === '4132_press_short')!))

  const [pressing, setPressing] = useState(true)
  const [passing, setPassing] = useState<PassingStyle>('short')
  const [mentality, setMentality] = useState<Mentality>('attacking')
  const [offside, setOffside] = useState(false)
  const [tackling, setTackling] = useState<TacklingStyle>('normal')

  const p = useMemo(() => TACTIC_PRESETS.find((x) => x.id === preset)!, [preset])
  const forwardArrows = useMemo(() => slots.filter((z) => z.arrow === 'forward').length, [slots])

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
      }),
    [preset, pressing, passing, mentality, offside, tackling, forwardArrows],
  )

  const pitchRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)

  useEffect(() => {
    const next = TACTIC_PRESETS.find((x) => x.id === preset)!
    setSlots(clonePresetSlots(next))
  }, [preset])

  const onPresetChange = (id: TacticPresetId) => {
    setPreset(id)
    const next = TACTIC_PRESETS.find((x) => x.id === id)!
    setSlots(clonePresetSlots(next))
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current
    const el = pitchRef.current
    if (!d || !el) return
    const r = el.getBoundingClientRect()
    const h = r.height
    const w = r.width
    const centerPxX = e.clientX - d.dx
    const centerPxY = e.clientY - d.dy
    const nx = Math.min(0.94, Math.max(0.06, (centerPxX - r.left) / w))
    const fracFromTop = (centerPxY - r.top) / h
    const ny = Math.min(0.92, Math.max(0.04, 1 - fracFromTop))
    setSlots((prev) => prev.map((s) => (s.id === d.id ? { ...s, x: nx, y: ny } : s)))
  }, [])

  const endDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        x: snapTo(s.x, SNAP_X),
        y: snapTo(s.y, SNAP_Y),
      })),
    )
  }, [onPointerMove])

  const onSlotPointerDown = (e: React.PointerEvent, slot: LabSlot) => {
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
        pitch mock (GK at the bottom, forwards at the top). Right-click a chip to cycle forward / backward arrows (like
        CM). Numbers are a <strong className="text-zinc-400">forum-style heuristic</strong>, not decompiled match AI.
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/30 to-zinc-950 p-4">
          <div
            ref={pitchRef}
            className="relative mx-auto aspect-[68/105] max-h-[min(52vh,520px)] w-full max-w-md touch-none rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-inner shadow-black/40"
          >
            <div className="pointer-events-none absolute inset-2 rounded-md border border-zinc-800/60 opacity-40" />
            {SNAP_Y.map((yy, i) => (
              <div
                key={`band-${i}-${yy}`}
                className="pointer-events-none absolute left-3 right-3 border-t border-dotted border-zinc-800/50"
                style={{ top: `${(1 - yy) * 100}%` }}
              />
            ))}
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                title={`${slot.role} — drag to move · right-click arrow`}
                className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none flex-col items-center justify-center rounded-full border border-emerald-600/60 bg-emerald-950/85 text-[9px] font-semibold text-emerald-100 shadow hover:bg-emerald-900/90 active:cursor-grabbing"
                style={{ left: `${slot.x * 100}%`, top: `${(1 - slot.y) * 100}%` }}
                onPointerDown={(e) => onSlotPointerDown(e, slot)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setSlots((prev) =>
                    prev.map((s) => (s.id === slot.id ? { ...s, arrow: nextArrow(s.arrow) } : s)),
                  )
                }}
              >
                <span className="leading-none">{slot.role.slice(0, 2)}</span>
                {slot.arrow === 'forward' && <span className="text-[8px] leading-none text-sky-300">▲</span>}
                {slot.arrow === 'back' && <span className="text-[8px] leading-none text-amber-300">▼</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Drag snaps to horizontal bands; five columns (left → right). Right-click: arrow cycle.
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
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Team instructions (CM0102 labels)</div>
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
              Toy score: preset + CM-style toggles + forward arrows. Tune later against engine research threads.
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Preset lore (team instructions)</h4>
            <ul className="list-inside list-disc text-[11px] text-zinc-400">
              {p.teamInstructions.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase text-zinc-500">Role recruitment hints (static)</h4>
        <div className="grid gap-2 md:grid-cols-2">
          {p.roleHints.map((h) => (
            <div key={h.role} className="rounded border border-zinc-800 bg-zinc-950/50 p-2 text-[11px]">
              <div className="font-medium text-zinc-200">{h.role}</div>
              <p className="mt-1 text-zinc-500">
                <span className="text-zinc-400">Attrs:</span> {h.attrs}
              </p>
              <p className="mt-1 text-zinc-500">
                <span className="text-zinc-400">Instructions:</span> {h.instructions}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
