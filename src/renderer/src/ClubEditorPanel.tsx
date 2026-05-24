import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CLUB_EDITOR_FIELDS,
  STADIUM_EDITOR_FIELDS,
  type ClubEditorFieldSpec,
} from '../../shared/clubEditorCatalog'
import {
  clampClubEditorValue,
  clubEditorLimitHint,
  CLUB_EDITOR_LIMITS,
} from '../../shared/clubEditorLimits'
import { ClubSearchSidebar } from './clubs/ClubSearchSidebar'
import { useClubBrowse } from './clubs/useClubBrowse'

export type ClubEditorSnapshot = {
  clubId: number
  stadiumId: number
  name: string
  nation: string
  division: string
  stadiumName: string
  values: Record<string, number>
  humanManagedClubId?: number | null
  cashOnDisk?: { raw: number; display: number; encoding: 'plain' | 'packed' }
}

function FieldGrid({
  fields,
  draft,
  disabled,
  onField,
  onBool,
}: {
  fields: readonly ClubEditorFieldSpec[]
  draft: Record<string, string>
  disabled: boolean
  onField: (key: string, v: string) => void
  onBool: (key: string, checked: boolean) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) =>
        f.kind === 'bool' ? (
          <label
            key={f.key}
            className="flex items-center gap-2 py-1"
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={draft[f.key] === '1'}
              onChange={(e) => onBool(f.key, e.target.checked)}
              className="rounded border-zinc-600"
            />
            <span className="text-xs text-zinc-300">{f.label}</span>
          </label>
        ) : (
          <label
            key={f.key}
            className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</span>
            <input
              type="number"
              disabled={disabled}
              min={CLUB_EDITOR_LIMITS[f.key]?.min}
              max={CLUB_EDITOR_LIMITS[f.key]?.max}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-xs text-zinc-100 outline-none focus:border-emerald-600 disabled:opacity-40"
              value={draft[f.key] ?? ''}
              onChange={(e) => onField(f.key, e.target.value)}
              onBlur={() => {
                const n = Number(draft[f.key])
                if (!Number.isFinite(n)) return
                const c = clampClubEditorValue(f.key, n)
                if (String(c) !== draft[f.key]) onField(f.key, String(c))
              }}
            />
            {(f.hint || clubEditorLimitHint(f.key)) && (
              <span className="text-[10px] leading-snug text-zinc-600">
                {[f.hint, clubEditorLimitHint(f.key) ? `Game range: ${clubEditorLimitHint(f.key)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </label>
        ),
      )}
    </div>
  )
}

export function ClubEditorPanel({
  loadInfo,
  compressed,
  databasePath,
  onSavedToPath,
}: {
  loadInfo: boolean
  compressed: boolean
  databasePath?: string | null
  onSavedToPath?: (path: string) => void
}) {
  const clubBrowse = useClubBrowse(loadInfo)
  const clubId = clubBrowse.selId

  const [snap, setSnap] = useState<ClubEditorSnapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Record<string, number> | null>(null)

  const financeFields = useMemo(() => CLUB_EDITOR_FIELDS.filter((f) => f.section === 'club_finance'), [])
  const clubOtherFields = useMemo(() => CLUB_EDITOR_FIELDS.filter((f) => f.section === 'club_other'), [])

  useEffect(() => {
    setSaveMsg(null)
    setErr(null)
    if (!loadInfo || compressed || clubId == null || typeof window.cmapi?.getClubEditorSnapshot !== 'function') {
      setSnap(null)
      setDraft({})
      baselineRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    void window.cmapi
      .getClubEditorSnapshot(clubId)
      .then((r) => {
        if (cancelled) return
        if (r && typeof r === 'object' && 'error' in r && typeof (r as { error: string }).error === 'string') {
          setSnap(null)
          setDraft({})
          baselineRef.current = null
          setErr((r as { error: string }).error)
          return
        }
        if (!r || typeof r !== 'object' || !('values' in r)) {
          setSnap(null)
          setDraft({})
          baselineRef.current = null
          setErr('Could not load club editor data for this club.')
          return
        }
        const s = r as ClubEditorSnapshot
        setSnap(s)
        const d: Record<string, string> = {}
        const base: Record<string, number> = {}
        for (const [key, v] of Object.entries(s.values)) {
          const c = clampClubEditorValue(key, v)
          base[key] = c
          d[key] = String(c)
        }
        baselineRef.current = base
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
  }, [loadInfo, compressed, clubId])

  const onField = useCallback((key: string, v: string) => {
    setDraft((prev) => ({ ...prev, [key]: v }))
  }, [])

  const onBool = useCallback((key: string, checked: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: checked ? '1' : '0' }))
  }, [])

  const hasChanges = useMemo(() => {
    const base = baselineRef.current
    if (!base) return false
    for (const key of Object.keys(base)) {
      const cur = draft[key]
      if (cur === undefined) continue
      const spec = [...CLUB_EDITOR_FIELDS, ...STADIUM_EDITOR_FIELDS].find((f) => f.key === key)
      if (spec?.kind === 'bool') {
        const b = cur === '1' ? 1 : 0
        if (b !== base[key]) return true
        continue
      }
      const n = Number(cur)
      if (!Number.isFinite(n)) return true
      if (Math.trunc(n) !== base[key]) return true
    }
    return false
  }, [draft])

  const saveDisabled = compressed || !snap || saving || !hasChanges

  const collectValues = useCallback((): Record<string, number> | null => {
    const base = baselineRef.current
    if (!base) return null
    const values: Record<string, number> = {}
    for (const key of Object.keys(base)) {
      const spec = [...CLUB_EDITOR_FIELDS, ...STADIUM_EDITOR_FIELDS].find((f) => f.key === key)
      const raw = draft[key]
      if (raw === undefined) continue
      if (spec?.kind === 'bool') {
        values[key] = raw === '1' ? 1 : 0
        continue
      }
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        setErr(`Invalid number for ${spec?.label ?? key}`)
        return null
      }
      values[key] = clampClubEditorValue(key, Math.trunc(n))
    }
    return values
  }, [draft])

  const refreshAfterSave = useCallback(
    async (clubId: number, savedPath: string) => {
      onSavedToPath?.(savedPath)
      const refreshed = await window.cmapi.getClubEditorSnapshot(clubId)
      if (refreshed && typeof refreshed === 'object' && 'values' in refreshed && !('error' in refreshed)) {
        const s = refreshed as ClubEditorSnapshot
        setSnap(s)
        const d: Record<string, string> = {}
        const nextBase: Record<string, number> = {}
        for (const [key, v] of Object.entries(s.values)) {
          const c = clampClubEditorValue(key, v)
          nextBase[key] = c
          d[key] = String(c)
        }
        baselineRef.current = nextBase
        setDraft(d)
      }
    },
    [onSavedToPath],
  )

  const onSaveInPlace = useCallback(async () => {
    if (!snap || compressed || typeof window.cmapi?.saveClubEdits !== 'function') return
    const values = collectValues()
    if (!values) return
    if (
      !window.confirm(
        `Overwrite the loaded save file?\n\n${databasePath ?? 'Current save'}\n\nQuit CM completely before saving, then load/Continue this exact file to see bank balance and stadium changes.`,
      )
    ) {
      return
    }
    setSaving(true)
    setErr(null)
    setSaveMsg(null)
    try {
      const out = await window.cmapi.saveClubEdits(snap.clubId, values, { inPlace: true })
      if (out && typeof out === 'object' && 'ok' in out && out.ok && 'path' in out) {
        const savedPath = String(out.path)
        await refreshAfterSave(snap.clubId, savedPath)
        setSaveMsg(
          `Updated ${savedPath}. Quit CM if it was running, then load/Continue this file and check Finances → Bank balance.`,
        )
      } else if (out && typeof out === 'object' && 'error' in out) {
        const er = (out as { error?: string }).error
        if (er !== 'cancelled') setErr(er ?? 'Save failed.')
      } else setErr('Save failed.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [collectValues, compressed, databasePath, refreshAfterSave, snap])

  const onSave = useCallback(async () => {
    if (!snap || compressed || typeof window.cmapi?.saveClubEdits !== 'function') return
    const values = collectValues()
    if (!values) return
    setSaving(true)
    setErr(null)
    setSaveMsg(null)
    try {
      const out = await window.cmapi.saveClubEdits(snap.clubId, values)
      if (out && typeof out === 'object' && 'ok' in out && out.ok && 'path' in out) {
        const savedPath = String(out.path)
        await refreshAfterSave(snap.clubId, savedPath)
        setSaveMsg(
          `Saved ${savedPath}. In CM: Continue that exact file (not an older copy). After playing and saving in-game, use File → Load that same path here before editing again.`,
        )
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
  }, [collectValues, compressed, refreshAfterSave, snap])

  if (!loadInfo) {
    return null
  }

  if (compressed) {
    return (
      <section className="max-w-2xl space-y-2 border-b border-zinc-800/80 pb-6 text-sm text-zinc-300">
        <h2 className="text-sm font-semibold text-zinc-200">Club &amp; stadium</h2>
        <p className="text-zinc-400">
          Club editing needs an <strong className="text-zinc-200">uncompressed</strong> save (Game Settings → Save
          Compressed = No).
        </p>
      </section>
    )
  }

  return (
    <section className="editor-section-intro mb-8 max-w-4xl space-y-4 border-b border-zinc-800/80 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Club &amp; stadium editor</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Edit bank balance, attendance, training, reputation, and linked stadium capacity and features. In CM, check{' '}
          <strong className="font-normal text-zinc-400">Finances → Bank balance</strong> (transfer budget is calculated
          separately).
        </p>
        {databasePath && (
          <div className="mt-3 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5 text-[11px] leading-relaxed">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Loaded save</p>
            <p className="mt-1 break-all font-mono text-[10px] text-zinc-400" title={databasePath}>
              {databasePath}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-500">
              <li>Use the same save file path CM loads (not an old copy elsewhere).</li>
              <li>Select the club you manage in CM (name must match Finances).</li>
              <li>Fully quit CM before Update loaded save, then Load that exact file in CM.</li>
            </ul>
          </div>
        )}
      </div>

      <ClubSearchSidebar
        loadInfo={loadInfo}
        showFavorites={false}
        showBrowseHelper={false}
        q={clubBrowse.q}
        debouncedQ={clubBrowse.debouncedQ}
        suggestions={clubBrowse.suggestions}
        selId={clubBrowse.selId}
        loadingSuggest={clubBrowse.loadingSuggest}
        err={clubBrowse.err}
        menuOpen={clubBrowse.menuOpen}
        onInputChange={clubBrowse.onInputChange}
        onInputFocus={clubBrowse.onInputFocus}
        onInputBlur={clubBrowse.onInputBlur}
        onPickClub={clubBrowse.pickClub}
      />

      {clubId != null && loading && <p className="text-sm text-zinc-500">Loading club data…</p>}

      {err && <p className="text-sm text-rose-300">{err}</p>}

      {snap && !loading && (
        <>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
            <p className="font-medium text-zinc-200">{snap.name}</p>
            {snap.humanManagedClubId != null &&
              snap.humanManagedClubId > 0 &&
              snap.clubId !== snap.humanManagedClubId && (
                <p className="mt-1 text-amber-200/95">
                  This is not your managed club in this save. Bank balance in CM only changes for the club you manage —
                  search and select that club before saving.
                </p>
              )}
            <p>
              {snap.nation} · {snap.division}
            </p>
            <p className="mt-1 text-zinc-500">
              Stadium: <span className="text-zinc-300">{snap.stadiumName}</span>
              <span className="font-mono text-zinc-600"> (id {snap.stadiumId})</span>
            </p>
            {snap.cashOnDisk && (
              <p className="mt-1 font-mono text-[10px] text-zinc-600">
                On disk: £{snap.cashOnDisk.display.toLocaleString()} ({snap.cashOnDisk.encoding} int32 @ club.dat+101)
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Finances</h3>
            <FieldGrid
              fields={financeFields}
              draft={draft}
              disabled={saving}
              onField={onField}
              onBool={onBool}
            />
          </div>

          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Club</h3>
            <FieldGrid
              fields={clubOtherFields}
              draft={draft}
              disabled={saving}
              onField={onField}
              onBool={onBool}
            />
          </div>

          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Stadium</h3>
            <FieldGrid
              fields={STADIUM_EDITOR_FIELDS}
              draft={draft}
              disabled={saving}
              onField={onField}
              onBool={onBool}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void onSaveInPlace()}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Update loaded save'}
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void onSave()}
              className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Save a copy…
            </button>
            {saveMsg && <span className="w-full text-xs text-zinc-400">{saveMsg}</span>}
          </div>
        </>
      )}
    </section>
  )
}
