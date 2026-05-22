import {
  ALL_STAFF_ATTR_FILTERS,
  STAFF_HIDDEN_ATTR_FILTERS,
  STAFF_REGULAR_ATTR_FILTERS,
  type StaffAttrFilterSpec,
} from '../../shared/staffAttrCatalog'
import { nextAttrMinLadderOnRightClick } from '../../shared/attrMinLadder'
import { CONTRACT_TYPE_FILTER_OPTIONS, type ContractTypeCategoryId } from '../../shared/contractTypes'

function staffAttrIndex(spec: StaffAttrFilterSpec): number {
  return ALL_STAFF_ATTR_FILTERS.findIndex((s) => s.key === spec.key)
}

function StaffAttrMinGrid({
  specs,
  attrMins,
  setStaffAttrMinAt,
}: {
  specs: readonly StaffAttrFilterSpec[]
  attrMins: string[]
  setStaffAttrMinAt: (index: number, value: string) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
      {specs.map((spec) => {
        const i = staffAttrIndex(spec)
        if (i < 0) return null
        return (
          <label key={spec.key} className="contents">
            <span className="truncate text-zinc-500" title={spec.label}>
              {spec.label}
              {spec.source === 'np' ? (
                <span className="ml-1 text-[9px] text-zinc-600">(coaching)</span>
              ) : null}
            </span>
            <input
              type="number"
              min={1}
              max={31}
              className="w-12 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200"
              value={attrMins[i]}
              onChange={(e) => setStaffAttrMinAt(i, e.target.value)}
              title="Right-click: cycle 5 → 10 → 15 → 20 → clear. Coaching attrs need a linked nonplayer.dat row."
              onContextMenu={(e) => {
                e.preventDefault()
                setStaffAttrMinAt(i, nextAttrMinLadderOnRightClick(attrMins[i] ?? ''))
              }}
            />
          </label>
        )
      })}
    </div>
  )
}

export type StaffFilterSidebarProps = {
  ageMin: string
  setAgeMin: (v: string) => void
  ageMax: string
  setAgeMax: (v: string) => void
  wageMin: string
  setWageMin: (v: string) => void
  wageMax: string
  setWageMax: (v: string) => void
  staffCoachingCaMin: string
  setStaffCoachingCaMin: (v: string) => void
  staffCoachingCaMax: string
  setStaffCoachingCaMax: (v: string) => void
  staffReputationMin: string
  setStaffReputationMin: (v: string) => void
  staffReputationMax: string
  setStaffReputationMax: (v: string) => void
  staffCoachingPaMin: string
  setStaffCoachingPaMin: (v: string) => void
  staffCoachingPaMax: string
  setStaffCoachingPaMax: (v: string) => void
  staffJobForClub: string
  setStaffJobForClub: (v: string) => void
  staffJobOptions: { id: number; label: string }[]
  staffIncludePlayers: boolean
  setStaffIncludePlayers: (v: boolean) => void
  contractTypeCategory: '' | ContractTypeCategoryId
  setContractTypeCategory: (v: '' | ContractTypeCategoryId) => void
  euOnly: boolean
  setEuOnly: (v: boolean) => void
  bosmanOnly: boolean
  setBosmanOnly: (v: boolean) => void
  expiresWithinMonths: string
  setExpiresWithinMonths: (v: string) => void
  staffAttrMins: string[]
  setStaffAttrMinAt: (index: number, value: string) => void
  staffAttrMinMatchAtLeast: string
  setStaffAttrMinMatchAtLeast: (v: string) => void
  activeStaffAttrFilterCount: number
  adjustStaffMatchAtLeast: (delta: number) => void
}

