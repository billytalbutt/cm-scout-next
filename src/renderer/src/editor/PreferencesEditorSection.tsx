import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PreferencesEditorValues } from '../../../shared/preferencesEditor'
import {
  PREFERENCES_SLOT_NONE,
  normalizePreferenceSlotId,
  preferencesValuesEqual,
} from '../../../shared/preferencesEditor'
import { PreferenceSlotPicker } from './PreferenceSlotPicker'

export type PreferencesEditorSnapshot = {
  staffIndex: number
  name: string
  staffDatId: number
  staffPreferencesId: number
  hasRow: boolean
  rowCount: number
  values: PreferencesEditorValues
  labels: {
    favouriteClubs: [string, string, string]
    dislikedClubs: [string, string, string]
    favouriteStaff: [string, string, string]
    dislikedStaff: [string, string, string]
  }
}

type SlotLabels = PreferencesEditorSnapshot['labels']

function cloneValues(v: PreferencesEditorValues): PreferencesEditorValues {
  return {
    favouriteClubs: [...v.favouriteClubs] as [number, number, number],
    dislikedClubs: [...v.dislikedClubs] as [number, number, number],
    favouriteStaff: [...v.favouriteStaff] as [number, number, number],
    dislikedStaff: [...v.dislikedStaff] as [number, number, number],
  }
}

function cloneLabels(l: SlotLabels): SlotLabels {
  return {
    favouriteClubs: [...l.favouriteClubs] as [string, string, string],
    dislikedClubs: [...l.dislikedClubs] as [string, string, string],
    favouriteStaff: [...l.favouriteStaff] as [string, string, string],
    dislikedStaff: [...l.dislikedStaff] as [string, string, string],
  }
}

