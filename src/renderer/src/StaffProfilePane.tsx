import type { StaffProfilePayload } from './vite-env.d'

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

function AttrGrid({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="truncate text-zinc-500" title={r.label}>
              {r.label}
            </dt>
            <dd className="font-mono text-zinc-200">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function StaffProfilePane({ p }: { p: StaffProfilePayload }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-zinc-800/80 pb-3">
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
        <p className="mt-1 text-xs text-zinc-400">
          Determination <span className="font-mono text-zinc-200">{p.determination}</span>
        </p>
      </div>

      <AttrGrid title="Staff attributes" rows={p.staffMentals} />

      {p.nonPlayer && (
        <>
          <AttrGrid title="Backroom profile (nonplayer.dat)" rows={p.nonPlayer.coachingAttrs} />
          <AttrGrid title="Position / formation preferences" rows={p.nonPlayer.positionPrefs} />
        </>
      )}

      {!p.nonPlayer && (
        <p className="text-[11px] text-zinc-500">No linked backroom coaching profile for this person.</p>
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
            <dt>Type (raw)</dt>
            <dd className="font-mono text-zinc-200">{p.contract.type}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
