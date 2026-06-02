import { useCallback, useEffect, useRef, useState } from 'react'
import { PREFERENCES_SLOT_NONE } from '../../../shared/preferencesEditor'

type ClubRow = { id: number; name: string }
type StaffRow = { staffId: number; name: string }

type Props = {
  slotLabel: string
  entity: 'club' | 'staff'
  value: number
  displayLabel: string
  loadInfo: boolean
  disabled?: boolean
  onChange: (id: number, label: string) => void
}

export function PreferenceSlotPicker({
  slotLabel,
  entity,
  value,
  displayLabel,
  loadInfo,
  disabled,
  onChange,
}: Props) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const seqRef = useRef(0)
  const blurRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 120)
    return () => window.clearTimeout(id)
  }, [q])

  const loadSuggestions = useCallback(async () => {
    if (!loadInfo || debouncedQ.length < 2) {
      setClubs([])
      setStaff([])
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    try {
      if (entity === 'club' && typeof window.cmapi?.getClubRows === 'function') {
        const out = await window.cmapi.getClubRows({ q: debouncedQ, offset: 0, limit: 25 })
        if (seq !== seqRef.current) return
        setClubs((out.rows ?? []) as ClubRow[])
        setStaff([])
      } else if (entity === 'staff' && typeof window.cmapi?.getStaffRows === 'function') {
        const out = await window.cmapi.getStaffRows({
          q: debouncedQ,
          offset: 0,
          limit: 25,
          includePlayers: true,
        })
        if (seq !== seqRef.current) return
        setStaff(
          ((out.rows ?? []) as { staffId: number; name: string }[]).map((r) => ({
            staffId: r.staffId,
            name: r.name,
          })),
        )
        setClubs([])
      }
    } catch {
      if (seq === seqRef.current) {
        setClubs([])
        setStaff([])
      }
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [loadInfo, debouncedQ, entity])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  const clear = () => {
    onChange(PREFERENCES_SLOT_NONE, 'None')
    setQ('')
    setMenuOpen(false)
  }

  return (
    <label className="flex flex-col gap-0.5">
      <span className="editor-field-label">{slotLabel}</span>
      <div className="relative rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
        <p className="truncate text-xs text-zinc-200" title={displayLabel}>
          {displayLabel}
          {value > 0 && value !== PREFERENCES_SLOT_NONE ? (
            <span className="ml-1 font-mono text-[10px] text-zinc-500">#{value}</span>
          ) : null}
        </p>
        <div className="relative mt-1">
          <input
            type="text"
            disabled={disabled}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600 disabled:opacity-40"
            placeholder={entity === 'club' ? 'Search club…' : 'Search staff…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (blurRef.current) window.clearTimeout(blurRef.current)
              setMenuOpen(true)
            }}
            onBlur={() => {
              blurRef.current = window.setTimeout(() => setMenuOpen(false), 150)
            }}
          />
          {loading && (
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
              …
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
          onClick={clear}
        >
          Clear (none)
        </button>
        {menuOpen && (clubs.length > 0 || staff.length > 0) && (
          <ul className="absolute z-20 mt-0.5 max-h-36 w-full overflow-y-auto rounded border border-zinc-700 bg-zinc-900 py-0.5 shadow-lg cm-scroll">
            {entity === 'club'
              ? clubs.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(c.id, c.name)
                        setQ('')
                        setMenuOpen(false)
                      }}
                    >
                      {c.name}
                    </button>
                  </li>
                ))
              : staff.map((s) => (
                  <li key={s.staffId}>
                    <button
                      type="button"
                      className="w-full px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-zinc-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(s.staffId, s.name)
                        setQ('')
                        setMenuOpen(false)
                      }}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
          </ul>
        )}
      </div>
    </label>
  )
}
