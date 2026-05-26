import type { AttrDevelopmentDelta, PlayerDevelopmentSummary } from '../../shared/playerDevelopmentTypes'

function DeltaBadge({ d }: { d: AttrDevelopmentDelta }) {
  const sign = d.delta > 0 ? '+' : ''
  const tone = d.improved ? 'text-emerald-300/90' : 'text-rose-300/80'
  return (
    <span className={tone}>
      {sign}
      {d.delta}
    </span>
  )
}

function AttrCompareBar({ d }: { d: AttrDevelopmentDelta }) {
  const max = 20
  const beforeW = `${Math.min(100, (d.before / max) * 100)}%`
  const afterW = `${Math.min(100, (d.after / max) * 100)}%`
  return (
    <div className="space-y-1.5 border-b border-zinc-800/60 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-zinc-300">{d.label}</span>
        <span className="tabular-nums text-zinc-500">
          <span className="text-zinc-400">{d.before}</span>
          <span className="mx-1 text-zinc-600">→</span>
          <span className={d.improved ? 'text-zinc-200' : 'text-zinc-300'}>{d.after}</span>
          <span className="ml-2">
            <DeltaBadge d={d} />
          </span>
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span className="w-14 shrink-0">Snapshot</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-zinc-500/70" style={{ width: beforeW }} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span className="w-14 shrink-0">Current</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${d.improved ? 'bg-emerald-600/75' : 'bg-rose-600/60'}`}
              style={{ width: afterW }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniSparkBars({ deltas }: { deltas: AttrDevelopmentDelta[] }) {
  const top = [...deltas]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8)
  if (!top.length) {
    return <p className="text-xs text-zinc-500">No attribute changes since snapshot.</p>
  }
  const maxAbs = Math.max(1, ...top.map((d) => Math.abs(d.delta)))
  return (
    <div className="flex h-16 items-end gap-1 rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-2">
      {top.map((d) => {
        const h = `${Math.max(12, (Math.abs(d.delta) / maxAbs) * 100)}%`
        return (
          <div
            key={d.index}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
            title={`${d.label}: ${d.before} → ${d.after}`}
          >
            <div
              className={`w-full max-w-[1.25rem] rounded-sm ${d.improved ? 'bg-emerald-700/80' : 'bg-rose-800/70'}`}
              style={{ height: h }}
            />
            <span className="max-w-full truncate text-[8px] text-zinc-600">{d.label.split(' ')[0]}</span>
          </div>
        )
      })}
    </div>
  )
}

export function PlayerDevelopmentDetail({
  summary,
  snapshotAt,
  snapshotGameDate,
  onOpenProfile,
}: {
  summary: PlayerDevelopmentSummary
  snapshotAt?: string
  snapshotGameDate?: string | null
  onOpenProfile?: () => void
}) {
  const gains = summary.deltas.filter((d) => d.improved)
  const losses = summary.deltas.filter((d) => !d.improved)
  const changed = summary.deltas.length > 0 || summary.caDelta !== 0 || summary.paDelta !== 0

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{summary.name}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {summary.club}
          {summary.age != null && (
            <>
              {' '}
              · Age <span className="font-mono text-zinc-400">{summary.age}</span>
            </>
          )}
        </p>
        {(snapshotAt || snapshotGameDate) && (
          <p className="mt-1 text-[10px] text-zinc-600">
            Compared to snapshot
            {snapshotGameDate && (
              <>
                {' '}
                (game <span className="font-mono text-zinc-500">{snapshotGameDate.slice(0, 10)}</span>)
              </>
            )}
            {snapshotAt && (
              <>
                {' '}
                · saved <span className="font-mono text-zinc-500">{snapshotAt.slice(0, 19).replace('T', ' ')}</span>
              </>
            )}
          </p>
        )}
      </div>

      {onOpenProfile && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700/60"
        >
          Open full profile
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">CA</p>
          <p className="mt-0.5 font-mono text-zinc-200">
            {summary.caBefore} → {summary.caAfter}
            {summary.caDelta !== 0 && (
              <span className={summary.caDelta > 0 ? 'ml-1 text-emerald-300/90' : 'ml-1 text-rose-300/80'}>
                ({summary.caDelta > 0 ? '+' : ''}
                {summary.caDelta})
              </span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">PA</p>
          <p className="mt-0.5 font-mono text-zinc-200">
            {summary.paBefore} → {summary.paAfter}
            {summary.paDelta !== 0 && (
              <span className={summary.paDelta > 0 ? 'ml-1 text-emerald-300/90' : 'ml-1 text-rose-300/80'}>
                ({summary.paDelta > 0 ? '+' : ''}
                {summary.paDelta})
              </span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Improved attrs</p>
          <p className="mt-0.5 font-mono text-emerald-300/90">{summary.attrsUp}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Declined attrs</p>
          <p className="mt-0.5 font-mono text-rose-300/80">{summary.attrsDown}</p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Largest changes
        </p>
        <MiniSparkBars deltas={summary.deltas} />
      </div>

      {!changed && (
        <p className="text-xs text-zinc-500">No changes detected since the snapshot for this player.</p>
      )}

      {gains.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Improvements</h3>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3">
            {gains
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .map((d) => (
                <AttrCompareBar key={d.index} d={d} />
              ))}
          </div>
        </section>
      )}

      {losses.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Declines</h3>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3">
            {losses
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .map((d) => (
                <AttrCompareBar key={d.index} d={d} />
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
