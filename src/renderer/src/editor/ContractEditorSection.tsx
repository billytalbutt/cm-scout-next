import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CONTRACT_TYPE_EDITOR_OPTIONS,
  SQUAD_STATUS_EDITOR_OPTIONS,
  contractTypeLabel,
} from '../../../shared/contractTypes'
import {
  fmtContractBonusFieldHint,
  fmtContractDateHint,
  fmtReleaseFee,
  fmtWage,
  releaseClauseLabel,
  squadStatusLabel,
  transferArrangedLabel,
  yesNoLabel,
} from '../../../shared/contractEditorDisplay'
import { formatIsoDateUk } from '../../../shared/dateDisplay'
import {
  applyTransferStatusBits,
  listedForLoan,
  transferListedByClub,
  transferListedByRequest,
} from '../../../shared/transferStatus'

export type ContractEditorSnapshot = {
  staffIndex: number
  name: string
  hasContract: boolean
  values: Record<string, number>
  dateStartedIso: string | null
  dateExpiresIso: string | null
  hints?: Record<string, string>
}

const BTN =
  'rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40'

const INPUT =
  'rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-xs text-zinc-100'

const BONUS_FIELDS = [
  { key: 'goal_bonus', label: 'Goal bonus' },
  { key: 'assist_bonus', label: 'Assist bonus' },
  { key: 'clean_sheet_bonus', label: 'Clean sheet bonus' },
] as const

const CLAUSE_FIELDS = [
  { key: 'minimum_fee_rc', label: 'Minimum fee release clause' },
  { key: 'non_promotion_rc', label: 'Non-promotion release clause' },
  { key: 'non_playing_rc', label: 'Non-playing release clause' },
  { key: 'relegation_rc', label: 'Relegation release clause' },
  { key: 'manager_job_rc', label: 'Manager job release clause' },
] as const

function contractTypeSelectValue(byte: number): string {
  const hit = CONTRACT_TYPE_EDITOR_OPTIONS.find((o) => o.byte === byte)
  return hit ? String(hit.byte) : String(byte)
}

function squadStatusSelectValue(byte: number): string {
  const hit = SQUAD_STATUS_EDITOR_OPTIONS.find((o) => o.byte === byte)
  return hit ? String(hit.byte) : String(byte)
}

