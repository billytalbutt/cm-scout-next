import type { TacticArrow } from '../../../shared/tacticsCommunityPresets'

/** CM0102-style player dot with arrows protruding from the circle (not glyphs inside). */
export function TacticsPlayerMarker({
  role,
  playerName,
  rating,
  arrow,
  active,
  onContextMenu,
}: {
  role: string
  playerName?: string | null
  rating?: number | null
  arrow: TacticArrow
  active: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const label = role || '—'
  const shortName = playerName?.split(' ').pop() ?? ''

  return (
    <div
      className="flex flex-col items-center"
      onContextMenu={onContextMenu}
      title={`${label}${playerName ? ` — ${playerName}` : ''}${rating != null ? ` · ${rating}%` : ''} · right-click arrow`}
    >
      <svg width={44} height={52} viewBox="0 0 44 52" className="overflow-visible" aria-hidden>
        {arrow === 'forward' && (
          <path d="M22 2 L14 14 H30 Z" fill="#7dd3fc" stroke="#0c4a6e" strokeWidth="0.75" />
        )}
        {arrow === 'back' && (
          <path d="M22 50 L14 38 H30 Z" fill="#fcd34d" stroke="#78350f" strokeWidth="0.75" />
        )}
        <circle
          cx={22}
          cy={28}
          r={14}
          className={active ? 'fill-zinc-900 stroke-amber-200' : 'fill-zinc-950 stroke-zinc-600'}
          strokeWidth={active ? 2.5 : 1.5}
          opacity={active ? 1 : 0.45}
        />
        <text
          x={22}
          y={31}
          textAnchor="middle"
          className="fill-zinc-100 text-[9px] font-bold"
          style={{ fontSize: 9, fontFamily: 'system-ui,sans-serif' }}
        >
          {label.slice(0, 3)}
        </text>
      </svg>
      {shortName && (
        <span className="mt-0.5 max-w-[3.5rem] truncate text-center text-[8px] font-medium text-zinc-200">
          {shortName}
        </span>
      )}
      {rating != null && (
        <span className="font-mono text-[8px] tabular-nums text-emerald-300">{Math.round(rating)}%</span>
      )}
    </div>
  )
}
