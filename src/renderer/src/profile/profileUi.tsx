import { useState, type ReactNode } from 'react'
import { cm0102FootWord, cm0102MoraleWord } from '../../../shared/cm0102Bands'
import {
  attrColor,
  engineBracketClass,
  profileAttrHighlightClass,
  ProfileAttrColumn,
} from '../ProfileAttrBlocks'
import type { ProfilePayload } from '../vite-env.d'

export function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

export function fmtContractMoney(n: number) {
  if (!Number.isFinite(n) || n < 0) return '—'
  return fmtMoney(n)
}

export function playerInstructionAdvice(tier: 'strong' | 'ok' | 'avoid'): string {
  if (tier === 'strong') return 'Yes'
  if (tier === 'ok') return 'Yes (borderline)'
  return 'No'
}

export function formatProfileStatCell(v: number | null | undefined, kind: 'int' | 'rating' = 'int'): ReactNode {
  if (v == null || Number.isNaN(v)) return <span className="text-zinc-600">—</span>
  if (kind === 'rating') return <span className="font-mono text-zinc-200">{v.toFixed(2)}</span>
  return <span className="font-mono text-zinc-200">{Math.round(v)}</span>
}

export function cmScoutRoleValueTierByRole(percents: readonly number[]): Map<number, 0 | 1 | 2> {
  const uniq = [...new Set(percents)].sort((a, b) => b - a)
  const valueToTier = new Map<number, 0 | 1 | 2>()
  for (let t = 0; t < Math.min(3, uniq.length); t++) {
    valueToTier.set(uniq[t]!, t as 0 | 1 | 2)
  }
  const out = new Map<number, 0 | 1 | 2>()
  for (let i = 0; i < percents.length; i++) {
    const tier = valueToTier.get(percents[i]!)
    if (tier !== undefined) out.set(i, tier)
  }
  return out
}

export function HoverTip({
  tip,
  children,
  tipClassName = '',
}: {
  tip: ReactNode
  children: ReactNode
  tipClassName?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex max-w-full items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-full z-[200] mt-1 block max-w-[min(22rem,calc(100vw-2rem)))] rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-[11px] leading-snug text-zinc-200 shadow-2xl shadow-black/60 ring-1 ring-zinc-800/90 ${tipClassName}`}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

export function InfoDot() {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/80 text-[9px] font-semibold text-zinc-400"
      aria-hidden
    >
      ?
    </span>
  )
}

export function FeetMoraleBlock({
  feet,
  showEngineAttrs,
}: {
  feet: ProfilePayload['feetMorale']
  showEngineAttrs?: boolean
}) {
  type FootRow = ProfilePayload['feetMorale']['left']
  const row = (label: string, v: FootRow, band: (n: number) => string) => (
    <div
      key={label}
      className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 text-[12px] ${profileAttrHighlightClass(v)}`}
    >
      <span className="text-zinc-400">{label}</span>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={`font-mono text-[13px] tabular-nums ${attrColor(v.inGame)}`}
          title={`In-game ${v.inGame}${
            showEngineAttrs && v.inGameUncapped !== v.inGame ? ` · engine display ${v.inGameUncapped}` : ''
          } · intrinsic ${v.raw} · in-match ${v.inMatch}`}
        >
          {v.inGame}
          {showEngineAttrs && v.inGameUncapped !== v.inGame && (
            <span className={`ml-0.5 text-[12px] ${engineBracketClass(v.inGameUncapped, v.inGame)}`}>
              ({v.inGameUncapped})
            </span>
          )}
        </span>
        <span className="max-w-[9rem] text-right text-[9px] leading-tight text-zinc-500">{band(v.inGame)}</span>
      </div>
    </div>
  )
  return (
    <div className="mt-2 space-y-0.5 border-t border-zinc-700/50 pt-2">
      {row(feet.left.label, feet.left, cm0102FootWord)}
      {row(feet.right.label, feet.right, cm0102FootWord)}
      {row(feet.morale.label, feet.morale, cm0102MoraleWord)}
    </div>
  )
}

export type ProfileTabId = 'attributes' | 'hidden' | 'other'

export function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTabId
  onChange: (t: ProfileTabId) => void
}) {
  const tabs: { id: ProfileTabId; label: string }[] = [
    { id: 'attributes', label: 'Attributes' },
    { id: 'hidden', label: 'Hidden' },
    { id: 'other', label: 'Other' },
  ]
  return (
    <div className="flex gap-0.5 rounded-lg border border-zinc-800/90 bg-zinc-950/60 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
            active === t.id
              ? 'bg-zinc-700/90 text-zinc-100 shadow-sm'
              : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export { ProfileAttrColumn }
