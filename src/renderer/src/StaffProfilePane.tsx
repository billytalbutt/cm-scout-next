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
      <div className="sticky top-0 z-30 -mx-4 border-b border-zinc-800/80 bg-zinc-950 px-4 pb-3 pt-0 shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-md">
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
        {p.hasNonPlayer && (p.currentAbility != null || p.potentialAbility != null) && (
          <p className="mt-2 text-sm">
            <span className="text-zinc-500">CA</span>{' '}
            <span className="font-mono text-emerald-300">{p.currentAbility ?? '—'}</span>
            <span className="mx-2 text-zinc-600">|</span>
            <span className="text-zinc-500">PA</span>{' '}
            <span className="font-mono text-emerald-300">{p.potentialAbility ?? '—'}</span>
          </p>
        )}
        {p.reputation && (
          <p className="mt-1.5 text-[11px] text-zinc-400">
            <span className="text-zinc-500">Rep</span>{' '}
            <span className="text-zinc-600">home</span>{' '}
            <span className="font-mono text-zinc-200">{p.reputation.home.toLocaleString()}</span>
            <span className="mx-1.5 text-zinc-700">·</span>
            <span className="text-zinc-600">current</span>{' '}
            <span className="font-mono text-zinc-200">{p.reputation.current.toLocaleString()}</span>
            <span className="mx-1.5 text-zinc-700">·</span>
            <span className="text-zinc-600">world</span>{' '}
            <span className="font-mono text-zinc-200">{p.reputation.world.toLocaleString()}</span>
          </p>
        )}
      </div>

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
