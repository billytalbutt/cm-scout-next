import type { EffectivenessRunnerUp, EffectivenessWinnerDetail } from '../../../shared/effectivenessEngine'

function ValueFlag({ overflow, godTier }: { overflow?: boolean; godTier?: boolean }) {
  if (overflow) {
    return (
      <span className="inline-flex rounded border border-amber-500/35 bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-medium text-amber-200/95">
        Above 20
      </span>
    )
  }
  if (godTier) {
    return (
      <span className="inline-flex rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200/90">
        At 20
      </span>
    )
  }
  return <span className="text-zinc-700">—</span>
}

function StatTable({
  title,
  weightHint,
  rows,
}: {
  title: string
  weightHint: string
  rows: { key: string; label: string; raw: number; overflow?: boolean; godTier?: boolean }[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h4>
        <span className="shrink-0 text-[9px] text-zinc-600">{weightHint}</span>
      </div>
      <div className="overflow-hidden rounded-md border border-zinc-800/90 bg-zinc-950/40">
        <table className="w-full table-fixed text-[11px]">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-900/60 text-left text-[9px] uppercase tracking-wide text-zinc-600">
              <th className="w-[55%] px-2.5 py-1 font-medium">Attribute</th>
              <th className="w-[20%] px-2 py-1 text-right font-medium">Value</th>
              <th className="w-[25%] px-2 py-1 text-right font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.key} className="border-b border-zinc-800/40 last:border-0 even:bg-zinc-900/25">
                <td className="truncate px-2.5 py-1 text-zinc-300">{l.label}</td>
                <td className="px-2 py-1 text-right font-mono text-[11px] tabular-nums text-zinc-100">
                  {l.raw}
                </td>
                <td className="px-2 py-1 text-right">
                  <ValueFlag overflow={l.overflow} godTier={l.godTier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Polished breakdown of the winning Eff % recipe (primary / secondary / engine). */
export function EffectivenessRecipeBreakdown({
  detail,
  runnerUp,
  effPercent,
}: {
  detail: EffectivenessWinnerDetail
  runnerUp?: EffectivenessRunnerUp | null
  effPercent?: number | null
}) {
  const primary = detail.lines.filter((l) => l.slot === 'primary')
  const secondary = detail.lines.filter((l) => l.slot === 'secondary')

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800/90 bg-zinc-950/55 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/70 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Winning recipe</p>
          <p className="text-sm font-medium text-zinc-200">{detail.archetypeLabel}</p>
        </div>
        {effPercent != null && (
          <p className="font-mono text-lg tabular-nums text-emerald-200/95">{effPercent.toFixed(1)}%</p>
        )}
      </div>

      {(detail.brainMult || detail.consistencyReliability) && (
        <div className="grid gap-1 text-[10px] leading-snug text-zinc-500 sm:grid-cols-2">
          {detail.brainMult ? (
            <p>
              Brain ×{' '}
              <span className="font-mono text-zinc-300">
                ({detail.brainMult.decisions}/20 × {detail.brainMult.anticipation}/20)
              </span>
            </p>
          ) : null}
          {detail.consistencyReliability ? (
            <p>
              Consistency {detail.consistencyReliability.consistency.toFixed(0)}/20 → ×
              {detail.consistencyReliability.factor.toFixed(3)}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <StatTable title="Primary" weightHint="×5 weight" rows={primary} />
        <StatTable title="Secondary" weightHint="×1.5 weight" rows={secondary} />
      </div>

      {detail.engineLines.length > 0 && (
        <StatTable title="Engine" weightHint="lighter weight" rows={detail.engineLines} />
      )}

      {runnerUp && (
        <p className="border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-500">
          Runner-up: <span className="text-zinc-300">{runnerUp.archetypeLabel}</span> at{' '}
          <span className="font-mono text-zinc-200">{runnerUp.score.toFixed(1)}%</span>
        </p>
      )}

      <p className="text-[9px] leading-snug text-zinc-600">
        Values use uncapped engine ratings where the profile shows elites above 20.{' '}
        <span className="text-emerald-200/80">At 20</span> = on-screen cap;{' '}
        <span className="text-amber-200/80">Above 20</span> = engine display over 20.
      </p>
    </div>
  )
}
