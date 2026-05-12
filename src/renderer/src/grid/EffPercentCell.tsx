import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EffectivenessFullResult } from '../../../shared/effectivenessEngine'

type Props = {
  staffIndex: number
  effPercent: number | null
  effArchetype: string
  cmScoutRatingBp?: number
}

export function EffPercentCell({ staffIndex, effPercent, effArchetype, cmScoutRatingBp }: Props) {
  const [data, setData] = useState<EffectivenessFullResult | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const fetchSeq = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isUnsure = effArchetype === 'Unsure' || effPercent == null

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

  const gem =
    !isUnsure && effPercent != null && cmScoutRatingBp != null && effPercent > cmScoutRatingBp + 15

  const unsureTitle =
    'Natural positions did not match any effectiveness recipe (rare). No Eff % is shown — use CM Scout % for an intrinsic read. Relative Eff ranking still works for everyone else.'

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
        ) : data.effPercent == null || data.winnerDetail == null ? (
          <div className="space-y-2">
            <p className="font-semibold text-violet-200/95">Eff % — Unsure</p>
            <p className="text-zinc-400">
              This player’s natural lines (&gt;14, same idea as CM Scout) did not match any of the eight effectiveness
              recipes, so we do not assign a numeric Eff %. Use <strong className="text-zinc-300">CM Scout %</strong> in
              this grid or profile — it stays reliable here.
            </p>
            <p className="text-[10px] text-zinc-500">
              Other players’ Eff % values still rank them relative to each other on the recipes that did match.
            </p>
          </div>
        ) : (
          <>
            <p className="font-semibold text-emerald-200/95">
              {data.winnerDetail.archetypeLabel} recipe · {data.effPercent.toFixed(1)}%
            </p>
            {data.winnerDetail.brainMult ? (
              <p className="mt-1 text-zinc-400">
                Base (recipe + engine) {data.winnerDetail.basePercent.toFixed(1)}% × brain (
                {data.winnerDetail.brainMult.decisions} Dec / 20 × {data.winnerDetail.brainMult.anticipation} Ant / 20 ={' '}
                <span className="font-mono text-zinc-200">{data.winnerDetail.brainMult.factor}</span>) →{' '}
                <span className="font-mono text-zinc-100">
                  {data.winnerDetail.preConsistencyPercent.toFixed(1)}%
                </span>
              </p>
            ) : (
              <p className="mt-1 text-zinc-400">
                Base (recipe + engine){' '}
                <span className="font-mono text-zinc-100">{data.winnerDetail.preConsistencyPercent.toFixed(1)}%</span>
              </p>
            )}
            {data.winnerDetail.consistencyReliability && (
              <p className="mt-1 text-zinc-400">
                Consistency (hidden){' '}
                <span className="font-mono text-zinc-200">{data.winnerDetail.consistencyReliability.consistency}</span>
                /20 → ×{data.winnerDetail.consistencyReliability.factor.toFixed(3)} (match-to-form heuristic) →{' '}
                <span className="font-mono text-emerald-200/95">{data.effPercent!.toFixed(1)}%</span>
              </p>
            )}
            <p className="mt-1 text-[10px] text-zinc-500">
              Same <strong className="text-zinc-400">1–20 numbers as the profile</strong>. Engine rows = hiddens /
              set-pieces / staff mentals vetted per role; injury proneness is inverted (high file value = worse).
              Consistency multiplies the whole score — forum lore, not a decompiled formula.
            </p>
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
            {data.winnerDetail.engineLines.length > 0 && (
              <>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">Engine (weighted)</p>
                <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-zinc-300">
                  {data.winnerDetail.engineLines.map((l) => (
                    <li key={`e-${l.key}`}>
                      {l.label}{' '}
                      <span className="text-zinc-500">{l.raw}</span>
                      {l.key === 'injury_proneness' ? <span className="text-zinc-600"> (inv.)</span> : null}
                      {l.godTier ? <span className="text-amber-300"> ★20+</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.runnerUp && (
              <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">
                Runner-up: <span className="text-zinc-200">{data.runnerUp.archetypeLabel}</span> at{' '}
                <span className="font-mono text-zinc-200">{data.runnerUp.score.toFixed(1)}%</span>
              </p>
            )}
            <p className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
              Only archetypes that match <strong className="text-zinc-400">natural positions</strong> (&gt;14, same idea
              as CM Scout) are scored. DC / DMC / MC / AMC apply the <strong className="text-zinc-400">brain</strong>{' '}
              multiplier on the recipe+engine base, then <strong className="text-zinc-400">consistency</strong> scales
              the final %.
            </p>
          </>
        )}
      </div>,
      document.body,
    )

  if (isUnsure) {
    return (
      <>
        <span
          ref={anchorRef}
          className="inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted border-violet-500/45"
          onMouseEnter={loadAndOpen}
          onMouseLeave={scheduleClose}
        >
          <span className="font-medium italic text-violet-200/95" title={unsureTitle}>
            Unsure
          </span>
        </span>
        {tip}
      </>
    )
  }

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
          {effPercent!.toFixed(1)}% ({effArchetype})
        </span>
      </span>
      {tip}
    </>
  )
}
