import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { EffectivenessFullResult } from '../../../shared/effectivenessEngine'
import { EffDetailContent } from './EffDetailContent'

type Props = {
  open: boolean
  onClose: () => void
  data: EffectivenessFullResult | null
  playerName?: string
  cmScoutRatingBp?: number
  loading?: boolean
}

export function EffDetailModal({ open, onClose, data, playerName, cmScoutRatingBp, loading }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const body = (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eff-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 id="eff-detail-title" className="text-sm font-semibold text-white">
            Effectiveness breakdown
            {playerName ? <span className="font-normal text-zinc-400"> · {playerName}</span> : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[11px] leading-snug text-zinc-200 cm-scroll">
          {loading || !data ? (
            <p className="text-zinc-400">Loading breakdown…</p>
          ) : (
            <EffDetailContent data={data} playerName={playerName} cmScoutRatingBp={cmScoutRatingBp} />
          )}
        </div>
        <p className="shrink-0 border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-500">
          Double-click Eff % in the grid to open this panel. Hover still shows the quick tooltip.
        </p>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null
}