export function ContractEditorSection({
  loadInfo,
  compressed,
  staffIndex,
}: {
  loadInfo: boolean
  compressed: boolean
  staffIndex: number | null
}) {
  const [snap, setSnap] = useState<ContractEditorSnapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [dateStarted, setDateStarted] = useState('')
  const [dateExpires, setDateExpires] = useState('')
  const [listedByClub, setListedByClub] = useState(false)
  const [listedByRequest, setListedByRequest] = useState(false)
  const [listedForLoanFlag, setListedForLoanFlag] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Record<string, number> | null>(null)
  const baselineDatesRef = useRef<{ started: string; expires: string }>({ started: '', expires: '' })
  const baselineTsRef = useRef<number>(0)

  useEffect(() => {
    if (!loadInfo || staffIndex == null || typeof window.cmapi?.getContractEditorSnapshot !== 'function') {
      setSnap(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setSaveMsg(null)
    void window.cmapi
      .getContractEditorSnapshot(staffIndex)
      .then((r) => {
        if (cancelled) return
        if (!r || !('values' in r)) {
          setSnap(null)
          setErr('No contract for this player.')
          return
        }
        const s = r as ContractEditorSnapshot
        setSnap(s)
        baselineRef.current = { ...s.values }
        const started = s.dateStartedIso ?? ''
        const expires = s.dateExpiresIso ?? ''
        baselineDatesRef.current = { started, expires }
        setDateStarted(started)
        setDateExpires(expires)
        const ts = s.values.transfer_status ?? 0
        baselineTsRef.current = ts
        setListedByClub(transferListedByClub(ts))
        setListedByRequest(transferListedByRequest(ts))
        setListedForLoanFlag(listedForLoan(ts))
        const d: Record<string, string> = {}
        for (const [k, v] of Object.entries(s.values)) {
          if (k !== 'transfer_status') d[k] = String(v)
        }
        setDraft(d)
        setErr(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadInfo, staffIndex])

  const transferStatusDraft = useMemo(
    () =>
      applyTransferStatusBits(baselineTsRef.current, {
        listedByClub,
        listedByRequest,
        listedForLoan: listedForLoanFlag,
      }),
    [listedByClub, listedByRequest, listedForLoanFlag],
  )

  const hasChanges = useMemo(() => {
    const base = baselineRef.current
    if (!base) return false
    if (dateStarted !== baselineDatesRef.current.started) return true
    if (dateExpires !== baselineDatesRef.current.expires) return true
    for (const key of Object.keys(base)) {
      if (key === 'transfer_status') continue
      const n = Number(draft[key])
      if (Number.isFinite(n) && Math.trunc(n) !== base[key]) return true
    }
    return transferStatusDraft !== (base.transfer_status ?? 0)
  }, [dateExpires, dateStarted, draft, transferStatusDraft])

  const onSave = useCallback(async () => {
    if (!snap || compressed || staffIndex == null || typeof window.cmapi?.saveContractEdits !== 'function') return
    const base = baselineRef.current
    if (!base) return
    const changes: Record<string, number> = {}
    for (const key of Object.keys(base)) {
      if (key === 'transfer_status') continue
      const n = Number(draft[key])
      if (Number.isFinite(n) && Math.trunc(n) !== base[key]) changes[key] = Math.trunc(n)
    }
    if (transferStatusDraft !== (base.transfer_status ?? 0)) {
      changes.transfer_status = transferStatusDraft
    }
    const dateChanges: { date_started?: string | null; contract_expires?: string | null } = {}
    if (dateStarted !== baselineDatesRef.current.started) {
      dateChanges.date_started = dateStarted.trim() || null
    }
    if (dateExpires !== baselineDatesRef.current.expires) {
      dateChanges.contract_expires = dateExpires.trim() || null
    }
    const hasDateChanges = Object.keys(dateChanges).length > 0
    if (Object.keys(changes).length === 0 && !hasDateChanges) return
    setSaving(true)
    setErr(null)
    try {
      const out = await window.cmapi.saveContractEdits(staffIndex, changes, hasDateChanges ? dateChanges : undefined)
      if (out && 'ok' in out && out.ok && 'path' in out) {
        setSaveMsg(`Saved to ${out.path}. Load that file in CM to apply contract changes.`)
        baselineRef.current = { ...base, ...changes, transfer_status: transferStatusDraft }
        baselineDatesRef.current = { started: dateStarted, expires: dateExpires }
        baselineTsRef.current = transferStatusDraft
      } else if (out && 'error' in out) {
        setErr(out.error === 'cancelled' ? 'Save cancelled.' : String(out.error))
      }
    } finally {
      setSaving(false)
    }
  }, [compressed, dateExpires, dateStarted, draft, snap, staffIndex, transferStatusDraft])

  if (!loadInfo || staffIndex == null) return null
  if (compressed) {
    return (
      <p className="text-sm text-zinc-500">
        Contract editing needs an uncompressed save (Game Settings → Save Compressed = No).
      </p>
    )
  }
  if (loading) return <p className="text-sm text-zinc-500">Loading contract…</p>
  if (!snap?.hasContract) {
    return <p className="text-sm text-zinc-500">No contract row for this player.</p>
  }

  const wageRaw = Number(draft.wage)
  const releaseRaw = Number(draft.release_fee)
  const arrangedRaw = Number(draft.transfer_arranged_for)
  const contractTypeRaw = Number(draft.contract_type)
  const squadStatusRaw = Number(draft.squad_status)

  return (
    <section className="space-y-4 border-t border-zinc-800 pt-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contract &amp; transfer</h3>
        <p className="mt-1 text-[11px] text-zinc-500">
          Same fields as Graeme Kelly Save Game Editor → Contract. Bonuses at −1 mean None in CM. Save writes a new
          copy — load it in CM to apply.
        </p>
      </div>

      {snap.hints?.contract_protection && (
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
          {snap.hints.contract_protection}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Contract started</span>
          <input
            type="date"
            className={INPUT}
            value={dateStarted}
            onChange={(e) => setDateStarted(e.target.value)}
          />
          <span className="text-[10px] text-zinc-400">
            {dateStarted ? formatIsoDateUk(dateStarted) : 'Not set'}
            {snap.hints?.date_started && dateStarted === (snap.dateStartedIso ?? '') ? ` · ${snap.hints.date_started}` : ''}
          </span>
        </label>
        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Contract expires</span>
          <input
            type="date"
            className={INPUT}
            value={dateExpires}
            onChange={(e) => setDateExpires(e.target.value)}
          />
          <span className="text-[10px] text-zinc-400">
            {dateExpires
              ? dateExpires === (snap.dateExpiresIso ?? '')
                ? (snap.hints?.contract_expires ?? formatIsoDateUk(dateExpires))
                : formatIsoDateUk(dateExpires)
              : 'Not set'}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Wage</span>
          <input
            type="number"
            className={INPUT}
            value={draft.wage ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, wage: e.target.value }))}
          />
          {Number.isFinite(wageRaw) && (
            <span className="text-[10px] text-zinc-400">In game: {fmtWage(wageRaw)}/week</span>
          )}
        </label>

        {BONUS_FIELDS.map((f) => {
          const raw = Number(draft[f.key])
          return (
            <label
              key={f.key}
              className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</span>
              <input
                type="number"
                className={INPUT}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              {Number.isFinite(raw) && (
                <span className="text-[10px] text-zinc-400">{fmtContractBonusFieldHint(raw)}</span>
              )}
            </label>
          )
        })}

        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Release fee</span>
          <input
            type="number"
            className={INPUT}
            value={draft.release_fee ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, release_fee: e.target.value }))}
          />
          {Number.isFinite(releaseRaw) && (
            <span className="text-[10px] text-zinc-400">In game: {fmtReleaseFee(releaseRaw)}</span>
          )}
        </label>

        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Contract type</span>
          <select
            className={INPUT}
            value={Number.isFinite(contractTypeRaw) ? contractTypeSelectValue(Math.trunc(contractTypeRaw)) : '2'}
            onChange={(e) => setDraft((prev) => ({ ...prev, contract_type: e.target.value }))}
          >
            {CONTRACT_TYPE_EDITOR_OPTIONS.map((o) => (
              <option key={o.byte} value={String(o.byte)}>
                {o.label}
              </option>
            ))}
            {Number.isFinite(contractTypeRaw) &&
              !CONTRACT_TYPE_EDITOR_OPTIONS.some((o) => o.byte === Math.trunc(contractTypeRaw)) && (
                <option value={String(Math.trunc(contractTypeRaw))}>
                  {contractTypeLabel(Math.trunc(contractTypeRaw))} (0x{Math.trunc(contractTypeRaw).toString(16)})
                </option>
              )}
          </select>
          {Number.isFinite(contractTypeRaw) && (
            <span className="text-[10px] text-zinc-400">{contractTypeLabel(Math.trunc(contractTypeRaw))}</span>
          )}
        </label>

        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Squad status</span>
          <select
            className={INPUT}
            value={Number.isFinite(squadStatusRaw) ? squadStatusSelectValue(Math.trunc(squadStatusRaw)) : '0'}
            onChange={(e) => setDraft((prev) => ({ ...prev, squad_status: e.target.value }))}
          >
            {SQUAD_STATUS_EDITOR_OPTIONS.map((o) => (
              <option key={o.byte} value={String(o.byte)}>
                {o.label}
              </option>
            ))}
          </select>
          {Number.isFinite(squadStatusRaw) && (
            <span className="text-[10px] text-zinc-400">{squadStatusLabel(Math.trunc(squadStatusRaw))}</span>
          )}
        </label>

        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Transfer arranged for</span>
          <input
            type="number"
            className={INPUT}
            value={draft.transfer_arranged_for ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, transfer_arranged_for: e.target.value }))}
          />
          {Number.isFinite(arrangedRaw) && (
            <span className="text-[10px] text-zinc-400">
              {snap.hints?.transfer_arranged_for ?? transferArrangedLabel(Math.trunc(arrangedRaw))}
              {arrangedRaw <= 0 ? ' (0 / negative = none)' : ''}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Leaving on Bosman</span>
          <label className="mt-1 flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={draft.leaving_on_bosman === '1'}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, leaving_on_bosman: e.target.checked ? '1' : '0' }))
              }
            />
            {yesNoLabel(Number(draft.leaving_on_bosman ?? 0))}
          </label>
        </label>
      </div>

      <div className="space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
        <p className="text-[10px] font-medium uppercase text-zinc-500">Release clauses</p>
        {CLAUSE_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={draft[f.key] === '1'}
              onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.checked ? '1' : '0' }))}
            />
            {f.label} — {releaseClauseLabel(Number(draft[f.key] ?? 0))}
          </label>
        ))}
      </div>

      <div className="space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
        <p className="text-[10px] font-medium uppercase text-zinc-500">Transfer listing</p>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedByClub} onChange={(e) => setListedByClub(e.target.checked)} />
          Listed by club
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedForLoanFlag} onChange={(e) => setListedForLoanFlag(e.target.checked)} />
          Listed for loan
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedByRequest} onChange={(e) => setListedByRequest(e.target.checked)} />
          Transfer requested
        </label>
      </div>

      <button type="button" disabled={!hasChanges || saving} onClick={() => void onSave()} className={BTN}>
        {saving ? 'Saving contract…' : 'Save contract copy…'}
      </button>
      {saveMsg && <p className="text-xs text-zinc-400">{saveMsg}</p>}
      {err && <p className="text-xs text-rose-300/90">{err}</p>}
    </section>
  )
}
