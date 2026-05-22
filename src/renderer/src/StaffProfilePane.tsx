import {
  sanitizeStaffAbility,
  staffReputationDisplay,
  staffReputationRawFromNonPlayer,
} from '../../shared/cm0102StaffMetrics'
import { ProfileAttrColumn } from './ProfileAttrBlocks'
import type { StaffProfilePayload } from './vite-env.d'

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

export function StaffProfilePane({ p, showEngineAttrs }: { p: StaffProfilePayload; showEngineAttrs?: boolean }) {
  const hasHidden = p.hasNonPlayer && p.hiddenColumns.some((col) => col.length > 0)

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

      {hasHidden && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hidden</h3>
          <p className="mb-1 text-[10px] leading-snug text-zinc-600">
            Values CM rarely shows on staff profiles — position prefs use suitability 0–20 when set;{' '}
            <span className="font-mono">-1</span> on disk means not set (not a rating of 1).
          </p>
          <div className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2">
            <ProfileAttrColumn cells={p.hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
            <ProfileAttrColumn cells={p.hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
            <ProfileAttrColumn cells={p.hiddenColumns[2]} showEngineAttrs={showEngineAttrs} />
          </div>
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
