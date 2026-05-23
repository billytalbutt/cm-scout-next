import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  EDITOR_HIDDEN_ORDER,
  EDITOR_MAIN_ATTR_COLS,
  EDITOR_POSITION_KEYS,
  editorAttrLabel,
} from '../../shared/attributeEditorOrder'
import {
  getEditorFieldGamePreview,
  type EditorFieldGamePreview,
} from '../../shared/editorFieldGamePreview'
import {
  getCopiedPlayerAttributes,
  setCopiedPlayerAttributes,
  subscribeCopiedPlayerAttributes,
} from '../../shared/copiedPlayerAttributes'
import { EditorPlayerPicker } from './editor/EditorPlayerPicker'

export type EditorSnapshot = {
  staffIndex: number
  staffId: number
  name: string
  playerRow: number
  values: Record<string, number>
}

function mergeEditorNumericMap(snap: EditorSnapshot, draft: Record<string, string>): Record<string, number> {
  const out = { ...snap.values }
  for (const key of Object.keys(out)) {
    const s = draft[key]
    if (s === undefined || s === '') continue
    const n = Number(s)
    if (Number.isFinite(n)) out[key] = Math.trunc(n)
  }
  return out
}

function PreviewLines({ preview }: { preview: EditorFieldGamePreview }) {
  if (preview.kind === 'direct') {
    return (
      <p className="text-[10px] leading-snug text-zinc-500">
        CM uses this value directly <span className="font-mono text-zinc-400">({preview.inGame})</span>.
      </p>
    )
  }
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] leading-snug text-zinc-400">
        On attributes screen:{' '}
        <span className="font-mono font-semibold text-emerald-200/95">{preview.inGame}</span>
        <span className="text-zinc-600"> · 1–20 style</span>
        {preview.kind === 'ca18' && (
          <span className="text-zinc-600"> (from current CA + this raw byte; GK flips high/low mix)</span>
        )}
        {preview.kind === 'clamped' && (
          <span className="text-zinc-600"> (clamped from raw for display)</span>
        )}
      </p>
      {preview.inGameUncapped !== preview.inGame && (
        <p className="text-[10px] leading-snug text-amber-200/90" title="Same ‘engine’ bracket as profile when uncapped &gt; 20">
          Uncapped engine display: <span className="font-mono">{preview.inGameUncapped}</span>
        </p>
      )}
      {preview.inMatch != null && preview.inMatch !== preview.inGame && (
        <p className="text-[10px] leading-snug text-zinc-600">
          In-match helper (profile tooltip): <span className="font-mono text-zinc-400">{preview.inMatch}</span>
        </p>
      )}
    </div>
  )
}

function NumField({
  k,
  label,
  value,
  onChange,
  disabled,
  preview,
}: {
  k: string
  label: string
  value: string
  onChange: (key: string, v: string) => void
  disabled: boolean
  preview: EditorFieldGamePreview | null
}) {
  return (
    <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
      <span className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500" title={k}>
        {label}
      </span>
      <input
        type="number"
        disabled={disabled}
        className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-xs text-zinc-100 outline-none focus:border-emerald-600 disabled:opacity-40"
        value={value}
        onChange={(e) => onChange(k, e.target.value)}
      />
      {preview != null && (
        <div className="mt-1 border-t border-zinc-800/60 pt-1">
          <PreviewLines preview={preview} />
        </div>
      )}
    </label>
  )
}

