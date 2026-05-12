import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EffectivenessFullResult } from '../../../shared/effectivenessEngine'

type Props = {
  staffIndex: number
  effPercent: number
  effArchetype: string
  cmScoutRatingBp?: number
  isDemo?: boolean
}

export function EffPercentCell({ staffIndex, effPercent, effArchetype, cmScoutRatingBp, isDemo }: Props) {
  const [data, setData] = useState<EffectivenessFullResult | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const fetchSeq = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    clearClose()
    closeTimer.current = setTimeout(() => setOpen(false), 420)
  }

  useEffect(() => {
    setData(null)
  }, [staffIndex])

  const loadAndOpen = useCallback(async () => {
    clearClose()
    const el = anchorRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const w = Math.min(352, window.innerWidth - 16)
      setPos({
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - w)),
      })
    }
    setOpen(true)
    const seq = ++fetchSeq.current
    try {
      const fn = window.cmapi?.getEffectivenessDetail
      if (typeof fn !== 'function') {
        if (seq === fetchSeq.current) setData(null)
        return
      }
      const out = (await fn(staffIndex)) as EffectivenessFullResult | null
      if (seq === fetchSeq.current) setData(out)
    } catch {
      if (seq === fetchSeq.current) setData(null)
    }
  }, [staffIndex])

  useEffect(() => () => clearClose(), [])

  const gem = effPercent != null && cmScoutRatingBp != null && effPercent > cmScoutRatingBp + 15

  const tip =
    open &&
    createPortal(
      <div
        className="pointer-events-auto z-[9999] w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(24rem,70vh)] overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-950/98 p-2.5 text-[11px] leading-snug text-zinc-200 shadow-2xl backdrop-blur-sm"
        style={{ position: 'fixed', top: pos.top, left: pos.left }}
        onMouseEnter={clearClose}
        onMouseLeave={scheduleClose}
      >
        {!data ? (
          <p className="text-zinc-400">Loading breakdown…</p>
        ) : (
          <>
            <p className="font-semibold text-emerald-200/95">
              {data.winnerDetail.archetypeLabel} recipe · {data.effPercent.toFixed(1)}%
            </p>
            {data.winnerDetail.brainMult && (
              <p className="mt-1 text-zinc-400">
                Base {data.winnerDetail.basePercent.toFixed(1)}% × brain ({data.winnerDetail.brainMult.decisions}{' '}
                Dec / 20 × {data.winnerDetail.brainMult.anticipation} Ant / 20 ={' '}
                <span className="font-mono text-zinc-200">{data.winnerDetail.brainMult.factor}</span>) →{' '}
                <span className="font-mono text-zinc-100">{data.winnerDetail.finalPercent.toFixed(1)}%</span>
              </p>
            )}
            <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">Primary (×5)</p>
            <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-zinc-300">
              {data.winnerDetail.lines
                .filter((l) => l.slot === 'primary')
                .map((l) => (
                  <li key={`p-${l.key}`}>
                    {l.label} <span className="text-zinc-500">{l.raw}</span>
                    {l.godTier ? <span className="text-amber-300"> ★20+</span> : null}
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">Secondary (×1.5)</p>
            <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-zinc-300">
              {data.winnerDetail.lines
                .filter((l) => l.slot === 'secondary')
                .map((l) => (
                  <li key={`s-${l.key}`}>
                    {l.label} <span className="text-zinc-500">{l.raw}</span>
                    {l.godTier ? <span className="text-amber-300"> ★20+</span> : null}
                  </li>
                ))}
            </ul>
            {data.runnerUp && (
              <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">
                Runner-up: <span className="text-zinc-200">{data.runnerUp.archetypeLabel}</span> at{' '}
                <span className="font-mono text-zinc-200">{data.runnerUp.score.toFixed(1)}%</span>
              </p>
            )}
            <p className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
              Mentals used only where listed (e.g. Decisions, Anticipation, Off The Ball). Eff % ignores whether the
              player is natural in this bracket — compare to <strong className="text-zinc-400">Natural</strong> in the
              profile.{isDemo ? ' Demo row uses the built-in Tsigalko fixture.' : ''}
            </p>
          </>
        )}
      </div>,
      document.body,
    )

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted border-zinc-600/80"
        onMouseEnter={loadAndOpen}
        onMouseLeave={scheduleClose}
      >
        <span
          className={gem ? 'font-semibold text-[#39FF14]' : 'text-zinc-200'}
          title={
            gem
              ? 'Eff % is more than 15 points above CM Scout % (different formulas). Hover dotted underline for full breakdown.'
              : 'Hover for stat breakdown'
          }
        >
          {effPercent.toFixed(1)}% ({effArchetype})
        </span>
      </span>
      {tip}
    </>
  )
}
