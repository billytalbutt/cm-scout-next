import type { TacticArrow } from '../../../shared/tacticsCommunityPresets'

const GLYPH: Record<Exclude<TacticArrow, 'none'>, string> = {
  forward: '↑',
  back: '↓',
  left: '←',
  right: '→',
  'forward-left': '↖',
  'forward-right': '↗',
  'back-left': '↙',
  'back-right': '↘',
}

/** Offset from player centre (px) — arrow sits on that side of the icon. */
const OFFSET: Record<Exclude<TacticArrow, 'none'>, { x: number; y: number }> = {
  forward: { x: 0, y: -14 },
  back: { x: 0, y: 14 },
  left: { x: -14, y: 0 },
  right: { x: 14, y: 0 },
  'forward-left': { x: -10, y: -10 },
  'forward-right': { x: 10, y: -10 },
  'back-left': { x: -10, y: 10 },
  'back-right': { x: 10, y: 10 },
}

export function TacticArrowGlyph({ arrow }: { arrow: TacticArrow }) {
  if (arrow === 'none') return null
  const off = OFFSET[arrow]
  return (
    <span
      className="pointer-events-none absolute text-[9px] leading-none text-zinc-400"
      style={{ left: `calc(50% + ${off.x}px)`, top: `calc(50% + ${off.y}px)`, transform: 'translate(-50%, -50%)' }}
      aria-hidden
    >
      {GLYPH[arrow]}
    </span>
  )
}
