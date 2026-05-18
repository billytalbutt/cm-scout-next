import { useCallback, useMemo, useState } from 'react'
import {
  applyPresetToCm0102Grid,
  applySlotsToCm0102Grid,
  CM0102_TACTIC_ROWS,
  teamRatingFromAssignments,
  type Cm0102GridSlot,
  type Cm0102GridSlotId,
  type TacticsPlayerAssignment,
} from '../../shared/cm0102TacticsGrid'
import {
  TACTIC_PRESETS,
  type TacticArrow,
  type TacticPresetId,
} from '../../shared/tacticsCommunityPresets'
import { TacticsPlayerMarker } from './tactics/TacticsPlayerMarker'

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
  return Math.min(99, Math.max(30, s))
}

export function TacticsLabPanel({
  loadInfo,
  tacticsSeedClubId,
  gridSlots,
  onGridSlotsChange,
  assignments,
}: {
  loadInfo: boolean
  tacticsSeedClubId: number | null
  gridSlots: Cm0102GridSlot[]
  onGridSlotsChange: (slots: Cm0102GridSlot[]) => void
  assignments: Partial<Record<Cm0102GridSlotId, TacticsPlayerAssignment | null>>
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
  const forwardArrows = useMemo(() => gridSlots.filter((z) => z.arrow === 'forward').length, [gridSlots])
  const lineupRating = useMemo(() => teamRatingFromAssignments(gridSlots, assignments), [gridSlots, assignments])

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

  const applyPreset = useCallback(
    (id: TacticPresetId) => {
      const nextPreset = TACTIC_PRESETS.find((x) => x.id === id)!
      setPreset(id)
      onGridSlotsChange(applyPresetToCm0102Grid(nextPreset, gridSlots))
    },
    [gridSlots, onGridSlotsChange],
  )

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
        | { experimentalSlots: { x: number; y: number; label: string }[] | null; tacticRowFound: boolean }
        | undefined
      const exp = tw?.experimentalSlots
      if (exp && exp.length >= 8) {
        onGridSlotsChange(
          applySlotsToCm0102Grid(
            exp.map((s) => ({ role: s.label, x: s.x, y: s.y })),
            gridSlots,
          ),
        )
        setSaveWireMsg(`Loaded ${exp.length} positions from save for “${String(d.name)}” (snapped to CM grid).`)
      } else {
        setSaveWireMsg(`No pitch decode for “${String(d.name)}” — pick a community preset.`)
      }
    } catch (e) {
      setSaveWireMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSaveWireLoading(false)
    }
  }, [tacticsSeedClubId, gridSlots, onGridSlotsChange])

  const setSlotArrow = (slotId: Cm0102GridSlotId, arrow: TacticArrow) => {
    onGridSlotsChange(gridSlots.map((s) => (s.id === slotId ? { ...s, arrow } : s)))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-snug text-zinc-500">
        <span className="font-medium text-zinc-300">Tactics</span> — CM0102-style rows (sweeper → defence → DM → mid → AM →
        strikers, GK at bottom). Four columns per row. Right-click a player dot for forward / backward arrows protruding
        from the circle, like the game.
      </div>
      {loadInfo && (
        <div className="rounded-lg border border-sky-900/30 bg-sky-950/15 p-3 text-[11px] text-zinc-400">
          <span className="font-medium text-sky-200/90">From save</span> — pick a club in{' '}
          <span className="text-zinc-300">Clubs</span>, then load an experimental snapshot.
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
          <div className="relative mx-auto aspect-[68/105] max-h-[min(58vh,560px)] w-full max-w-md rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-inner shadow-black/40">
            {CM0102_TACTIC_ROWS.map((row) => (
              <div
                key={row.id}
                className="pointer-events-none absolute left-2 right-2 border-t border-dotted border-zinc-700/55"
                style={{ top: `${(1 - row.pitchY) * 100}%` }}
              />
            ))}
            <div className="pointer-events-none absolute inset-2 rounded-md border border-zinc-800/60 opacity-40" />
            {gridSlots.map((slot) => {
              const a = assignments[slot.id]
              const rating = a?.rolePercent ?? a?.cmScoutBp ?? null
              return (
                <div
                  key={slot.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${slot.pitchX * 100}%`, top: `${(1 - slot.pitchY) * 100}%` }}
                >
                  <TacticsPlayerMarker
                    role={slot.role}
                    playerName={a?.name}
                    rating={rating}
                    arrow={slot.arrow}
                    active={slot.active && !!slot.role}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (!slot.active) return
                      setSlotArrow(slot.id, nextArrow(slot.arrow))
                    }}
                  />
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Assign players in the line-up pane → they appear here. Lineup avg:{' '}
            <span className="font-mono text-emerald-300/90">{lineupRating ?? '—'}</span>
          </p>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Formation preset</span>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              value={preset}
              onChange={(e) => applyPreset(e.target.value as TacticPresetId)}
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
            <div className="text-[10px] font-medium uppercase tracking-wide text-sky-300/90">Tactic score</div>
            <div className="mt-1 font-mono text-2xl text-sky-100">{score}</div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Blends lineup role ratings with team instructions and forward arrows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
