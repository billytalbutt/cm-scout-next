import type { EffectivenessFullResult } from '../../../shared/effectivenessEngine'
import { buildEffectivenessNarrative } from '../../../shared/effectivenessNarrative'

function StatList({
  title,
  lines,
}: {
  title: string
  lines: { key: string; label: string; raw: number; overflow?: boolean; godTier?: boolean; invertNote?: boolean }[]
}) {
  if (lines.length === 0) return null
  return (
    <>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-zinc-300">
        {lines.map((l) => (
          <li key={l.key}>
            {l.label} <span className="text-zinc-500">{l.raw}</span>
            {l.invertNote ? <span className="text-zinc-600"> (inv.)</span> : null}
            {l.overflow ? (
              <span className="text-amber-300"> ↑</span>
            ) : l.godTier ? (
              <span className="text-amber-300"> ★</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

export function EffDetailContent({
  data,
  playerName,
  cmScoutRatingBp,
  compact = false,
}: {
  data: EffectivenessFullResult
  playerName?: string
  cmScoutRatingBp?: number
  compact?: boolean
}) {
  if (data.effPercent == null || data.winnerDetail == null) {
    return (
      <div className="space-y-2">
        <p className="font-semibold text-violet-200/95">Eff % — Unsure</p>
        <p className="text-zinc-400">
          Natural positions did not match any effectiveness recipe. Use CM Scout % for an intrinsic read on this player.
        </p>
      </div>
    )
  }

  const narrative = buildEffectivenessNarrative({ result: data, playerName, cmScoutRatingBp })
  const d = data.winnerDetail

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {narrative && (
        <div className="rounded-md border border-zinc-800/90 bg-zinc-900/50 p-2.5">
          <p className="text-xs font-semibold text-zinc-100">{narrative.headline}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">{narrative.summary}</p>
          {narrative.caveats && (
            <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-amber-200/90">{narrative.caveats}</p>
          )}
        </div>
      )}

      <p className="font-semibold text-emerald-200/95">
        {d.archetypeLabel} recipe · {data.effPercent.toFixed(1)}%
      </p>

      {d.brainMult ? (
        <p className="text-zinc-400">
          Base (recipe + engine) {d.basePercent.toFixed(1)}% × brain ({d.brainMult.decisions} Dec / 20 ×{' '}
          {d.brainMult.anticipation} Ant / 20 ={' '}
          <span className="font-mono text-zinc-200">{d.brainMult.factor}</span>) →{' '}
          <span className="font-mono text-zinc-100">{d.preConsistencyPercent.toFixed(1)}%</span>
        </p>
      ) : (
        <p className="text-zinc-400">
          Base (recipe + engine){' '}
          <span className="font-mono text-zinc-100">{d.preConsistencyPercent.toFixed(1)}%</span>
        </p>
      )}

      {d.consistencyReliability && (
        <p className="text-zinc-400">
          Consistency <span className="font-mono text-zinc-200">{d.consistencyReliability.consistency}</span>/20 → ×
          {d.consistencyReliability.factor.toFixed(3)} →{' '}
          <span className="font-mono text-emerald-200/95">{data.effPercent.toFixed(1)}%</span>
        </p>
      )}

      <StatList
        title="Primary (×5)"
        lines={d.lines
          .filter((l) => l.slot === 'primary')
          .map((l) => ({
            key: l.key,
            label: l.label,
            raw: l.raw,
            overflow: l.overflow,
            godTier: l.godTier,
          }))}
      />
      <StatList
        title="Secondary (×1.5)"
        lines={d.lines
          .filter((l) => l.slot === 'secondary')
          .map((l) => ({
            key: l.key,
            label: l.label,
            raw: l.raw,
            overflow: l.overflow,
            godTier: l.godTier,
          }))}
      />

      {data.byArchetype.length > 1 && (
        <>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">All natural recipes</p>
          <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-zinc-300">
            {data.byArchetype.map((row) => (
              <li key={row.archetypeId}>
                {row.archetypeLabel}{' '}
                <span className={row.isWinner ? 'text-emerald-200' : 'text-zinc-400'}>{row.percent.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <StatList
        title="Engine (weighted)"
        lines={d.engineLines.map((l) => ({
          key: l.key,
          label: l.label,
          raw: l.raw,
          overflow: l.overflow,
          godTier: l.godTier,
          invertNote: l.key === 'injury_proneness',
        }))}
      />

      {data.runnerUp && (
        <p className="border-t border-zinc-800 pt-2 text-zinc-400">
          Runner-up: <span className="text-zinc-200">{data.runnerUp.archetypeLabel}</span> at{' '}
          <span className="font-mono text-zinc-200">{data.runnerUp.score.toFixed(1)}%</span>
        </p>
      )}
    </div>
  )
}
