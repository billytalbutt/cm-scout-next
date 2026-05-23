import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  sanitizeStaffAbility,
  staffReputationDisplay,
  staffReputationRawFromNonPlayer,
} from '../../shared/cm0102StaffMetrics'
import { staffHiddenMeaningfulForDisplay } from '../../shared/cm0102StaffHiddenDisplay'
import { ProfileAttrColumn } from './ProfileAttrBlocks'
import type { ProfileAttrCell, StaffProfilePayload } from './vite-env.d'

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
  const filtered: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]] = [
    filterCol(columns[0]),
    filterCol(columns[1]),
    filterCol(columns[2]),
  ]
  return filtered
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

export function StaffProfilePane({
  p,
  showEngineAttrs,
  actions,
}: {
  p: StaffProfilePayload
  showEngineAttrs?: boolean
  /** Pop out / shortlist — same slot as player profile (below CA·PA, above attributes). */
  actions?: ReactNode
}) {
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
    <div className="space-y-4">
      <div className="profile-pane-sticky">
        <h2 className="text-xl font-semibold tracking-tight text-white">{p.name}</h2>
        <p className="mt-1 text-sm font-medium text-emerald-200/90">{p.jobLabel}</p>
        <p className="mt-1.5 text-sm text-zinc-200">{p.nation}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{p.club}</p>
        {(p.age != null || p.dobIso) && (
          <p className="mt-1 text-xs text-zinc-500">
            {p.age != null && (
              <>
                Age <span className="font-mono text-zinc-300">{p.age}</span>
              </>
            )}
            {p.age != null && p.dobIso && <span className="text-zinc-600"> · </span>}
            {p.dobIso && (
              <>
                DOB <span className="font-mono text-zinc-400">{p.dobIso}</span>
              </>
            )}
          </p>
        )}
        {p.hasNonPlayer && (() => {
          const ca = sanitizeStaffAbility(p.currentAbility)
          const pa = sanitizeStaffAbility(p.potentialAbility)
          if (ca == null && pa == null) return null
          return (
            <p className="mt-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Staff CA</span>{' '}
              <span className="font-mono text-emerald-300">{ca ?? '—'}</span>
              <span className="mx-2 text-zinc-600">|</span>
              <span className="text-zinc-500">Staff PA</span>{' '}
              <span className="font-mono text-emerald-300">{pa ?? '—'}</span>
            </p>
          )
        })()}
        {p.reputation && (() => {
          const raw = staffReputationRawFromNonPlayer(p.reputation)
          const disp = staffReputationDisplay(raw)
          if (disp.raw == null) return null
          return (
            <p className="mt-1.5 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Reputation</span>{' '}
              <span className="font-medium text-zinc-200">{disp.label}</span>
              <span className="font-mono text-zinc-500"> ({disp.raw.toLocaleString()})</span>
            </p>
          )
        })()}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}

      {p.coachPreferences && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Coaching preferences
          </h3>
          <ul className="space-y-1 border-t border-zinc-800/60 pt-2 text-[12px] leading-snug text-zinc-300">
            {p.coachPreferences.preferredFormation && (
              <li>
                <span className="text-zinc-500">Preferred formation</span>{' '}
                {p.coachPreferences.preferredFormation}
              </li>
            )}
            {p.coachPreferences.preferredStyle && (
              <li>
                <span className="text-zinc-500">Preferred style</span>{' '}
                {p.coachPreferences.preferredStyle}
              </li>
            )}
            {p.coachPreferences.closesDownOpposition && (
              <li>Likes his players to close down the opposition</li>
            )}
            {p.coachPreferences.playsOffsideTrap && <li>Likes to play the offside trap</li>}
            {p.coachPreferences.usesManMarking && <li>Likes to deploy a man-marking system</li>}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Attributes</h3>
        <div className="grid grid-cols-2 gap-x-4 border-t border-zinc-800/60 pt-2">
          <ProfileAttrColumn cells={p.attrColumns[0]} showEngineAttrs={showEngineAttrs} />
          <ProfileAttrColumn cells={p.attrColumns[1]} showEngineAttrs={showEngineAttrs} />
        </div>
      </div>

      {p.hasNonPlayer && (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hidden</h3>
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-zinc-500">
              <input
                type="checkbox"
                className="rounded border-zinc-600 bg-zinc-900"
                checked={showInactiveHidden}
                onChange={(e) => persistShowInactiveHidden(e.target.checked)}
              />
              Show inactive / not set
            </label>
          </div>
          <p className="mb-1 text-[10px] leading-snug text-zinc-600">
            By default, only values CM would treat as active (e.g. tactical prefs from 14+, set position
            suitability, Fitness/Technique coaching) are listed. Inactive rows are stored on disk but do not
            appear on the in-game staff profile.
          </p>
          {hasHidden ? (
            <div className="grid grid-cols-2 gap-x-4 border-t border-zinc-800/60 pt-2">
              <ProfileAttrColumn cells={hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
              <ProfileAttrColumn cells={hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
            </div>
          ) : (
            <p className="border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-500">
              No active hidden attributes for this person. Turn on “Show inactive / not set” to see every
              stored byte.
            </p>
          )}
        </div>
      )}

      {!p.hasNonPlayer && (
        <p className="text-[11px] text-zinc-500">
          No linked backroom coaching profile (<span className="font-mono">nonplayer.dat</span>) for this person —
          attributes show staff mentals and determination only.
        </p>
      )}

      {p.contract && (
        <div>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Contract</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
            <dt>Wage / week</dt>
            <dd className="font-mono text-zinc-200">{fmtMoney(p.contract.wage)}</dd>
            <dt>Started</dt>
            <dd className="text-zinc-200">{p.contract.dateStarted ?? '—'}</dd>
            <dt>Expires</dt>
            <dd className="text-zinc-200">{p.contract.contractExpires ?? '—'}</dd>
            <dt>Contract type</dt>
            <dd className="text-zinc-200">{p.contract.typeLabel ?? p.contract.type}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
