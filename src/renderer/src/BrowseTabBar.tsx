type BrowseTabId =
  | 'players'
  | 'regens'
  | 'staff'
  | 'shortlists'
  | 'clubs'
  | 'tactics'
  | 'editor'

const TABS: { id: BrowseTabId; label: string }[] = [
  { id: 'players', label: 'All players' },
  { id: 'regens', label: 'Regens' },
  { id: 'staff', label: 'Staff' },
  { id: 'shortlists', label: 'Shortlists' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'tactics', label: 'Tactics' },
  { id: 'editor', label: 'Editor' },
]

type Props = {
  active: BrowseTabId
  onChange: (tab: BrowseTabId) => void
}

export function BrowseTabBar({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Browse</span>
      <div
        className="flex flex-wrap gap-0.5 rounded-full border border-zinc-800/90 bg-zinc-950/60 p-0.5"
        role="tablist"
        aria-label="Browse"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active === t.id
                ? 'bg-zinc-700/90 text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export type { BrowseTabId }
