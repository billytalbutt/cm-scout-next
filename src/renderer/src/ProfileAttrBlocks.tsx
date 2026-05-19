import type { ProfileAttrCell } from './vite-env.d'

export function attrColor(v: number, invert = false): string {
  const x = invert ? 21 - v : v
  if (x >= 18) return 'text-emerald-300 font-semibold'
  if (x >= 15) return 'text-emerald-200/90'
  if (x >= 12) return 'text-zinc-200'
  if (x >= 8) return 'text-amber-200/80'
  return 'text-rose-300/90'
}

/** Bracket styling when uncapped CA18-style / raw engine value differs from the on-screen number. */
export function engineBracketClass(uncapped: number, inGame: number): string {
  if (uncapped > inGame) return 'rounded bg-amber-500/20 px-1 font-semibold text-amber-100 tabular-nums'
  return 'rounded bg-violet-500/15 px-1 font-semibold text-violet-100 tabular-nums'
}

/** Row tint: core / supporting fills plus optional thin ring for engine-breaker bankers. */
export function profileAttrHighlightClass(cell: Pick<ProfileAttrCell, 'highlightTier' | 'highlightEngine'>): string {
  const parts: string[] = []
  if (cell.highlightTier === 'primary') {
    parts.push('rounded', 'px-1', '-mx-1', 'bg-emerald-500/[0.14]')
  } else if (cell.highlightTier === 'secondary') {
    parts.push('rounded', 'px-1', '-mx-1', 'bg-sky-500/[0.11]')
  } else if (cell.highlightEngine) {
    parts.push('rounded', 'px-1', '-mx-1')
  }
  if (cell.highlightEngine) {
    parts.push('ring-1', 'ring-inset', 'ring-amber-100/40')
  }
  return parts.join(' ')
}

export function ProfileAttrColumn({
  cells,
  showEngineAttrs,
}: {
  cells: ProfileAttrCell[]
  showEngineAttrs?: boolean
}) {
  return (
    <ul className="min-w-0 space-y-0.5 text-[12px]">
      {cells.map((a) => (
        <li
          key={a.key}
          className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 ${profileAttrHighlightClass(a)}`}
        >
          <span className="truncate text-zinc-400" title={a.key}>
            {a.label}
          </span>
          <span
            className={`shrink-0 font-mono text-[13px] tabular-nums ${attrColor(a.inGame, a.invert)}`}
            title={`In-game ${a.inGame}${
              showEngineAttrs && a.inGameUncapped !== a.inGame ? ` · engine display ${a.inGameUncapped}` : ''
            } · intrinsic ${a.raw} · in-match ${a.inMatch}`}
          >
            {a.inGame}
            {showEngineAttrs && a.inGameUncapped !== a.inGame && (
              <span className={`ml-0.5 text-[12px] ${engineBracketClass(a.inGameUncapped, a.inGame)}`}>
                ({a.inGameUncapped})
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