export function StaffFilterSidebar({
  ageMin,
  setAgeMin,
  ageMax,
  setAgeMax,
  wageMin,
  setWageMin,
  wageMax,
  setWageMax,
  staffCoachingCaMin,
  setStaffCoachingCaMin,
  staffCoachingCaMax,
  setStaffCoachingCaMax,
  staffReputationMin,
  setStaffReputationMin,
  staffReputationMax,
  setStaffReputationMax,
  staffCoachingPaMin,
  setStaffCoachingPaMin,
  staffCoachingPaMax,
  setStaffCoachingPaMax,
  staffJobForClub,
  setStaffJobForClub,
  staffJobOptions,
  staffIncludePlayers,
  setStaffIncludePlayers,
  contractTypeCategory,
  setContractTypeCategory,
  euOnly,
  setEuOnly,
  bosmanOnly,
  setBosmanOnly,
  expiresWithinMonths,
  setExpiresWithinMonths,
  staffAttrMins,
  setStaffAttrMinAt,
  staffAttrMinMatchAtLeast,
  setStaffAttrMinMatchAtLeast,
  activeStaffAttrFilterCount,
  adjustStaffMatchAtLeast,
}: StaffFilterSidebarProps) {
  return (
    <>
      <label>
        <span className="mb-1 block text-xs text-zinc-500">Job role</span>
        <select
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          value={staffJobForClub}
          onChange={(e) => setStaffJobForClub(e.target.value)}
        >
          <option value="">Any role</option>
          {staffJobOptions.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={staffIncludePlayers}
          onChange={(e) => setStaffIncludePlayers(e.target.checked)}
        />
        Include playable players (same people as the Players tab)
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Age min</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Age max</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Backroom CA min</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffCoachingCaMin}
            onChange={(e) => setStaffCoachingCaMin(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Backroom CA max</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffCoachingCaMax}
            onChange={(e) => setStaffCoachingCaMax(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Coaching PA min</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffCoachingPaMin}
            onChange={(e) => setStaffCoachingPaMin(e.target.value)}
            title="Backroom potential ability from nonplayer.dat"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Coaching PA max</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffCoachingPaMax}
            onChange={(e) => setStaffCoachingPaMax(e.target.value)}
            title="Backroom potential ability from nonplayer.dat"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Reputation min</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffReputationMin}
            onChange={(e) => setStaffReputationMin(e.target.value)}
            title="Current reputation (nonplayer.dat or player record when linked)"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Reputation max</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={staffReputationMax}
            onChange={(e) => setStaffReputationMax(e.target.value)}
            title="Current reputation (nonplayer.dat or player record when linked)"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Wage min</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={wageMin}
            onChange={(e) => setWageMin(e.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-zinc-500">Wage max</span>
          <input
            type="number"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={wageMax}
            onChange={(e) => setWageMax(e.target.value)}
          />
        </label>
      </div>
      <label>
        <span className="mb-1 block text-xs text-zinc-500">Contract type</span>
        <select
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          value={contractTypeCategory}
          onChange={(e) => setContractTypeCategory((e.target.value || '') as '' | ContractTypeCategoryId)}
        >
          {CONTRACT_TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.id || 'any'} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
        <span className="text-xs font-medium text-zinc-400">Contract</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={euOnly} onChange={(e) => setEuOnly(e.target.checked)} />
          EU passport (1st or 2nd nation)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={bosmanOnly} onChange={(e) => setBosmanOnly(e.target.checked)} />
          Leaving on Bosman / free
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-zinc-500">
            Contract expires within (months, ≥1, empty = any)
          </span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
            value={expiresWithinMonths}
            onChange={(e) => setExpiresWithinMonths(e.target.value)}
            placeholder="e.g. 6"
          />
        </label>
      </div>
      <details className="rounded-md border border-zinc-800 bg-zinc-900/40" open>
        <summary className="cursor-pointer px-2 py-2 text-xs font-medium text-zinc-400">
          Regular attributes
        </summary>
        <div className="max-h-44 overflow-y-auto border-t border-zinc-800 px-2 py-2 cm-scroll">
          <StaffAttrMinGrid specs={STAFF_REGULAR_ATTR_FILTERS} attrMins={staffAttrMins} setStaffAttrMinAt={setStaffAttrMinAt} />
        </div>
      </details>
      <details className="rounded-md border border-zinc-800 bg-zinc-900/40">
        <summary className="cursor-pointer px-2 py-2 text-xs font-medium text-zinc-400">
          Hidden attributes
        </summary>
        <div className="max-h-52 overflow-y-auto border-t border-zinc-800 px-2 py-2 cm-scroll">
          <StaffAttrMinGrid specs={STAFF_HIDDEN_ATTR_FILTERS} attrMins={staffAttrMins} setStaffAttrMinAt={setStaffAttrMinAt} />
        </div>
      </details>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="text-zinc-400">Active minimums</span>
          <span className="inline-flex h-6 w-12 items-center justify-center rounded border border-zinc-600 bg-zinc-950 font-mono text-emerald-200/90">
            {activeStaffAttrFilterCount}
          </span>
          <span className="shrink-0 text-zinc-500">Match ≥</span>
          <button
            type="button"
            disabled={activeStaffAttrFilterCount === 0}
            className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-zinc-900 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => adjustStaffMatchAtLeast(-1)}
          >
            ▼
          </button>
          <input
            type="text"
            inputMode="numeric"
            className="h-6 w-12 rounded border border-zinc-700 bg-zinc-950 px-1 text-center font-mono text-[11px] text-zinc-200"
            value={staffAttrMinMatchAtLeast}
            onChange={(e) => setStaffAttrMinMatchAtLeast(e.target.value.replace(/\D/g, ''))}
            placeholder="all"
            disabled={activeStaffAttrFilterCount === 0}
          />
          <button
            type="button"
            disabled={activeStaffAttrFilterCount === 0}
            className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-zinc-900 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => adjustStaffMatchAtLeast(1)}
          >
            ▲
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">
          Empty “Match ≥” = every set minimum must pass. Coaching rows need a linked backroom profile.
        </p>
      </div>
    </>
  )
}
