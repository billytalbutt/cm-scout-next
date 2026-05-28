import { useCallback, useEffect, useState } from 'react'

const NAV_BTN =
  'rounded-md border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40'

const SOURCE_LABEL: Record<string, string> = {
  grid: 'Player list',
  shortlist: 'Shortlist',
  club_squad: 'Club squad',
  development: 'Development',
}

export function ProfileWindowNavBar({
  kind,
  staffIndex,
  onStaffIndexChange,
}: {
  kind: 'player' | 'staff'
  staffIndex: number
  onStaffIndexChange: (next: number) => void
}) {
  const [nav, setNav] = useState<{
    index: number
    total: number
    source: string
  } | null>(null)
  const [stepping, setStepping] = useState(false)

  const refreshNav = useCallback(async () => {
    const s = await window.cmapi?.profileWindowNavState?.(staffIndex)
    if (s?.ok && s.hasNav) {
      setNav({ index: s.index, total: s.total, source: s.source })
    } else {
      setNav(null)
    }
  }, [staffIndex])

  useEffect(() => {
    void refreshNav()
  }, [staffIndex, refreshNav])

  const step = useCallback(
    async (direction: 'next' | 'prev') => {
      if (stepping) return
      setStepping(true)
      try {
        const r = await window.cmapi?.profileWindowNavigate?.(direction, staffIndex)
        if (r?.ok) onStaffIndexChange(r.staffIndex)
      } finally {
        setStepping(false)
      }
    },
    [onStaffIndexChange, staffIndex, stepping],
  )

  useEffect(() => {
    if (kind !== 'player' || !nav || nav.total < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, button')) return
      e.preventDefault()
      void step(e.key === 'ArrowRight' ? 'next' : 'prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kind, nav, step])

  if (kind !== 'player' || !nav || nav.total < 2) return null

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2 backdrop-blur-sm">
      <p className="text-[10px] text-zinc-500">{SOURCE_LABEL[nav.source] ?? 'List'}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={NAV_BTN}
          disabled={stepping}
          onClick={() => void step('prev')}
        >
          ← Previous
        </button>
        <span className="font-mono text-[11px] tabular-nums text-zinc-400">
          {nav.index + 1} / {nav.total}
        </span>
        <button
          type="button"
          className={NAV_BTN}
          disabled={stepping}
          onClick={() => void step('next')}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
