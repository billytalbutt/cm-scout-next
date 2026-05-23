import { useCallback, useMemo, useState } from 'react'
import {
  sanitizeStaffAbility,
  staffReputationDisplay,
  staffReputationRawFromNonPlayer,
} from '../../../shared/cm0102StaffMetrics'
import { staffHiddenMeaningfulForDisplay } from '../../../shared/cm0102StaffHiddenDisplay'
import { ProfileAttrColumn } from '../ProfileAttrBlocks'
import type { ProfileAttrCell, StaffProfilePayload } from '../vite-env.d'
import { fmtMoney, ProfileTabBar, type ProfileTabId } from './profileUi'

const SHOW_INACTIVE_HIDDEN_KEY = 'cm-scout-show-inactive-hidden'

function loadShowInactiveHidden(): boolean {
  try {
    return localStorage.getItem(SHOW_INACTIVE_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function filterHiddenColumns(
  columns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]],
  jobForClub: number,
  showInactive: boolean,
): [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]] {
  if (showInactive) return columns
  const filterCol = (col: ProfileAttrCell[]) =>
    col.filter((c) => staffHiddenMeaningfulForDisplay(c.key, c.raw, jobForClub))
  return [filterCol(columns[0]), filterCol(columns[1]), filterCol(columns[2])]
}

export function StaffProfileTabViews({ p, showEngineAttrs }: { p: StaffProfilePayload; showEngineAttrs?: boolean }) {
  const [tab, setTab] = useState<ProfileTabId>('attributes')
  const [showInactiveHidden, setShowInactiveHidden] = useState(loadShowInactiveHidden)
  const persistShowInactiveHidden = useCallback((v: boolean) => {
    setShowInactiveHidden(v)
    try {
      localStorage.setItem(SHOW_INACTIVE_HIDDEN_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const hiddenColumns = useMemo(
    () => filterHiddenColumns(p.hiddenColumns, p.jobForClub, showInactiveHidden),
    [p.hiddenColumns, p.jobForClub, showInactiveHidden],
  )
  const hasHidden = p.hasNonPlayer && hiddenColumns.some((col) => col.length > 0)

  return (
    <div className="space-y-3">
      <div className="border-b border-zinc-800/80 pb-3">
        <h2 className="text-lg font-semibold text-white">{p.name}</h2>
        <p className="mt-1 text-sm text-emerald-200/90">{p.jobLabel}</p>
        <p className="mt-1 text-sm text-zinc-200">{p.nation}</p>
        <p className="text-xs text-zinc-500">{p.club}</p>
      </div>

      <ProfileTabBar active={tab} onChange={setTab} variant="staff" />

      {tab === 'attributes' && (
        <div className="grid grid-cols-2 gap-x-3 border-t border-zinc-800/60 pt-2">
          <ProfileAttrColumn cells={p.attrColumns[0]} showEngineAttrs={showEngineAttrs} />
          <ProfileAttrColumn cells={p.attrColumns[1]} showEngineAttrs={showEngineAttrs} />
        </div>
      )}

      {tab === 'hidden' && (
        <div className="space-y-2 border-t border-zinc-800/60 pt-2">
          {p.hasNonPlayer && (
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={showInactiveHidden}
                onChange={(e) => persistShowInactiveHidden(e.target.checked)}
              />
              Show inactive / not set
            </label>
          )}
          {hasHidden ? (
            <div className="grid grid-cols-2 gap-x-3">
              <ProfileAttrColumn cells={hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
              <ProfileAttrColumn cells={hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No linked non-player record for hidden attributes.</p>
          )}
        </div>
      )}

      {tab === 'contract' && (
        <div className="border-t border-zinc-800/60 pt-2 text-xs">
          {p.contract ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h3 className="mb-2 font-semibold text-zinc-300">Contract</h3>
              <dl className="grid grid-cols-2 gap-1 text-zinc-400">
                <dt>Wage / week</dt>
                <dd className="text-right text-zinc-200">{fmtMoney(p.contract.wage)}</dd>
                <dt>Started</dt>
                <dd className="text-right font-mono text-zinc-200">{p.contract.dateStarted ?? '—'}</dd>
                <dt>Expires</dt>
                <dd className="text-right font-mono text-zinc-200">{p.contract.contractExpires ?? '—'}</dd>
                <dt>Type</dt>
                <dd className="text-right text-zinc-200">{p.contract.typeLabel ?? String(p.contract.type)}</dd>
              </dl>
            </div>
          ) : (
            <p className="text-zinc-500">No contract on file.</p>
          )}
        </div>
      )}

      {tab === 'scout' && (
        <div className="space-y-4 border-t border-zinc-800/60 pt-2 text-xs">
          {p.coachPreferences && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <h3 className="mb-2 font-semibold text-zinc-300">Coaching preferences</h3>
              <ul className="space-y-1 text-zinc-400">
                {p.coachPreferences.preferredFormation && (
                  <li>Formation: {p.coachPreferences.preferredFormation}</li>
                )}
                {p.coachPreferences.preferredStyle && <li>Style: {p.coachPreferences.preferredStyle}</li>}
                {p.coachPreferences.closesDownOpposition && <li>Closes down opposition</li>}
                {p.coachPreferences.playsOffsideTrap && <li>Offside trap</li>}
                {p.coachPreferences.usesManMarking && <li>Man marking</li>}
              </ul>
            </div>
          )}
          <p className="text-zinc-500">
            Staff CA{' '}
            <span className="font-mono text-zinc-200">{sanitizeStaffAbility(p.currentAbility) ?? '—'}</span> · PA{' '}
            <span className="font-mono text-zinc-200">{sanitizeStaffAbility(p.potentialAbility) ?? '—'}</span>
            {p.reputation && (
              <>
                {' '}
                · Rep{' '}
                <span className="font-mono text-zinc-200">
                  {staffReputationDisplay(staffReputationRawFromNonPlayer(p.reputation)).label}
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
