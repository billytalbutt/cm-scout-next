import type { ProfilePayload } from '../vite-env.d'

type Regen = NonNullable<ProfilePayload['regen']>

type Props = {
  regen: Regen
  onOpenPredecessor?: (staffIndex: number) => void
  /** Pop-out scouting tab uses a slightly larger block with a heading */
  variant?: 'inline' | 'section'
}

export function RegenProfileHint({ regen, onOpenPredecessor, variant = 'inline' }: Props) {
  const sourceLabel =
    regen.source === 'snapshot-slot'
      ? 'GPF2 slot'
      : regen.source === 'snapshot-fingerprint'
        ? 'fingerprint'
        : regen.source === 'heuristic'
          ? 'heuristic'
          : regen.source === 'snapshot'
            ? 'snapshot'
            : 'linked'

  const body = (
    <>
      {regen.ofName ? (
        <>
          {' '}
          of <span className="font-medium text-zinc-200">{regen.ofName}</span>
        </>
      ) : null}
      <span className="text-zinc-600"> · {sourceLabel}</span>
      {regen.ofStaffIndex != null && onOpenPredecessor && (
        <>
          {' '}
          <button
            type="button"
            className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
            onClick={() => onOpenPredecessor(regen.ofStaffIndex!)}
          >
            Open predecessor
          </button>
        </>
      )}
    </>
  )

  if (variant === 'section') {
    return (
      <div className="border-t border-zinc-800/70 pt-3 text-xs leading-relaxed text-zinc-400">
        <p className="font-medium text-zinc-300">Likely regen</p>
        <p className="mt-1">
          {regen.ofName ? (
            <>
              Of <span className="font-medium text-zinc-200">{regen.ofName}</span>
            </>
          ) : (
            'Predecessor unknown'
          )}
          <span className="text-zinc-600"> · {sourceLabel}</span>
          {regen.ofStaffIndex != null && onOpenPredecessor && (
            <>
              {' '}
              <button
                type="button"
                className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                onClick={() => onOpenPredecessor(regen.ofStaffIndex!)}
              >
                Open predecessor profile
              </button>
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <p className="border-t border-zinc-800/70 pt-2 text-[11px] leading-relaxed text-zinc-400">
      <span className="font-medium text-zinc-300">Likely regen</span>
      {body}
    </p>
  )
}
