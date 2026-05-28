import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { staffIsBoardRole } from '../../shared/cm0102StaffHiddenDisplay'
import { staffJobForClubDropdownEntries, staffJobForClubLabel } from '../../shared/staffJobCatalog'
import { StaffBrowsePanel } from './StaffBrowsePanel'
import { StaffFilterSidebar } from './StaffFilterSidebar'
import {
  countActiveStaffAttrMins,
  emptyStaffAttrMins,
  staffBrowseFilterFromForm,
  type StaffEditorFilterForm,
} from './staff/staffEditorFilterState'

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
  staffIndex,
}: {
  loadInfo: boolean
  compressed: boolean
  staffIndex: number | null
}) {
  const [snap, setSnap] = useState<StaffEditorSnapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [pickedStaff, setPickedStaff] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Record<string, number> | null>(null)
  const effectiveIndex = pickedStaff ?? staffIndex

  const [q, setQ] = useState('')
  const [nation, setNation] = useState('')
  const [club, setClub] = useState('')
  const [boardOnly, setBoardOnly] = useState(false)
  const [staffJobForClub, setStaffJobForClub] = useState('')
  const [staffIncludePlayers, setStaffIncludePlayers] = useState(false)
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [wageMin, setWageMin] = useState('')
  const [wageMax, setWageMax] = useState('')
  const [staffCoachingCaMin, setStaffCoachingCaMin] = useState('')
  const [staffCoachingCaMax, setStaffCoachingCaMax] = useState('')
  const [staffReputationMin, setStaffReputationMin] = useState('')
  const [staffReputationMax, setStaffReputationMax] = useState('')
  const [staffCoachingPaMin, setStaffCoachingPaMin] = useState('')
  const [staffCoachingPaMax, setStaffCoachingPaMax] = useState('')
  const [contractTypeCategory, setContractTypeCategory] = useState<StaffEditorFilterForm['contractTypeCategory']>('')
  const [euOnly, setEuOnly] = useState(false)
  const [bosmanOnly, setBosmanOnly] = useState(false)
  const [expiresWithinMonths, setExpiresWithinMonths] = useState('')
  const [staffAttrMins, setStaffAttrMins] = useState(emptyStaffAttrMins)
  const [staffAttrMinMatchAtLeast, setStaffAttrMinMatchAtLeast] = useState('')

  const staffJobOptions = useMemo(() => staffJobForClubDropdownEntries(), [])
  const activeStaffAttrFilterCount = useMemo(() => countActiveStaffAttrMins(staffAttrMins), [staffAttrMins])

  const setStaffAttrMinAt = useCallback((index: number, value: string) => {
    setStaffAttrMins((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const adjustStaffMatchAtLeast = useCallback(
    (delta: number) => {
      const active = activeStaffAttrFilterCount
      if (active === 0) return
      const cur = staffAttrMinMatchAtLeast.trim()
      const parsed = cur === '' ? active : Math.floor(Number(cur))
      const base = Number.isFinite(parsed) && parsed >= 1 ? parsed : active
      const next = Math.max(1, Math.min(active, base + delta))
      setStaffAttrMinMatchAtLeast(String(next))
    },
    [activeStaffAttrFilterCount, staffAttrMinMatchAtLeast],
  )

  const browseFilter = useMemo(
    () =>
      staffBrowseFilterFromForm({
        q,
        nation,
        club,
        boardOnly,
        staffJobForClub,
        staffIncludePlayers,
        ageMin,
        ageMax,
        wageMin,
        wageMax,
        staffCoachingCaMin,
        staffCoachingCaMax,
        staffReputationMin,
        staffReputationMax,
        staffCoachingPaMin,
        staffCoachingPaMax,
        contractTypeCategory,
        euOnly,
        bosmanOnly,
        expiresWithinMonths,
        staffAttrMins,
        staffAttrMinMatchAtLeast,
      }),
    [
      q,
      nation,
      club,
      boardOnly,
      staffJobForClub,
      staffIncludePlayers,
      ageMin,
      ageMax,
      wageMin,
      wageMax,
      staffCoachingCaMin,
      staffCoachingCaMax,
      staffReputationMin,
      staffReputationMax,
      staffCoachingPaMin,
      staffCoachingPaMax,
      contractTypeCategory,
      euOnly,
      bosmanOnly,
      expiresWithinMonths,
      staffAttrMins,
      staffAttrMinMatchAtLeast,
    ],
  )

  useEffect(() => {
    setSaveMsg(null)
    setErr(null)
    if (!loadInfo || effectiveIndex == null || typeof window.cmapi?.getStaffEditorSnapshot !== 'function') {
      setSnap(null)
      setDraft({})
      baselineRef.current = null
      return
    }
    let cancelled = false
    setLoading(true)
    void window.cmapi
      .getStaffEditorSnapshot(effectiveIndex)
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
  }, [loadInfo, effectiveIndex])

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
        <h2 className="text-lg font-semibold text-zinc-100">Staff / non-player editor</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Browse all staff in the loaded save, filter by role and hidden attributes (including board{' '}
          <span className="text-zinc-400">Business</span>,{' '}
          <span className="text-zinc-400">Interference</span>,{' '}
          <span className="text-zinc-400">Patience</span>,{' '}
          <span className="text-zinc-400">Resources (sugar daddy)</span>), then edit{' '}
          <span className="font-mono text-zinc-400">nonplayer.dat</span> values. Chairman = job 1, Managing director =
          job 2.
        </p>
      </div>

      <div className="flex min-h-[32rem] flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="cm-scroll w-full shrink-0 space-y-3 overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)] lg:w-72">
          <label>
            <span className="filter-field-label">Name search</span>
            <input
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Partial name…"
              spellCheck={false}
            />
          </label>
          <label>
            <span className="filter-field-label">Nation</span>
            <input
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={nation}
              onChange={(e) => setNation(e.target.value)}
              placeholder="Filter nation…"
            />
          </label>
          <label>
            <span className="filter-field-label">Club</span>
            <input
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Filter club…"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={boardOnly}
              onChange={(e) => {
                setBoardOnly(e.target.checked)
                if (e.target.checked) setStaffJobForClub('')
              }}
            />
            Chairman / Managing director only (jobs 1 &amp; 2)
          </label>
          <StaffFilterSidebar
            ageMin={ageMin}
            setAgeMin={setAgeMin}
            ageMax={ageMax}
            setAgeMax={setAgeMax}
            wageMin={wageMin}
            setWageMin={setWageMin}
            wageMax={wageMax}
            setWageMax={setWageMax}
            staffCoachingCaMin={staffCoachingCaMin}
            setStaffCoachingCaMin={setStaffCoachingCaMin}
            staffCoachingCaMax={staffCoachingCaMax}
            setStaffCoachingCaMax={setStaffCoachingCaMax}
            staffReputationMin={staffReputationMin}
            setStaffReputationMin={setStaffReputationMin}
            staffReputationMax={staffReputationMax}
            setStaffReputationMax={setStaffReputationMax}
            staffCoachingPaMin={staffCoachingPaMin}
            setStaffCoachingPaMin={setStaffCoachingPaMin}
            staffCoachingPaMax={staffCoachingPaMax}
            setStaffCoachingPaMax={setStaffCoachingPaMax}
            staffJobForClub={boardOnly ? '' : staffJobForClub}
            setStaffJobForClub={setStaffJobForClub}
            staffJobOptions={staffJobOptions}
            staffIncludePlayers={staffIncludePlayers}
            setStaffIncludePlayers={setStaffIncludePlayers}
            contractTypeCategory={contractTypeCategory}
            setContractTypeCategory={setContractTypeCategory}
            euOnly={euOnly}
            setEuOnly={setEuOnly}
            bosmanOnly={bosmanOnly}
            setBosmanOnly={setBosmanOnly}
            expiresWithinMonths={expiresWithinMonths}
            setExpiresWithinMonths={setExpiresWithinMonths}
            staffAttrMins={staffAttrMins}
            setStaffAttrMinAt={setStaffAttrMinAt}
            staffAttrMinMatchAtLeast={staffAttrMinMatchAtLeast}
            setStaffAttrMinMatchAtLeast={setStaffAttrMinMatchAtLeast}
            activeStaffAttrFilterCount={activeStaffAttrFilterCount}
            adjustStaffMatchAtLeast={adjustStaffMatchAtLeast}
            defaultHiddenOpen
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 xl:flex-row">
          <div className="cm-scroll min-w-0 flex-1 overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Staff list</p>
            <StaffBrowsePanel
              loadInfo={loadInfo}
              filter={browseFilter}
              selectedStaffIndex={effectiveIndex}
              onSelectStaff={setPickedStaff}
              onOpenPlayerProfile={() => {}}
            />
          </div>

          <div className="cm-scroll min-w-0 flex-1 space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3 xl:max-w-md">
            {!effectiveIndex && (
              <p className="text-sm text-zinc-500">Select a staff member from the list to edit their non-player profile.</p>
            )}
            {loading && <p className="text-sm text-zinc-500">Loading…</p>}
            {err && !snap && effectiveIndex != null && <p className="text-sm text-rose-300/90">{err}</p>}
            {snap && (
              <>
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
                    <div className="grid grid-cols-2 gap-2">
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
                  {err && snap && <span className="text-xs text-rose-300/90">{err}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
