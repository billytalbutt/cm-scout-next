import {
  COMPARE_RADAR_CATEGORIES,
  radarProfileForSide,
  type AttrCategoryId,
  type CategoryWinCounts,
} from '../../../shared/comparePlayers'

const CATEGORY_LABELS: Record<AttrCategoryId, string> = {
  attacking: 'Attacking',
  defending: 'Defending',
  physical: 'Physical',
  mental: 'Mental',
  technical: 'Technical',
  hidden: 'Hidden',
  other: 'Other',
}

const RADAR_LABELS: Record<(typeof COMPARE_RADAR_CATEGORIES)[number], string> = {
  attacking: 'ATK',
  defending: 'DEF',
  physical: 'PHY',
  mental: 'MEN',
  technical: 'TEC',
}

type RadarProfile = Record<(typeof COMPARE_RADAR_CATEGORIES)[number], number | null>

function polarPoint(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return { x: cx + r * Math.sin(angleRad), y: cy - r * Math.cos(angleRad) }
}

function polygonPath(
  cx: number,
  cy: number,
  radius: number,
  values: RadarProfile,
  maxVal: number,
): string {
  const pts = COMPARE_RADAR_CATEGORIES.map((cat, i) => {
    const v = values[cat] ?? 0
    const t = maxVal > 0 ? Math.min(1, v / maxVal) : 0
    const angle = (i / COMPARE_RADAR_CATEGORIES.length) * Math.PI * 2
    return polarPoint(cx, cy, radius * t, angle)
  })
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z'
}

function RadarChart({
  left,
  right,
  leftName,
  rightName,
}: {
  left: RadarProfile
  right: RadarProfile
  leftName: string
  rightName: string
}) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const maxR = 82
  const maxVal = 20

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52" role="img" aria-label="Attribute profile comparison">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon
            key={t}
            points={COMPARE_RADAR_CATEGORIES.map((_, i) => {
              const p = polarPoint(cx, cy, maxR * t, (i / COMPARE_RADAR_CATEGORIES.length) * Math.PI * 2)
              return `${p.x},${p.y}`
            }).join(' ')}
            fill="none"
            stroke="rgb(63 63 70)"
            strokeWidth={0.75}
          />
        ))}
        {COMPARE_RADAR_CATEGORIES.map((cat, i) => {
          const p = polarPoint(cx, cy, maxR, (i / COMPARE_RADAR_CATEGORIES.length) * Math.PI * 2)
          const lp = polarPoint(cx, cy, maxR + 14, (i / COMPARE_RADAR_CATEGORIES.length) * Math.PI * 2)
          return (
            <g key={cat}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgb(63 63 70)" strokeWidth={0.75} />
              <text
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-zinc-500 text-[9px] font-medium"
              >
                {RADAR_LABELS[cat]}
              </text>
            </g>
          )
        })}
        <path
          d={polygonPath(cx, cy, maxR, right, maxVal)}
          fill="rgb(56 189 248 / 0.12)"
          stroke="rgb(125 211 252)"
          strokeWidth={1.5}
        />
        <path
          d={polygonPath(cx, cy, maxR, left, maxVal)}
          fill="rgb(16 185 129 / 0.14)"
          stroke="rgb(52 211 153)"
          strokeWidth={1.75}
        />
        <circle cx={cx} cy={cy} r={2} fill="rgb(113 113 122)" />
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400/80" />
          {leftName}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-sky-300/80" />
          {rightName}
        </span>
      </div>
    </div>
  )
}

