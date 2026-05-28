import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
}

const SCALAR_FIELDS: { key: string; label: string }[] = [
  { key: 'wage', label: 'Wage' },
  { key: 'goal_bonus', label: 'Goal bonus' },
  { key: 'assist_bonus', label: 'Assist bonus' },
  { key: 'release_fee', label: 'Release fee' },
  { key: 'contract_type', label: 'Contract type (byte)' },
  { key: 'squad_status', label: 'Squad status (byte)' },
  { key: 'transfer_arranged_for', label: 'Transfer arranged (club id)' },
  { key: 'leaving_on_bosman', label: 'Leaving on Bosman (0/1)' },
  { key: 'minimum_fee_rc', label: 'Min release clause (0/1)' },
]

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
  const [listedByClub, setListedByClub] = useState(false)
  const [listedByRequest, setListedByRequest] = useState(false)
  const [listedForLoanFlag, setListedForLoanFlag] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Record<string, number> | null>(null)
  const baselineTsRef = useRef<number>(0)

  useEffect(() => {
    if (!loadInfo || staffIndex == null || typeof window.cmapi?.getContractEditorSnapshot !== 'function') {
      setSnap(null)
      return
    }
    let cancelled = false
    setLoading(true)
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
    for (const key of Object.keys(base)) {
      if (key === 'transfer_status') continue
      const n = Number(draft[key])
      if (Number.isFinite(n) && Math.trunc(n) !== base[key]) return true
    }
    return transferStatusDraft !== (base.transfer_status ?? 0)
  }, [draft, transferStatusDraft])

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
    if (Object.keys(changes).length === 0) return
    setSaving(true)
    try {
      const out = await window.cmapi.saveContractEdits(staffIndex, changes)
      if (out && 'ok' in out && out.ok && 'path' in out) {
        setSaveMsg(`Saved to ${out.path}`)
        baselineRef.current = { ...base, ...changes, transfer_status: transferStatusDraft }
        baselineTsRef.current = transferStatusDraft
      } else if (out && 'error' in out) {
        setErr(out.error === 'cancelled' ? 'Save cancelled.' : String(out.error))
      }
    } finally {
      setSaving(false)
    }
  }, [compressed, draft, snap, staffIndex, transferStatusDraft])

  if (!loadInfo || staffIndex == null) return null
  if (compressed) return null
  if (loading) return <p className="text-sm text-zinc-500">Loading contract…</p>
  if (!snap?.hasContract) {
    return <p className="text-sm text-zinc-500">No contract row for this player.</p>
  }

  return (
    <section className="space-y-3 border-t border-zinc-800 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contract &amp; transfer</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCALAR_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-0.5 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5">
            <span className="text-[10px] uppercase text-zinc-500">{f.label}</span>
            <input
              type="number"
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 font-mono text-xs"
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="space-y-1 rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
        <p className="text-[10px] font-medium uppercase text-zinc-500">Transfer status flags</p>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedByClub} onChange={(e) => setListedByClub(e.target.checked)} />
          Listed by club (bit 0x01)
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedForLoanFlag} onChange={(e) => setListedForLoanFlag(e.target.checked)} />
          Listed for loan (bit 0x02)
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={listedByRequest} onChange={(e) => setListedByRequest(e.target.checked)} />
          Transfer request / unsettled (bit 0x08)
        </label>
        <p className="font-mono text-[10px] text-zinc-600">transfer_status → {transferStatusDraft}</p>
      </div>
      <button
        type="button"
        disabled={!hasChanges || saving}
        onClick={() => void onSave()}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-40"
      >
        {saving ? 'Saving contract…' : 'Save contract copy…'}
      </button>
      {saveMsg && <p className="text-xs text-zinc-400">{saveMsg}</p>}
      {err && <p className="text-xs text-rose-300/90">{err}</p>}
    </section>
  )
}