export function AttributeEditorPanel({
  loadInfo,
  compressed,
  staffIndex,
}: {
  loadInfo: boolean
  compressed: boolean
  staffIndex: number | null
}) {
  const [snap, setSnap] = useState<EditorSnapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedAttrs, setCopiedAttrs] = useState(getCopiedPlayerAttributes)
  const [searchedStaffIndex, setSearchedStaffIndex] = useState<number | null>(null)
  const baselineRef = useRef<Record<string, number> | null>(null)
  const effectiveStaffIndex = searchedStaffIndex ?? staffIndex

  useEffect(() => subscribeCopiedPlayerAttributes(() => setCopiedAttrs(getCopiedPlayerAttributes())), [])

  useEffect(() => {
    setSearchedStaffIndex(null)
  }, [staffIndex])

  useEffect(() => {
    setSaveMsg(null)
    setErr(null)
    if (!loadInfo || effectiveStaffIndex == null || typeof window.cmapi?.getEditorSnapshot !== 'function') {
      setSnap(null)
      setDraft({})
      baselineRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    void window.cmapi
      .getEditorSnapshot(effectiveStaffIndex)
      .then((r) => {
        if (cancelled) return
        if (!r || typeof r !== 'object' || !('values' in r)) {
          setSnap(null)
          setDraft({})
          baselineRef.current = null
          setErr('Could not load editor data for this row (not a playable player?).')
          return
        }
        const s = r as EditorSnapshot
        setSnap(s)
        baselineRef.current = { ...s.values }
        const d: Record<string, string> = {}
        for (const [key, v] of Object.entries(s.values)) {
          d[key] = String(v)
        }
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
  }, [loadInfo, effectiveStaffIndex])

  const onField = useCallback((key: string, v: string) => {
    setDraft((prev) => ({ ...prev, [key]: v }))
  }, [])

  const copyAllAttributes = useCallback(() => {
    if (!snap) return
    setCopiedPlayerAttributes({
      staffIndex: snap.staffIndex,
      name: snap.name,
      values: { ...snap.values },
      copiedAt: Date.now(),
    })
  }, [snap])

  const pasteCopiedAttributes = useCallback(() => {
    const copied = getCopiedPlayerAttributes()
    if (!copied || !snap) return
    setDraft((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(snap.values)) {
        if (key in copied.values) next[key] = String(copied.values[key])
      }
      return next
    })
  }, [snap])

  const mergedForPreview = useMemo(() => {
    if (!snap) return null
    return mergeEditorNumericMap(snap, draft)
  }, [snap, draft])

  const previewFor = useCallback(
    (key: string): EditorFieldGamePreview | null => {
      if (!mergedForPreview) return null
      return getEditorFieldGamePreview(mergedForPreview, key)
    },
    [mergedForPreview],
  )

  const hasChanges = useMemo(() => {
    const base = baselineRef.current
    if (!base) return false
    for (const key of Object.keys(base)) {
      const cur = draft[key]
      if (cur === undefined) continue
      const n = Number(cur)
      if (!Number.isFinite(n)) return true
      if (Math.trunc(n) !== base[key]) return true
    }
    return false
  }, [draft])

  const saveDisabled = compressed || !snap || saving || !hasChanges

  const onSave = useCallback(async () => {
    if (!snap || compressed || typeof window.cmapi?.saveAttributeEdits !== 'function') return
    const base = baselineRef.current
    if (!base) return
    const changes: Record<string, number> = {}
    for (const key of Object.keys(base)) {
      const raw = draft[key]
      if (raw === undefined) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        setErr(`Invalid number for ${editorAttrLabel(key)}`)
        return
      }
      const t = Math.trunc(n)
      if (t !== base[key]) changes[key] = t
    }
    if (Object.keys(changes).length === 0) {
      setSaveMsg('No changes to save.')
      return
    }
    setSaving(true)
    setErr(null)
    setSaveMsg(null)
    try {
      const out = await window.cmapi.saveAttributeEdits(snap.staffIndex, changes)
      if (out && typeof out === 'object' && 'ok' in out && out.ok && 'path' in out) {
        setSaveMsg(`Saved to ${String((out as { path: string }).path)}`)
        baselineRef.current = { ...base, ...changes }
      } else if (out && typeof out === 'object' && 'error' in out) {
        const er = (out as { error?: string }).error
        if (er === 'cancelled') setSaveMsg('Save cancelled.')
        else setErr(er ?? 'Save failed.')
      } else setErr('Save failed.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [compressed, draft, snap])

  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database first.</p>
  }

  if (compressed) {
    return (
      <div className="max-w-xl space-y-2 text-sm text-zinc-300">
        <p className="font-medium text-amber-200/95">This archive is compressed.</p>
        <p className="text-zinc-400">
          Attribute editing only supports <strong className="text-zinc-200">uncompressed</strong> index.dat / save
          files (e.g. Game Settings → Save Compressed = No, or an uncompressed data pack such as Blackburn).
        </p>
      </div>
    )
  }

  if (effectiveStaffIndex == null) {
    return (
      <div className="max-w-xl space-y-4 text-sm text-zinc-400">
        <div className="space-y-2">
          <p className="font-medium text-zinc-200">Player attributes</p>
          <p>
            Select a row on <span className="text-zinc-300">All players</span> or{' '}
            <span className="text-zinc-300">Regens</span> (or open a profile from Staff / Clubs), or search below.
          </p>
        </div>
        <EditorPlayerPicker
          loadInfo={loadInfo}
          selectedStaffIndex={null}
          onPick={(idx) => setSearchedStaffIndex(idx)}
        />
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading editor…</p>
  }

  if (err && !snap) {
    return <p className="text-sm text-rose-300/90">{err}</p>
  }

  if (!snap) return null

  const coreKeys = [
    'squad_number',
    'current_ability',
    'potential_ability',
    'home_reputation',
    'current_reputation',
    'world_reputation',
  ] as const

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <EditorPlayerPicker
        loadInfo={loadInfo}
        selectedStaffIndex={effectiveStaffIndex}
        onPick={(idx) => setSearchedStaffIndex(idx)}
        compact
      />
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Attribute editor</h2>
          <p className="mt-1 text-xs text-zinc-500">
            <span className="font-medium text-emerald-200/90">{snap.name}</span>
            <span className="text-zinc-600"> · </span>
            staff row <span className="font-mono text-zinc-400">{snap.staffIndex}</span>
            <span className="text-zinc-600"> · </span>
            player.dat row <span className="font-mono text-zinc-400">{snap.playerRow}</span>
          </p>
          {copiedAttrs && (
            <p className="mt-1.5 text-[11px] text-sky-300/90">
              Clipboard: <span className="font-medium text-sky-100">{copiedAttrs.name}</span>
              <span className="text-zinc-600"> · </span>
              use Paste to overwrite this player&apos;s bytes
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {err && <span className="text-xs text-rose-300/90">{err}</span>}
          {saveMsg && !err && <span className="max-w-md truncate text-xs text-emerald-300/90">{saveMsg}</span>}
          <button
            type="button"
            onClick={copyAllAttributes}
            className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/60"
          >
            Copy attributes
          </button>
          <button
            type="button"
            disabled={!copiedAttrs}
            onClick={pasteCopiedAttributes}
            title={copiedAttrs ? `Paste from ${copiedAttrs.name}` : undefined}
            className="rounded-md border border-sky-700/50 bg-sky-950/40 px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Paste attributes
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() => void onSave()}
            className="rounded-md border border-emerald-600/50 bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save copy…'}
          </button>
        </div>
      </div>

      <p className="rounded-md border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        The <span className="font-mono text-zinc-300">number in the box</span> is the{' '}
        <strong className="text-zinc-300">raw on-disk byte</strong> (can be negative or above 20 in edited databases).{' '}
        <strong className="text-emerald-200/90">On attributes screen</strong> is what you would see as the usual 1–20 style
        value in CM / CM-01/02 Merlin profile — it updates live as you type, using the same math as the profile (CA18
        curve for technicals, clamp for mentals, etc.).
      </p>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">CA / PA / squad / reputation</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {coreKeys.map((k) => (
            <NumField
              key={k}
              k={k}
              label={editorAttrLabel(k)}
              value={draft[k] ?? ''}
              onChange={onField}
              disabled={false}
              preview={previewFor(k)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Natural positions &amp; sides</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {EDITOR_POSITION_KEYS.map((k) => (
            <NumField
              key={k}
              k={k}
              label={editorAttrLabel(k)}
              value={draft[k] ?? ''}
              onChange={onField}
              disabled={false}
              preview={previewFor(k)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Main attributes</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {EDITOR_MAIN_ATTR_COLS.map((col, ci) => (
            <div key={ci} className="grid grid-cols-1 gap-2">
              {col.map((k) => (
                <NumField
                  key={k}
                  k={k}
                  label={editorAttrLabel(k)}
                  value={draft[k] ?? ''}
                  onChange={onField}
                  disabled={false}
                  preview={previewFor(k)}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Hidden / staff mentals <span className="font-normal text-zinc-600">(player bytes + staff.dat)</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {EDITOR_HIDDEN_ORDER.map((k) => (
            <NumField
              key={k}
              k={k}
              label={editorAttrLabel(k)}
              value={draft[k] ?? ''}
              onChange={onField}
              disabled={false}
              preview={previewFor(k)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Feet &amp; morale</h3>
        <div className="grid max-w-xl grid-cols-3 gap-2">
          {(['left_foot', 'right_foot', 'morale'] as const).map((k) => (
            <NumField
              key={k}
              k={k}
              label={editorAttrLabel(k)}
              value={draft[k] ?? ''}
              onChange={onField}
              disabled={false}
              preview={previewFor(k)}
            />
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Writes a <strong className="text-zinc-400">new file</strong> only; your loaded copy in memory is unchanged until you reload.
        Close CM0102 before overwriting a file it has open. Prefer testing on a copy of an uncompressed database (e.g. Blackburn data pack).
      </p>
    </div>
  )
}
