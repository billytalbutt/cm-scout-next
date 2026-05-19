import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { GRID_COLUMN_CATALOG } from '../../../shared/gridColumnCatalog'

type Props = {
  open: boolean
  onClose: () => void
  /** Visible column ids in left-to-right order */
  columnOrder: string[]
  onApply: (nextOrder: string[]) => void
}

export function GridColumnPickerModal({ open, onClose, columnOrder, onApply }: Props) {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<string[]>(columnOrder)

  useEffect(() => {
    if (open) setDraft(columnOrder)
  }, [open, columnOrder])

  const selected = useMemo(() => new Set(draft), [draft])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return GRID_COLUMN_CATALOG
    return GRID_COLUMN_CATALOG.filter((e) => e.label.toLowerCase().includes(s) || e.id.toLowerCase().includes(s))
  }, [q])

  const byGroup = useMemo(() => {
    const m = new Map<string, typeof GRID_COLUMN_CATALOG>()
    for (const e of filtered) {
      const g = e.group
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(e)
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  if (!open) return null

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const body = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grid-col-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[min(36rem,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 id="grid-col-picker-title" className="text-sm font-semibold text-white">
            Grid columns
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <p className="shrink-0 border-b border-zinc-800/80 px-4 py-2 text-[11px] leading-relaxed text-zinc-500">
          Choose which data columns appear (like CM Scout). Extra blocks (all attributes, contract detail, role %)
          are only sent when needed so the list stays fast. Tick to show; untick to hide.
        </p>
        <div className="shrink-0 border-b border-zinc-800 px-4 py-2">
          <input
            type="search"
            placeholder="Filter by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-600"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 cm-scroll">
          {byGroup.map(([group, entries]) => (
            <div key={group} className="mb-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group}</h3>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {entries.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900/80">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="shrink-0"
                      />
                      <span className="truncate">{e.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null
}
