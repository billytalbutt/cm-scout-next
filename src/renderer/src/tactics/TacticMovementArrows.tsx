import type { ArrowLineSegment } from '../../../shared/tacticsArrowDrag'

type Props = {
  lines: ArrowLineSegment[]
  preview?: boolean
}

/** CM-style dotted movement lines with arrowhead at the destination only. */
export function TacticMovementArrows({ lines, preview = false }: Props) {
  if (lines.length === 0) return null
  const stroke = preview ? 'rgb(212 212 216)' : 'rgb(161 161 170)'
  const markerId = preview ? 'tactic-arrowhead-preview' : 'tactic-arrowhead'

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${preview ? 'z-[5]' : 'z-[4]'}`}
      aria-hidden
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="6"
          markerHeight="6"
          refX="5.2"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill={stroke} />
        </marker>
      </defs>
      {lines.map((line) => (
        <line
          key={line.key}
          x1={`${line.x1}%`}
          y1={`${line.y1}%`}
          x2={`${line.x2}%`}
          y2={`${line.y2}%`}
          stroke={stroke}
          strokeWidth={preview ? 1.5 : 1.25}
          strokeDasharray={preview ? '4 3' : '3 2'}
          markerEnd={`url(#${markerId})`}
        />
      ))}
    </svg>
  )
}
