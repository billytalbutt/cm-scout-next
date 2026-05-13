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

export function ProfileAttrColumn({
  cells,
  showEngineAttrs,
}: {
  cells: ProfileAttrCell[]
  showEngineAttrs?: boolean
}) {
  const tint = (tier?: 'primary' | 'secondary') => {
    if (tier === 'primary') return 'rounded px-1 -mx-1 bg-emerald-500/[0.14]'
    if (tier === 'secondary') return 'rounded px-1 -mx-1 bg-sky-500/[0.11]'
    return ''
  }
  return (
    <ul className="min-w-0 space-y-0.5 text-[12px]">
      {cells.map((a) => (
        <li
          key={a.key}
          className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 ${tint(a.highlightTier)}`}
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
