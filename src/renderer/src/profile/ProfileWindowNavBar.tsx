import { useCallback, useEffect, useState } from 'react'

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

  const refreshNav = useCallback(async () => {
    const s = await window.cmapi?.profileWindowNavState?.()
    if (s?.ok && s.hasNav) {
      setNav({ index: s.index, total: s.total, source: s.source })
    } else {
      setNav(null)
    }
  }, [])

  useEffect(() => {
    void refreshNav()
  }, [staffIndex, refreshNav])

  const step = async (direction: 'next' | 'prev') => {
    const r = await window.cmapi?.profileWindowNavigate?.(direction)
    if (r?.ok) onStaffIndexChange(r.staffIndex)
  }

  if (!nav || nav.total < 2) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2">
      <p className="text-[10px] text-zinc-500">
        {kind === 'player' ? 'Player' : 'Staff'} profile · {nav.source}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
          onClick={() => void step('prev')}
        >
          ← Previous
        </button>
        <span className="font-mono text-[11px] tabular-nums text-zinc-400">
          {nav.index + 1} / {nav.total}
        </span>
        <button
          type="button"
          className="rounded-md border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
          onClick={() => void step('next')}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
