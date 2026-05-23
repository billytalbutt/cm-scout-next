import type { ClubListRow } from '../ClubBrowsePanel'
import type { ClubFavoriteEntry } from '../../../shared/clubFavoritesTypes'

type Props = {
  loadInfo: boolean
  q: string
  debouncedQ: string
  suggestions: ClubListRow[]
  selId: number | null
  selectedClub?: ClubListRow | null
  loadingSuggest: boolean
  err: string | null
  menuOpen: boolean
  /** Clubs tab only — editor uses search without favourites. */
  showFavorites?: boolean
  favorites?: ClubFavoriteEntry[]
  isFavorite?: (clubId: number) => boolean
  onToggleFavorite?: (club: ClubListRow) => void
  onRemoveFavorite?: (clubId: number) => void
  onInputChange: (next: string) => void
  onInputFocus: () => void
  onInputBlur: () => void
  onPickClub: (c: ClubListRow) => void
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-3.5 w-3.5 shrink-0 ${filled ? 'text-zinc-300' : 'text-zinc-600'}`}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 1.5l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L10 1.5z" />
    </svg>
  )
}

export function ClubSearchSidebar({
  loadInfo,
  q,
  debouncedQ,
  suggestions,
  selId,
  selectedClub,
  loadingSuggest,
  err,
  menuOpen,
  showFavorites = true,
  favorites = [],
  isFavorite = () => false,
  onToggleFavorite = () => {},
  onRemoveFavorite = () => {},
  onInputChange,
  onInputFocus,
  onInputBlur,
  onPickClub,
}: Props) {
  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  const showSuggestPanel = menuOpen && debouncedQ.length > 0 && suggestions.length > 0
  const favActive = showFavorites && selectedClub != null && isFavorite(selectedClub.id)

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-snug text-zinc-500">
        Search by club name, then pick a row. Use Squad or Staff tabs; click a row to open their profile on the right.
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

      {showFavorites && selectedClub && !favActive && (
        <button
          type="button"
          onClick={() => onToggleFavorite(selectedClub)}
          className="flex w-full items-center gap-2 rounded-md border border-zinc-700/90 bg-zinc-900/50 px-2.5 py-2 text-left text-xs text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <StarIcon filled={false} />
          <span>
            Add <span className="font-medium text-zinc-200">{selectedClub.name}</span> to favourites
          </span>
        </button>
      )}

      {showFavorites && (
      <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/40">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-2.5 py-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Favourites</h3>
          {favorites.length > 0 && (
            <span className="font-mono text-[10px] text-zinc-600">{favorites.length}</span>
          )}
        </div>
        {favorites.length === 0 ? (
          <p className="px-2.5 py-3 text-[11px] leading-snug text-zinc-600">
            Search for a club, then add it here for quick access.
          </p>
        ) : (
          <ul className="max-h-48 overflow-y-auto py-1 cm-scroll" role="list">
            {favorites.map((c) => {
              const active = selId === c.id
              return (
                <li key={c.id} className="group flex items-stretch gap-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => onPickClub(c)}
                    className={`min-w-0 flex-1 rounded-sm border-l-2 px-2 py-1.5 text-left transition ${
                      active
                        ? 'border-zinc-400 bg-zinc-800/90 text-zinc-100'
                        : 'border-transparent text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <StarIcon filled />
                      <span className="truncate font-medium">{c.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                      {c.nation} · {c.division}
                    </span>
                  </button>
                  <button
                    type="button"
                    title={`Remove ${c.name} from favourites`}
                    onClick={() => onRemoveFavorite(c.id)}
                    className="shrink-0 self-center rounded px-1.5 py-1 text-[10px] text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      )}

      {err && <p className="text-xs text-rose-300">{err}</p>}
      {debouncedQ && !loadingSuggest && suggestions.length === 0 && !err && (
        <p className="text-[11px] text-zinc-500">No clubs match that text.</p>
      )}
      {showSuggestPanel && (
        <ul
          className="max-h-[min(40vh,24rem)] overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950/80 py-0.5 cm-scroll"
          role="listbox"
        >
          {suggestions.map((c) => (
            <li key={c.id} className="group flex items-stretch">
              <button
                type="button"
                role="option"
                aria-selected={selId === c.id}
                className={`min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2 text-left text-xs transition hover:bg-zinc-800/80 ${
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
              {showFavorites && (
                <button
                  type="button"
                  title={isFavorite(c.id) ? 'Remove from favourites' : 'Add to favourites'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onToggleFavorite(c)}
                  className="shrink-0 self-center px-2 py-2 opacity-70 transition hover:opacity-100"
                >
                  <StarIcon filled={isFavorite(c.id)} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!debouncedQ && showFavorites && !favorites.length && (
        <p className="text-[11px] text-zinc-600">Start typing to see matching clubs from the loaded save.</p>
      )}
    </div>
  )
}
