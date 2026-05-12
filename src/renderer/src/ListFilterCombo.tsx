import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

const MAX_LIST = 400

type Props = {
  items: string[]
  value: string
  onChange: (next: string) => void
  /** Shown when `items` is empty (e.g. database not loaded). */
  emptyPlaceholder: string
  /** Shown when there is a list to pick from. */
  filledPlaceholder?: string
}

/**
 * Type-to-filter combobox with scrollable dropdown (same interaction as club filter).
 */
export function ListFilterCombo({
  items,
  value,
  onChange,
  emptyPlaceholder,
  filledPlaceholder = 'Type to filter, pick from list, Tab completes match',
}: Props) {
  const [open, setOpen] = useState(false)
  const blurT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  const filtered = useMemo(() => {
    if (!items.length) return []
    if (!lower) return items.slice(0, MAX_LIST)
    const out: string[] = []
    for (const c of items) {
      if (c.toLowerCase().includes(lower)) {
        out.push(c)
        if (out.length >= MAX_LIST) break
      }
    }
    return out
  }, [items, lower])

  const suggestion = useMemo(() => {
    if (!filtered.length) return null
    if (!trimmed) return filtered[0] ?? null
    const starts = filtered.find((c) => c.toLowerCase().startsWith(lower))
    if (starts) return starts
    return filtered[0] ?? null
  }, [trimmed, lower, filtered])

  const canCompleteWithTab =
    !!suggestion && suggestion.toLowerCase() !== value.trim().toLowerCase()

  const applySuggestion = useCallback(() => {
    if (suggestion) onChange(suggestion)
  }, [suggestion, onChange])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && canCompleteWithTab) {
      e.preventDefault()
      applySuggestion()
      return
    }
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown' && filtered.length) {
      e.preventDefault()
      setOpen(true)
    }
  }

  useEffect(() => {
    return () => {
      if (blurT.current != null) window.clearTimeout(blurT.current)
    }
  }, [])

  const listVisible = open && items.length > 0

  return (
    <div className="relative">
      <input
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100 outline-none focus:border-emerald-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurT.current = window.setTimeout(() => setOpen(false), 150)
        }}
        onKeyDown={onKeyDown}
        placeholder={items.length ? filledPlaceholder : emptyPlaceholder}
        autoComplete="off"
        spellCheck={false}
      />
      {canCompleteWithTab && suggestion && (
        <p className="mt-1 truncate text-[10px] text-zinc-500" title={suggestion}>
          Suggest <span className="font-medium text-zinc-400">{suggestion}</span> — Tab to insert (never auto-applied)
        </p>
      )}
      {listVisible && (
        <ul
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950 py-1 shadow-xl cm-scroll"
          role="listbox"
        >
          {filtered.map((c) => (
            <li key={c} role="option">
              <button
                type="button"
                className="block w-full truncate px-2 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (blurT.current != null) window.clearTimeout(blurT.current)
                  onChange(c)
                  setOpen(false)
                }}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
