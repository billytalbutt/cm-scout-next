import type { DatabaseLoadProgress } from '../../shared/loadProgress'
import loadScreenMascot from './assets/load-screen-mascot.png'

type Props = {
  progress: DatabaseLoadProgress
}

const PHASE_HINTS: Record<string, string> = {
  read: 'Reading your save from disk…',
  parse: 'Unpacking CM blocks (players, clubs, contracts)…',
  history: 'Loading career history…',
  stats: 'Decoding player stats blocks…',
  rows: 'Building the searchable player list…',
  ratings: 'Running CM Scout % and effectiveness…',
  regen: 'Checking regen hints…',
  season: 'Indexing current-season goals & assists…',
  done: 'Ready.',
}

export function DatabaseLoadOverlay({ progress }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(progress.progress * 100)))
  const hint = PHASE_HINTS[progress.phase] ?? progress.message

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/50">
        <div className="relative px-6 pb-6 pt-8">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-sky-500/15 blur-3xl"
            aria-hidden
          />

          <div className="relative mb-6 flex justify-center">
            <img
              src={loadScreenMascot}
              alt=""
              className="h-40 w-auto max-w-[min(100%,18rem)] object-contain"
              aria-hidden
            />
          </div>

          <h2 className="relative text-center text-lg font-semibold text-zinc-100">
            Loading save
          </h2>
          <p className="relative mt-2 text-center text-sm leading-relaxed text-zinc-400">
            {progress.message}
          </p>
          <p className="relative mt-1 text-center text-xs text-zinc-500">{hint}</p>

          <div className="relative mt-6">
            <div className="mb-2 flex justify-between text-[11px] font-medium tabular-nums text-zinc-500">
              <span>{progress.phase.replace(/_/g, ' ')}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <p className="relative mt-5 text-center text-[11px] text-zinc-600">
            If this step sits still for more than a minute, pull the latest build — a fix removed a
            per-player full-file scan that could take ten minutes.
          </p>
        </div>
      </div>
    </div>
  )
}
