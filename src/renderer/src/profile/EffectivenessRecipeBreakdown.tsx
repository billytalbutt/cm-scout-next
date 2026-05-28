import type { EffectivenessRunnerUp, EffectivenessWinnerDetail } from '../../../shared/effectivenessEngine'
import { attrColor } from '../ProfileAttrBlocks'

/** Recipe no longer scores injury/dirtiness — invert only if reintroduced in engine extras. */
const INVERT_RECIPE_ATTRS = new Set<string>()

type StatRow = {
  key: string
  label: string
  raw: number
  overflow?: boolean
  invert?: boolean
}

function StatValue({ raw, overflow, invert }: { raw: number; overflow?: boolean; invert?: boolean }) {
  if (overflow) {
    return (
      <span className={`font-mono text-[11px] tabular-nums font-bold text-amber-300/95`}>
        {raw}
        <span className="ml-0.5 text-[10px] font-bold" aria-hidden>
          ↑
        </span>
      </span>
    )
  }
  return <span className={`font-mono text-[11px] tabular-nums ${attrColor(raw, invert)}`}>{raw}</span>
}

function StatTable({
  title,
  weightHint,
  rows,
}: {
  title: string
  weightHint: string
  rows: StatRow[]
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
              <th className="w-[70%] px-2.5 py-1 font-medium">Attribute</th>
              <th className="w-[30%] px-2 py-1 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.key} className="border-b border-zinc-800/40 last:border-0 even:bg-zinc-900/25">
                <td className="truncate px-2.5 py-1 text-zinc-300">{l.label}</td>
                <td className="px-2 py-1 text-right">
                  <StatValue raw={l.raw} overflow={l.overflow} invert={l.invert} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function mapStatLine(l: {
  key: string
  label: string
  raw: number
  overflow?: boolean
}): StatRow {
  return {
    key: l.key,
    label: l.label,
    raw: l.raw,
    overflow: l.overflow,
    invert: INVERT_RECIPE_ATTRS.has(l.key),
  }
}

/** Breakdown of the winning Eff % recipe (primary / secondary / engine). */
export function EffectivenessRecipeBreakdown({
  detail,
  runnerUp,
  effPercent,
  /** Hide role + % header when the parent already shows them on role tiles. */
  suppressHeaderSummary = false,
}: {
  detail: EffectivenessWinnerDetail
  runnerUp?: EffectivenessRunnerUp | null
  effPercent?: number | null
  suppressHeaderSummary?: boolean
}) {
  const primary = detail.lines.filter((l) => l.slot === 'primary').map(mapStatLine)
  const secondary = detail.lines.filter((l) => l.slot === 'secondary').map(mapStatLine)
  const engine = detail.engineLines.map(mapStatLine)

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800/90 bg-zinc-950/55 p-3">
      {!suppressHeaderSummary && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/70 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Winning recipe</p>
            <p className="text-sm font-medium text-zinc-200">{detail.archetypeLabel}</p>
          </div>
          {effPercent != null && (
            <p className="font-mono text-lg tabular-nums text-emerald-200/95">{effPercent.toFixed(1)}%</p>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <StatTable title="Primary" weightHint="×5 weight" rows={primary} />
        <StatTable title="Secondary" weightHint="×1.5 weight" rows={secondary} />
      </div>

      {engine.length > 0 && <StatTable title="Engine" weightHint="lighter weight" rows={engine} />}

      {runnerUp && (
        <p className="border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-500">
          Runner-up: <span className="text-zinc-300">{runnerUp.archetypeLabel}</span> at{' '}
          <span className="font-mono text-zinc-200">{runnerUp.score.toFixed(1)}%</span>
        </p>
      )}
    </div>
  )
}
