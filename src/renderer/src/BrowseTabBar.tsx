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
    <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="tablist" aria-label="Browse pages">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`pill-tab ${active === t.id ? 'pill-tab-active' : 'pill-tab-inactive'}`}
          >
            {t.label}
          </button>
        ))}
    </div>
  )
}

export type { BrowseTabId }
