import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StaffBrowseFilter } from '../../main/staffBrowse'
import { staffIsBoardRole } from '../../shared/cm0102StaffHiddenDisplay'
import { staffJobForClubLabel } from '../../shared/staffJobCatalog'
import { StaffBrowsePanel } from './StaffBrowsePanel'

export type StaffEditorSnapshot = {
  staffIndex: number
  staffId: number
  name: string
  jobForClub: number
  nonPlayerRowIndex: number | null
  values: Record<string, number>
}

const FIELD_LABELS: Record<string, string> = {
  resources: 'Resources (sugar daddy)',
  business: 'Business',
  interference: 'Interference',
  patience: 'Patience',
  free_kicks: 'Set pieces',
}

const GROUPS: { title: string; keys: string[]; boardHighlight?: boolean }[] = [
  {
    title: 'Chairman / Managing director',
    boardHighlight: true,
    keys: ['business', 'resources', 'interference', 'patience'],
  },
  { title: 'Coaching', keys: ['coaching', 'coaching_gks', 'coaching_technique', 'physiotherapy', 'youngsters'] },
  {
    title: 'Tactics',
    keys: ['tactics', 'directness', 'pressing', 'marking', 'offside', 'free_roles'],
  },
  {
    title: 'Mental / man management',
    keys: ['motivating', 'man_handling', 'discipline', 'judgement', 'judging_potential'],
  },
  { title: 'Reputation / ability', keys: ['current_ability', 'potential_ability', 'home_reputation', 'current_reputation', 'world_reputation'] },
  { title: 'Other', keys: ['attacking'] },
]

function labelForKey(k: string): string {
  if (FIELD_LABELS[k]) return FIELD_LABELS[k]
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StaffEditorPanel({
  loadInfo,
  compressed,
  browseFilter,
  staffIndex,
  onSelectStaff,
}: {
  loadInfo: boolean
  compressed: boolean
  browseFilter: StaffBrowseFilter
  staffIndex: number | null
  onSelectStaff: (index: number | null) => void
}) {
  const [snap, setSnap] = useState<StaffEditorSnapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Record<string, number> | null>(null)

  useEffect(() => {
    setSaveMsg(null)
    setErr(null)
    if (!loadInfo || staffIndex == null || typeof window.cmapi?.getStaffEditorSnapshot !== 'function') {
      setSnap(null)
      setDraft({})
      baselineRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    void window.cmapi
      .getStaffEditorSnapshot(staffIndex)
      .then((r) => {
        if (cancelled) return
        if (!r || !('values' in r)) {
          setSnap(null)
          setErr('No non-player row for this staff member.')
          return
        }
        const s = r as StaffEditorSnapshot
        setSnap(s)
        baselineRef.current = { ...s.values }
        const d: Record<string, string> = {}
        for (const [k, v] of Object.entries(s.values)) d[k] = String(v)
        setDraft(d)
        setErr(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadInfo, staffIndex])

  const hasChanges = useMemo(() => {
    const base = baselineRef.current
    if (!base) return false
    for (const key of Object.keys(base)) {
      const n = Number(draft[key])
      if (Number.isFinite(n) && Math.trunc(n) !== base[key]) return true
    }
    return false
  }, [draft])

  const onSave = useCallback(async () => {
    if (!snap || compressed || typeof window.cmapi?.saveStaffEdits !== 'function') return
    const base = baselineRef.current
    if (!base) return
    const changes: Record<string, number> = {}
    for (const key of Object.keys(base)) {
      const n = Number(draft[key])
      if (Number.isFinite(n) && Math.trunc(n) !== base[key]) changes[key] = Math.trunc(n)
    }
    if (Object.keys(changes).length === 0) return
    setSaving(true)
    setErr(null)
    try {
      const out = await window.cmapi.saveStaffEdits(snap.staffIndex, changes)
      if (out && 'ok' in out && out.ok && 'path' in out) {
        setSaveMsg(`Saved to ${out.path}`)
        baselineRef.current = { ...base, ...changes }
      } else if (out && 'error' in out) {
        setErr(out.error === 'cancelled' ? 'Save cancelled.' : String(out.error))
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [compressed, draft, snap])

  if (!loadInfo) return <p className="text-sm text-zinc-500">Load a database first.</p>
  if (compressed) {
    return (
      <p className="text-sm text-amber-200/90">
        Staff editing requires an uncompressed save (Game Settings → Save Compressed = No).
      </p>
    )
  }

  const isBoard = snap != null && staffIsBoardRole(snap.jobForClub)

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2
          className="text-lg font-semibold text-zinc-100"
          title="Edits nonplayer.dat for the selected staff row. Chairman = job 1, Managing director = job 2."
        >
          Staff / non-player editor
        </h2>
        {!staffIndex && (
          <p className="mt-1 text-xs text-zinc-500">
            Select a staff member from the list to edit their non-player profile.
          </p>
        )}
        {loading && staffIndex != null && <p className="mt-1 text-xs text-zinc-500">Loading…</p>}
        {err && !snap && staffIndex != null && <p className="mt-1 text-xs text-rose-300/90">{err}</p>}
      </div>

      <div className="cm-scroll min-h-[24rem] overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-2">
        <StaffBrowsePanel
          loadInfo={loadInfo}
          filter={browseFilter}
          selectedStaffIndex={staffIndex}
          onSelectStaff={onSelectStaff}
          onOpenPlayerProfile={() => {}}
        />
      </div>

      {snap && (
        <div className="cm-scroll space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3">
          <div>
            <p className="text-base font-semibold text-emerald-200/95">{snap.name}</p>
            <p className="text-xs text-zinc-500">
              {staffJobForClubLabel(snap.jobForClub)}
              <span className="text-zinc-600"> · </span>
              nonplayer row <span className="font-mono">{snap.nonPlayerRowIndex ?? '—'}</span>
            </p>
          </div>
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3
                className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                  g.boardHighlight && isBoard ? 'text-amber-200/90' : 'text-zinc-500'
                }`}
              >
                {g.title}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.keys.map((k) =>
                  k in snap.values ? (
                    <label
                      key={k}
                      className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        {labelForKey(k)}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-xs text-zinc-100"
                        value={draft[k] ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                      />
                    </label>
                  ) : null,
                )}
              </div>
            </section>
          ))}
          <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <button
              type="button"
              disabled={!hasChanges || saving}
              onClick={() => void onSave()}
              className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save copy…'}
            </button>
            {saveMsg && <span className="text-xs text-zinc-400">{saveMsg}</span>}
            {err && <span className="text-xs text-rose-300/90">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
