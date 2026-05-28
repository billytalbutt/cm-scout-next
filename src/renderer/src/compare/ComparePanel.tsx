import { useCallback, useEffect, useState } from 'react'
import type { ProfilePayload } from '../vite-env.d'
import { attrColor } from '../ProfileAttrBlocks'
import { PlayerRiskChips } from '../profile/PlayerRiskChips'
import {
  aggregateCategoryWins,
  compareAttrCells,
  flattenProfileAttrs,
  mergeCompareRows,
  type AttrCategoryId,
} from '../../../shared/comparePlayers'

const CATEGORY_LABELS: Record<AttrCategoryId, string> = {
  attacking: 'Attacking',
  defending: 'Defending',
  physical: 'Physical',
  mental: 'Mental',
  technical: 'Technical',
  hidden: 'Hidden',
  other: 'Other',
}

function CompareHeader({ p }: { p: ProfilePayload }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
      <p className="text-[11px] text-zinc-400">
        {p.club} · {p.nation}
        {p.age != null ? ` · ${p.age}y` : ''}
      </p>
      <p className="font-mono text-[11px] text-zinc-300">
        CA {p.ca} · PA {p.pa}
      </p>
      {p.cmScoutRatingBp != null && (
        <p className="text-[11px] text-zinc-400">
          CM Scout <span className="font-mono text-zinc-200">{p.cmScoutRatingBp.toFixed(1)}%</span>
        </p>
      )}
      {p.effPercent != null && (
        <p className="text-[11px] text-zinc-400">
          Eff <span className="font-mono text-emerald-200/90">{p.effPercent.toFixed(1)}%</span>
          {p.effArchetype ? ` (${p.effArchetype})` : ''}
        </p>
      )}
      <PlayerRiskChips
        injuryRisk={p.injuryRisk}
        disciplineRisk={p.disciplineRisk}
        lowConsistencyRisk={p.lowConsistencyRisk}
      />
    </div>
  )
}

type Props = {
  loadInfo: boolean
  leftStaffIndex: number | null
  rightStaffIndex: number | null
  onPickLeft: () => void
  onPickRight: () => void
  onClear: () => void
  showEngineAttrs: boolean
}

export function ComparePanel({
  loadInfo,
  leftStaffIndex,
  rightStaffIndex,
  onPickLeft,
  onPickRight,
  onClear,
  showEngineAttrs,
}: Props) {
  const [left, setLeft] = useState<ProfilePayload | null>(null)
  const [right, setRight] = useState<ProfilePayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const loadSide = useCallback(async (staffIndex: number | null, side: 'left' | 'right') => {
    if (staffIndex == null || typeof window.cmapi?.getProfile !== 'function') {
      if (side === 'left') setLeft(null)
      else setRight(null)
      return
    }
    try {
      const p = await window.cmapi.getProfile(staffIndex)
      if (side === 'left') setLeft(p)
      else setRight(p)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void loadSide(leftStaffIndex, 'left')
  }, [leftStaffIndex, loadSide])

  useEffect(() => {
    void loadSide(rightStaffIndex, 'right')
  }, [rightStaffIndex, loadSide])

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to compare players.</p>
  }

  const rows =
    left && right
      ? mergeCompareRows(
          flattenProfileAttrs(left.attrColumns, left.hiddenColumns),
          flattenProfileAttrs(right.attrColumns, right.hiddenColumns),
        )
      : []

  const categoryWins =
    left && right ? aggregateCategoryWins(rows, showEngineAttrs) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-900/50"
          onClick={onPickLeft}
        >
          {left ? `Left: ${left.name}` : 'Select left player'}
        </button>
        <button
          type="button"
          className="rounded-md border border-sky-700/50 bg-sky-950/40 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-900/50"
          onClick={onPickRight}
        >
          {right ? `Right: ${right.name}` : 'Select right player'}
        </button>
        {(leftStaffIndex != null || rightStaffIndex != null) && (
          <button
            type="button"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>

      {err && <p className="text-sm text-rose-300">{err}</p>}

      {left && right && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-emerald-900/40 bg-zinc-900/40 p-3">
              <CompareHeader p={left} />
            </div>
            <div className="rounded-lg border border-sky-900/40 bg-zinc-900/40 p-3">
              <CompareHeader p={right} />
            </div>
          </div>

          {categoryWins && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
              <p className="mb-2 font-semibold text-zinc-300">Category summary</p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(CATEGORY_LABELS) as AttrCategoryId[]).map((cat) => {
                  const c = categoryWins[cat]
                  if (c.left + c.right + c.tie === 0) return null
                  return (
                    <p key={cat} className="text-zinc-400">
                      {CATEGORY_LABELS[cat]}:{' '}
                      <span className="text-emerald-300/90">{c.left}</span> /{' '}
                      <span className="text-sky-300/90">{c.right}</span>
                      {c.tie > 0 && <span className="text-zinc-500"> ({c.tie} tied)</span>}
                    </p>
                  )
                })}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2">Attribute</th>
                  <th className="px-2 py-2 text-right">{left.name}</th>
                  <th className="px-2 py-2 text-right">{right.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ label, left: lc, right: rc }) => {
                  const winner = compareAttrCells(lc, rc, showEngineAttrs)
                  const lv = showEngineAttrs && lc.inGameUncapped != null ? lc.inGameUncapped : lc.inGame
                  const rv = showEngineAttrs && rc.inGameUncapped != null ? rc.inGameUncapped : rc.inGame
                  return (
                    <tr key={lc.key} className="border-b border-zinc-800/50">
                      <td className="px-2 py-1 text-zinc-400">{label}</td>
                      <td
                        className={`px-2 py-1 text-right font-mono tabular-nums ${
                          winner === 'left' ? 'bg-emerald-950/30 text-emerald-200' : 'text-zinc-300'
                        }`}
                      >
                        <span className={attrColor(lv, lc.invert)}>{lv}</span>
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-mono tabular-nums ${
                          winner === 'right' ? 'bg-sky-950/30 text-sky-200' : 'text-zinc-300'
                        }`}
                      >
                        <span className={attrColor(rv, rc.invert)}>{rv}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
