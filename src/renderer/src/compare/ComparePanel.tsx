import { useCallback, useEffect, useState } from 'react'
import type { ProfilePayload } from '../vite-env.d'
import { CompareAnalytics } from './CompareAnalytics'
import { attrColor } from '../ProfileAttrBlocks'
import { PlayerRiskChips } from '../profile/PlayerRiskChips'
import {
  aggregateCategoryWins,
  compareAttrCells,
  flattenProfileAttrs,
  mergeCompareRows,
} from '../../../shared/comparePlayers'

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
          Eff <span className="font-mono text-zinc-200">{p.effPercent.toFixed(1)}%</span>
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

const PICK_BTN =
  'rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800'

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
        <button type="button" className={PICK_BTN} onClick={onPickLeft}>
          {left ? `Left: ${left.name}` : 'Select left player'}
        </button>
        <button type="button" className={PICK_BTN} onClick={onPickRight}>
          {right ? `Right: ${right.name}` : 'Select right player'}
        </button>
        {(leftStaffIndex != null || rightStaffIndex != null) && (
          <button
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
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
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <CompareHeader p={left} />
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <CompareHeader p={right} />
            </div>
          </div>

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
                          winner === 'left' ? WINNER_CELL : LOSER_CELL
                        }`}
                      >
                        <span className={attrColor(lv, lc.invert)}>{lv}</span>
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-mono tabular-nums ${
                          winner === 'right' ? WINNER_CELL : LOSER_CELL
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

          {categoryWins && (
            <CompareAnalytics
              rows={rows}
              categoryWins={categoryWins}
              leftName={left.name}
              rightName={right.name}
              showEngineAttrs={showEngineAttrs}
            />
          )}
        </>
      )}
    </div>
  )
}
