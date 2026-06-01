import type { GridPlayerRow } from '../../../shared/gridTypes'

type Props = {
  rows: GridPlayerRow[]
  newStaffIds: string[]
  onMarkSeen: () => void
  onSelectStaffIndex: (staffIndex: number) => void
}

const MAX_SHOW = 8

export function RegenNewSinceLastCheck({ rows, newStaffIds, onMarkSeen, onSelectStaffIndex }: Props) {
  if (newStaffIds.length === 0) return null

  const byId = new Map(rows.filter((r) => r.staffIndex != null).map((r) => [String(r.staffId ?? ''), r]))
  const picks = newStaffIds
    .map((id) => byId.get(id))
    .filter((r): r is GridPlayerRow => !!r)
    .slice(0, MAX_SHOW)

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-300">
            New since last check
            <span className="ml-1.5 font-mono text-zinc-500">({newStaffIds.length})</span>
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
            Likely regens detected since you last marked this save as reviewed.
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkSeen}
          className="shrink-0 rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700"
        >
          Mark all seen
        </button>
      </div>
      <ul className="mt-2.5 space-y-1">
        {picks.map((r) => (
          <li key={r.staffId ?? r.name}>
            <button
              type="button"
              onClick={() => r.staffIndex != null && onSelectStaffIndex(r.staffIndex)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-900/80"
            >
              <span className="min-w-0 truncate font-medium">{r.name}</span>
              <span className="shrink-0 text-[10px] text-zinc-500">
                {r.regenOf ? (
                  <>
                    of <span className="text-zinc-400">{r.regenOf}</span>
                  </>
                ) : (
                  'Likely regen'
                )}
              </span>
            </button>
          </li>
        ))}
        {newStaffIds.length > MAX_SHOW && (
          <li className="px-2 py-0.5 text-[10px] text-zinc-500">
            +{newStaffIds.length - MAX_SHOW} more in the grid below
          </li>
        )}
      </ul>
    </div>
  )
}
