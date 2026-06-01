/**
 * CM 01/02–style pitch markings (halfway line, boxes, centre circle) in normalized 0–100% coords.
 * ViewBox matches pitch widget: y=0 at top (opposition goal), y=100 at bottom (our goal).
 */
export function PitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Outer touchlines */}
      <rect
        x="6"
        y="4"
        width="88"
        height="92"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.55"
      />
      {/* Halfway line */}
      <line x1="6" y1="50" x2="94" y2="50" stroke="rgb(82 82 91)" strokeWidth="0.35" opacity="0.5" />
      {/* Centre circle */}
      <circle
        cx="50"
        cy="50"
        r="9.15"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.45"
      />
      <circle cx="50" cy="50" r="0.6" fill="rgb(113 113 122)" opacity="0.5" />
      {/* Opposition penalty area (top) */}
      <rect
        x="22"
        y="4"
        width="56"
        height="16.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.45"
      />
      <rect
        x="35"
        y="4"
        width="30"
        height="5.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.45"
      />
      {/* Our penalty area (bottom) */}
      <rect
        x="22"
        y="79.5"
        width="56"
        height="16.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.45"
      />
      <rect
        x="35"
        y="90"
        width="30"
        height="5.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.45"
      />
      {/* Penalty spots */}
      <circle cx="50" cy="15" r="0.45" fill="rgb(113 113 122)" opacity="0.4" />
      <circle cx="50" cy="85" r="0.45" fill="rgb(113 113 122)" opacity="0.4" />
      {/* Penalty arcs (simplified) */}
      <path
        d="M 35 20.5 A 9.15 9.15 0 0 0 65 20.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.4"
      />
      <path
        d="M 35 79.5 A 9.15 9.15 0 0 1 65 79.5"
        fill="none"
        stroke="rgb(82 82 91)"
        strokeWidth="0.35"
        opacity="0.4"
      />
    </svg>
  )
}
