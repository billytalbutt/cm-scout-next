import { useEffect, useMemo, useState } from 'react'
import type { DatabaseLoadProgress } from '../../shared/loadProgress'
/** Header mascot — fallback if `public/favicon.png` fails to load in Electron. */
import soccerWizardMascot from './assets/soccer-wizard-mascot.png'

/** Resolve `favicon.png` next to `index.html` (works for `file://` and Vite dev server). */
function overlayFaviconUrl(): string {
  try {
    return new URL('favicon.png', window.location.href).href
  } catch {
    return './favicon.png'
  }
}

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
  const faviconSrc = useMemo(() => overlayFaviconUrl(), [])
  const [imgSrc, setImgSrc] = useState(faviconSrc)

  useEffect(() => {
    setImgSrc(faviconSrc)
  }, [faviconSrc])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/50">
        <div className="px-6 pb-6 pt-8">
          <div className="mb-6 flex justify-center">
            <img
              src={imgSrc}
              alt=""
              width={112}
              height={112}
              className="h-28 w-28 object-contain"
              aria-hidden
              onError={() => {
                if (imgSrc !== soccerWizardMascot) setImgSrc(soccerWizardMascot)
              }}
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