function PreferenceGroup({
  title,
  entity,
  ids,
  labels,
  loadInfo,
  disabled,
  onSlot,
}: {
  title: string
  entity: 'club' | 'staff'
  ids: [number, number, number]
  labels: [string, string, string]
  loadInfo: boolean
  disabled?: boolean
  onSlot: (index: 0 | 1 | 2, id: number, label: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="editor-field-label">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {([0, 1, 2] as const).map((i) => (
          <PreferenceSlotPicker
            key={i}
            slotLabel={`${i + 1}`}
            entity={entity}
            value={ids[i]}
            displayLabel={labels[i]}
            loadInfo={loadInfo}
            disabled={disabled}
            onChange={(id, label) => onSlot(i, id, label)}
          />
        ))}
      </div>
    </div>
  )
}

export function PreferencesEditorSection({
  loadInfo,
  compressed,
  staffIndex,
  refreshKey,
  onDraftChange,
}: {
  loadInfo: boolean
  compressed: boolean
  staffIndex: number | null
  /** Bump after a successful save so values reload from disk. */
  refreshKey?: number
  onDraftChange: (draft: PreferencesEditorValues | null, baseline: PreferencesEditorValues | null) => void
}) {
  const [snap, setSnap] = useState<PreferencesEditorSnapshot | null>(null)
  const [draft, setDraft] = useState<PreferencesEditorValues | null>(null)
  const [labels, setLabels] = useState<SlotLabels | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const baselineRef = useRef<PreferencesEditorValues | null>(null)

  useEffect(() => {
    onDraftChange(draft, baselineRef.current)
  }, [draft, onDraftChange])

  useEffect(() => {
    if (!loadInfo || staffIndex == null || typeof window.cmapi?.getPreferencesEditorSnapshot !== 'function') {
      setSnap(null)
      setDraft(null)
      setLabels(null)
      baselineRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    void window.cmapi
      .getPreferencesEditorSnapshot(staffIndex)
      .then((r) => {
        if (cancelled) return
        if (!r || typeof r !== 'object') {
          setSnap(null)
          setDraft(null)
          baselineRef.current = null
          return
        }
        if ('error' in r && typeof (r as { error: string }).error === 'string') {
          setErr((r as { error: string }).error)
          setSnap(null)
          setDraft(null)
          baselineRef.current = null
          return
        }
        const s = r as PreferencesEditorSnapshot
        setSnap(s)
        const base = cloneValues(s.values)
        baselineRef.current = base
        setDraft(base)
        setLabels(cloneLabels(s.labels))
        setErr(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadInfo, staffIndex, refreshKey])

  const setClubSlot = useCallback(
    (key: 'favouriteClubs' | 'dislikedClubs', index: 0 | 1 | 2, id: number, label: string) => {
      setDraft((prev) => {
        if (!prev) return prev
        const next = cloneValues(prev)
        next[key][index] = normalizePreferenceSlotId(id)
        return next
      })
      setLabels((prev) => {
        if (!prev) return prev
        const next = cloneLabels(prev)
        next[key][index] = label
        return next
      })
    },
    [],
  )

  const setStaffSlot = useCallback(
    (key: 'favouriteStaff' | 'dislikedStaff', index: 0 | 1 | 2, id: number, label: string) => {
      setDraft((prev) => {
        if (!prev) return prev
        const next = cloneValues(prev)
        next[key][index] = normalizePreferenceSlotId(id)
        return next
      })
      setLabels((prev) => {
        if (!prev) return prev
        const next = cloneLabels(prev)
        next[key][index] = label
        return next
      })
    },
    [],
  )

  const hasChanges = useMemo(() => {
    const base = baselineRef.current
    if (!draft || !base) return false
    return !preferencesValuesEqual(draft, base)
  }, [draft])

  if (!loadInfo || staffIndex == null) return null

  if (compressed) {
    return (
      <p className="text-sm text-zinc-500">
        Preferences editing needs an uncompressed save (Game Settings → Save Compressed = No).
      </p>
    )
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading preferences…</p>
  if (err) return <p className="text-sm text-rose-300/90">{err}</p>
  if (!snap || !draft || !labels) return null

  const disabled = !snap.hasRow

  return (
    <section className="space-y-4 border-t border-zinc-800 pt-4">
      <div>
        <h3 className="panel-section-title">Preferences</h3>
        <p className="mt-1 text-[11px] text-zinc-400">
          Favourite and disliked clubs / staff (same as Graeme Kelly editor → Prefs). Saved with{' '}
          <strong className="text-zinc-300">Save copy</strong> above. Use{' '}
          <strong className="text-zinc-300">Clear unhappiness on save</strong> to wipe dislikes only.
        </p>
        {!snap.hasRow && (
          <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
            No Preferences.dat row linked to this player yet — CM may need to generate one in-game before
            slots can be edited here.
          </p>
        )}
        {snap.rowCount > 1 && (
          <p className="mt-1 text-[10px] text-zinc-500">
            {snap.rowCount} duplicate preference rows on disk — all are updated together on save.
          </p>
        )}
        {hasChanges && (
          <p className="mt-1 text-[10px] text-emerald-200/80">Preferences modified — include in next save.</p>
        )}
      </div>

      <div className="space-y-4 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-3">
        <PreferenceGroup
          title="Favourite clubs"
          entity="club"
          ids={draft.favouriteClubs}
          labels={labels.favouriteClubs}
          loadInfo={loadInfo}
          disabled={disabled}
          onSlot={(i, id, label) => setClubSlot('favouriteClubs', i, id, label)}
        />
        <PreferenceGroup
          title="Disliked clubs"
          entity="club"
          ids={draft.dislikedClubs}
          labels={labels.dislikedClubs}
          loadInfo={loadInfo}
          disabled={disabled}
          onSlot={(i, id, label) => setClubSlot('dislikedClubs', i, id, label)}
        />
        <PreferenceGroup
          title="Favourite staff"
          entity="staff"
          ids={draft.favouriteStaff}
          labels={labels.favouriteStaff}
          loadInfo={loadInfo}
          disabled={disabled}
          onSlot={(i, id, label) => setStaffSlot('favouriteStaff', i, id, label)}
        />
        <PreferenceGroup
          title="Disliked staff"
          entity="staff"
          ids={draft.dislikedStaff}
          labels={labels.dislikedStaff}
          loadInfo={loadInfo}
          disabled={disabled}
          onSlot={(i, id, label) => setStaffSlot('dislikedStaff', i, id, label)}
        />
      </div>
      <p className="text-[10px] text-zinc-500">
        Link id {snap.staffPreferencesId > 0 ? snap.staffPreferencesId : '—'} · staff.dat #{snap.staffDatId}
      </p>
    </section>
  )
}
