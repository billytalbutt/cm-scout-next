import { createPortal } from 'react-dom'
import type { DatabaseLoadProgress } from '../../shared/loadProgress'
/**
 * Same bundled asset as the app header (`App.tsx`). Vite resolves this in dev and production;
 * do not use `public/favicon.png` here — it is easy to miss on dark UI and `file://` paths vary.
 */
import soccerWizardMascot from './assets/soccer-wizard-mascot.png'

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

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/92"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50">
        <div className="px-6 pb-6 pt-8">
          <div className="mb-5 flex min-h-[11rem] items-center justify-center">
            <img
              src={soccerWizardMascot}
              alt=""
              width={280}
              height={280}
              decoding="sync"
              loading="eager"
              draggable={false}
              className="block h-44 w-auto max-h-44 max-w-full object-contain object-center"
            />
          </div>

          <h2 className="text-center text-lg font-semibold text-zinc-100">Loading save</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-zinc-400">{progress.message}</p>
          <p className="mt-1 text-center text-xs text-zinc-500">{hint}</p>

          <div className="mt-6">
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

          <p className="mt-5 text-center text-[11px] text-zinc-600">
            If this step sits still for more than a minute, pull the latest build — a fix removed a
            per-player full-file scan that could take ten minutes.
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
