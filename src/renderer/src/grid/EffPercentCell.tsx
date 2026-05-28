import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EffectivenessFullResult } from '../../../shared/effectivenessEngine'
import { EffDetailContent } from './EffDetailContent'
import { EffDetailModal } from './EffDetailModal'

type Props = {
  staffIndex: number
  playerName?: string
  effPercent: number | null
  effArchetype: string
  cmScoutRatingBp?: number
}

export function EffPercentCell({
  staffIndex,
  playerName,
  effPercent,
  effArchetype,
  cmScoutRatingBp,
}: Props) {
  const [data, setData] = useState<EffectivenessFullResult | null>(null)
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
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

  const fetchDetail = useCallback(async () => {
    const seq = ++fetchSeq.current
    try {
      const fn = window.cmapi?.getEffectivenessDetail
      if (typeof fn !== 'function') {
        if (seq === fetchSeq.current) setData(null)
        return null
      }
      const out = (await fn(staffIndex)) as EffectivenessFullResult | null
      if (seq === fetchSeq.current) setData(out)
      return out
    } catch {
      if (seq === fetchSeq.current) setData(null)
      return null
    }
  }, [staffIndex])

  const loadAndOpenTooltip = useCallback(async () => {
    clearClose()
    const el = anchorRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const w = Math.min(380, window.innerWidth - 16)
      setPos({
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - w)),
      })
    }
    setOpen(true)
    if (!data) await fetchDetail()
  }, [data, fetchDetail])

  const openModal = useCallback(async () => {
    clearClose()
    setOpen(false)
    setModalOpen(true)
    if (!data) await fetchDetail()
  }, [data, fetchDetail])

  useEffect(() => () => clearClose(), [])

  const gem =
    !isUnsure && effPercent != null && cmScoutRatingBp != null && effPercent > cmScoutRatingBp + 15

  const unsureTitle =
    'Natural positions did not match any effectiveness recipe (rare). No Eff % is shown — use CM Scout % for an intrinsic read.'

  const tip =
    open &&
    createPortal(
      <div
        className="pointer-events-auto z-[9999] w-[min(24rem,calc(100vw-1.5rem))] max-h-[min(28rem,70vh)] overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-950/98 p-2.5 text-[11px] leading-snug text-zinc-200 shadow-2xl backdrop-blur-sm"
        style={{ position: 'fixed', top: pos.top, left: pos.left }}
        onMouseEnter={clearClose}
        onMouseLeave={scheduleClose}
      >
        {!data ? (
          <p className="text-zinc-400">Loading breakdown…</p>
        ) : (
          <EffDetailContent
            data={data}
            playerName={playerName}
            cmScoutRatingBp={cmScoutRatingBp}
            compact
          />
        )}
        <p className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
          Double-click for full panel · only natural roles (&gt;14) are scored
        </p>
      </div>,
      document.body,
    )

  if (isUnsure) {
    return (
      <>
        <span
          ref={anchorRef}
          className="inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted border-violet-500/45"
          onMouseEnter={loadAndOpenTooltip}
          onMouseLeave={scheduleClose}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void openModal()
          }}
        >
          <span className="font-medium italic text-violet-200/95" title={unsureTitle}>
            Unsure
          </span>
        </span>
        {tip}
        <EffDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          data={data}
          playerName={playerName}
          cmScoutRatingBp={cmScoutRatingBp}
          loading={modalOpen && !data}
        />
      </>
    )
  }

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex cursor-help items-baseline gap-0.5 border-b border-dotted border-zinc-600/80"
        onMouseEnter={loadAndOpenTooltip}
        onMouseLeave={scheduleClose}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void openModal()
        }}
      >
        <span
          className={gem ? 'font-semibold text-emerald-300' : 'text-zinc-200'}
          title={
            gem
              ? 'Eff % is more than 15 points above CM Scout %. Hover for quick breakdown; double-click for full panel.'
              : 'Hover for breakdown; double-click for full panel'
          }
        >
          {effPercent!.toFixed(1)}% ({effArchetype})
        </span>
      </span>
      {tip}
      <EffDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        playerName={playerName}
        cmScoutRatingBp={cmScoutRatingBp}
        loading={modalOpen && !data}
      />
    </>
  )
}
