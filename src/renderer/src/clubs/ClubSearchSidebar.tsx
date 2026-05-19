import type { ClubListRow } from '../ClubBrowsePanel'

type Props = {
  loadInfo: boolean
  q: string
  debouncedQ: string
  suggestions: ClubListRow[]
  selId: number | null
  loadingSuggest: boolean
  err: string | null
  menuOpen: boolean
  onInputChange: (next: string) => void
  onInputFocus: () => void
  onInputBlur: () => void
  onPickClub: (c: ClubListRow) => void
}

export function ClubSearchSidebar({
  loadInfo,
  q,
  debouncedQ,
  suggestions,
  selId,
  loadingSuggest,
  err,
  menuOpen,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onPickClub,
}: Props) {
  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  const showSuggestPanel = menuOpen && debouncedQ.length > 0 && suggestions.length > 0

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-zinc-500">
        Search by club name, then pick a row. Squad players open in the profile pane on the right.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Search club</span>
        <div className="relative">
          <input
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 pr-8 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
            value={q}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            placeholder="Type a club name…"
            spellCheck={false}
            autoComplete="off"
          />
          {loadingSuggest && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
              …
            </span>
          )}
        </div>
      </label>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      {debouncedQ && !loadingSuggest && suggestions.length === 0 && !err && (
        <p className="text-[11px] text-zinc-500">No clubs match that text.</p>
      )}
      {showSuggestPanel && (
        <ul className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950/80 py-0.5 cm-scroll" role="listbox">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={selId === c.id}
                className={`flex w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left text-xs transition hover:bg-zinc-800/80 ${
                  selId === c.id ? 'bg-emerald-950/30 text-emerald-100' : 'text-zinc-300'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPickClub(c)}
              >
                <span className="font-medium text-zinc-100">{c.name}</span>
                <span className="text-[10px] text-zinc-500">
                  {c.nation} · {c.division}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!debouncedQ && (
        <p className="text-[11px] text-zinc-600">Start typing to see matching clubs from the loaded save.</p>
      )}
    </div>
  )
}