function CategoryBars({
  counts,
  leftName,
  rightName,
}: {
  counts: CategoryWinCounts
  leftName: string
  rightName: string
}) {
  const rows = COMPARE_RADAR_CATEGORIES.map((cat) => ({ cat, ...counts[cat] })).filter(
    (r) => r.left + r.right + r.tie > 0,
  )
  const maxTotal = Math.max(1, ...rows.map((r) => r.left + r.right + r.tie))

  return (
    <div className="space-y-2.5">
      {rows.map(({ cat, left, right, tie }) => {
        const total = left + right + tie
        const lw = (left / maxTotal) * 100
        const rw = (right / maxTotal) * 100
        const tw = (tie / maxTotal) * 100
        return (
          <div key={cat}>
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-medium text-zinc-400">{CATEGORY_LABELS[cat]}</span>
              <span className="font-mono tabular-nums text-zinc-500">
                {left}–{right}
                {tie > 0 ? ` (${tie} tied)` : ''}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-sm bg-zinc-800/80">
              {lw > 0 && (
                <div
                  className="bg-emerald-500/75"
                  style={{ width: `${(lw / (lw + rw + tw)) * 100}%` }}
                  title={`${leftName}: ${left}`}
                />
              )}
              {tw > 0 && (
                <div
                  className="bg-zinc-600"
                  style={{ width: `${(tw / (lw + rw + tw)) * 100}%` }}
                  title={`Tied: ${tie}`}
                />
              )}
              {rw > 0 && (
                <div
                  className="bg-sky-400/75"
                  style={{ width: `${(rw / (lw + rw + tw)) * 100}%` }}
                  title={`${rightName}: ${right}`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryAvgTable({
  left,
  right,
}: {
  left: RadarProfile
  right: RadarProfile
}) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-zinc-800 text-zinc-500">
          <th className="pb-1 text-left font-medium">Group</th>
          <th className="pb-1 text-right font-medium">Left</th>
          <th className="pb-1 text-right font-medium">Right</th>
          <th className="pb-1 text-right font-medium">Δ</th>
        </tr>
      </thead>
      <tbody>
        {COMPARE_RADAR_CATEGORIES.map((cat) => {
          const lv = left[cat]
          const rv = right[cat]
          if (lv == null && rv == null) return null
          const l = lv ?? 0
          const r = rv ?? 0
          const delta = l - r
          return (
            <tr key={cat} className="border-b border-zinc-800/40">
              <td className="py-1 text-zinc-400">{CATEGORY_LABELS[cat]}</td>
              <td className="py-1 text-right font-mono tabular-nums text-emerald-200/90">{lv?.toFixed(1) ?? '—'}</td>
              <td className="py-1 text-right font-mono tabular-nums text-sky-200/90">{rv?.toFixed(1) ?? '—'}</td>
              <td
                className={`py-1 text-right font-mono tabular-nums ${
                  delta > 0.05 ? 'text-emerald-300' : delta < -0.05 ? 'text-sky-300' : 'text-zinc-500'
                }`}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

type Props = {
  rows: { left: import('../../../shared/comparePlayers').CompareAttrCell; right: import('../../../shared/comparePlayers').CompareAttrCell }[]
  categoryWins: CategoryWinCounts
  leftName: string
  rightName: string
  showEngineAttrs: boolean
}

export function CompareAnalytics({ rows, categoryWins, leftName, rightName, showEngineAttrs }: Props) {
  const leftRadar = radarProfileForSide(rows, 'left', showEngineAttrs)
  const rightRadar = radarProfileForSide(rows, 'right', showEngineAttrs)

  const leftWins = COMPARE_RADAR_CATEGORIES.reduce((n, c) => n + categoryWins[c].left, 0)
  const rightWins = COMPARE_RADAR_CATEGORIES.reduce((n, c) => n + categoryWins[c].right, 0)
  const ties = COMPARE_RADAR_CATEGORIES.reduce((n, c) => n + categoryWins[c].tie, 0)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">Compare analytics</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Group averages and attribute wins across five on-pitch categories (hidden attrs excluded).
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-400">
          Wins{' '}
          <span className="text-emerald-300">{leftWins}</span>
          <span className="text-zinc-600"> · </span>
          <span className="text-sky-300">{rightWins}</span>
          {ties > 0 && (
            <>
              <span className="text-zinc-600"> · </span>
              <span className="text-zinc-500">{ties} tied</span>
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Profile shape</p>
          <RadarChart left={leftRadar} right={rightRadar} leftName={leftName} rightName={rightName} />
        </div>
        <div className="space-y-4">
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Category wins</p>
            <CategoryBars counts={categoryWins} leftName={leftName} rightName={rightName} />
          </div>
          <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Group averages</p>
            <CategoryAvgTable left={leftRadar} right={rightRadar} />
          </div>
        </div>
      </div>
    </div>
  )
}
