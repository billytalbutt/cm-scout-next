import { useMemo, useState } from 'react'
import { TACTIC_PRESETS, type TacticPresetId } from '../../shared/tacticsCommunityPresets'

function tacticBenchmarkScore(presetId: TacticPresetId, teamWidth: number, tempo: number, press: boolean): number {
  let s = 52
  if (presetId === '442_narrow' && teamWidth < 45) s += 14
  if (presetId === '433_control' && teamWidth > 55) s += 12
  if (presetId === '4231_shadow' && tempo > 55) s += 10
  if (press) s += 6
  s += Math.round((50 - Math.abs(50 - tempo)) / 8)
  return Math.min(99, Math.max(38, s))
}

export function TacticsLabPanel() {
  const [preset, setPreset] = useState<TacticPresetId>('442_narrow')
  const [teamWidth, setTeamWidth] = useState(38)
  const [tempo, setTempo] = useState(58)
  const [press, setPress] = useState(false)
  const [offside, setOffside] = useState(false)
  const [direct, setDirect] = useState(false)

  const p = useMemo(() => TACTIC_PRESETS.find((x) => x.id === preset)!, [preset])
  const score = useMemo(
    () => tacticBenchmarkScore(preset, teamWidth, tempo, press),
    [preset, teamWidth, tempo, press],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-snug text-zinc-500">
        <span className="font-medium text-zinc-300">Tactics Lab (prototype)</span> — FM-style layout for exploration. The
        benchmark number mixes a few sliders with community presets; it is <strong className="text-zinc-400">not</strong>{' '}
        match-engine truth. Player-instruction and arrow dragging will expand here; for now slots are fixed per preset.
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/30 to-zinc-950 p-4">
          <div className="relative mx-auto aspect-[68/105] max-h-[min(52vh,520px)] w-full max-w-md rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-inner shadow-black/40">
            <div className="pointer-events-none absolute inset-2 rounded-md border border-zinc-800/60 opacity-40" />
            {p.slots.map((slot) => (
              <button
                key={`${slot.role}-${slot.x}-${slot.y}`}
                type="button"
                title={slot.role}
                className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-600/60 bg-emerald-950/80 text-[9px] font-semibold text-emerald-100 shadow hover:bg-emerald-900/90"
                style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
              >
                {slot.role.slice(0, 2)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-500">Pitch mock — dark mode; drag arrows in a later build.</p>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Community preset</span>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
              value={preset}
              onChange={(e) => setPreset(e.target.value as TacticPresetId)}
            >
              {TACTIC_PRESETS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-zinc-400">{p.blurb}</p>
          <div>
            <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
              <span>Width</span>
              <span className="font-mono text-zinc-300">{teamWidth}</span>
            </div>
            <input
              type="range"
              min={20}
              max={80}
              value={teamWidth}
              onChange={(e) => setTeamWidth(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
              <span>Tempo</span>
              <span className="font-mono text-zinc-300">{tempo}</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={press} onChange={(e) => setPress(e.target.checked)} />
              Pressing
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={offside} onChange={(e) => setOffside(e.target.checked)} />
              Offside trap
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} />
              More direct
            </label>
          </div>
          <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-sky-300/90">Heuristic benchmark</div>
            <div className="mt-1 font-mono text-2xl text-sky-100">{score}</div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Toy score: preset fit + width/tempo/press. Offside/direct toggles reserved for richer rules later.
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-[10px] font-semibold uppercase text-zinc-500">Preset team instructions</h4>
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
