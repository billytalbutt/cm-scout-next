import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import type { ProfilePayload } from './vite-env.d'
import { CM_SCOUT_ATTR_LABELS } from '../../shared/cmScoutAttrLabels'

type Row = {
  staffId: number
  staffIndex: number
  name: string
  nation: string
  secondNation?: string
  club: string
  ca: number
  pa: number
  wage: number
  value: number
  age: number | null
  euPassport?: boolean
  cmScoutRatingBp?: number
  isDemo?: boolean
}

const columnHelper = createColumnHelper<Row>()

/** Shown immediately and if IPC fails — same as main-process demo row. */
const DEMO_FALLBACK: Row[] = [
  {
    staffId: -1,
    staffIndex: -1,
    name: 'Maxim Tsigalko',
    nation: 'Belarus',
    secondNation: '',
    club: 'Dinamo Minsk',
    ca: 187,
    pa: 200,
    wage: 18500,
    value: 12_500_000,
    age: 22,
    euPassport: false,
    cmScoutRatingBp: 91.4,
    isDemo: true,
  },
]

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

function attrColor(v: number, invert = false): string {
  const x = invert ? 21 - v : v
  if (x >= 18) return 'text-emerald-300 font-semibold'
  if (x >= 15) return 'text-emerald-200/90'
  if (x >= 12) return 'text-zinc-200'
  if (x >= 8) return 'text-amber-200/80'
  return 'text-rose-300/90'
}

export function App() {
  const [loadInfo, setLoadInfo] = useState<{
    path: string
    compressed: boolean
    gameDate: string | null
    playerCount: number
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>(DEMO_FALLBACK)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'rating', desc: true }])
  const [q, setQ] = useState('')
  const [nation, setNation] = useState('')
  const [club, setClub] = useState('')
  const [caMin, setCaMin] = useState('')
  const [caMax, setCaMax] = useState('')
  const [paMin, setPaMin] = useState('')
  const [paMax, setPaMax] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [wageMin, setWageMin] = useState('')
  const [wageMax, setWageMax] = useState('')
  const [contractType, setContractType] = useState('')
  const [tlClub, setTlClub] = useState(false)
  const [tlRequest, setTlRequest] = useState(false)
  const [loanListed, setLoanListed] = useState(false)
  const [euOnly, setEuOnly] = useState(false)
  const [bosmanOnly, setBosmanOnly] = useState(false)
  const [minReleaseClause, setMinReleaseClause] = useState(false)
  const [expiresWithinMonths, setExpiresWithinMonths] = useState('')
  const [attrMins, setAttrMins] = useState<string[]>(() => Array.from({ length: 48 }, () => ''))
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [opening, setOpening] = useState(false)
  const dblGuard = useRef<{ t: number; sid: number }>({ t: 0, sid: -1 })

  const refresh = useCallback(async () => {
    const f: Record<string, unknown> = { q, nation, club }
    const num = (s: string) => (s === '' ? undefined : Number(s))
    const caLo = num(caMin)
    const caHi = num(caMax)
    const paLo = num(paMin)
    const paHi = num(paMax)
    const ageLo = num(ageMin)
    const ageHi = num(ageMax)
    const vLo = num(valueMin)
    const vHi = num(valueMax)
    const wLo = num(wageMin)
    const wHi = num(wageMax)
    if (Number.isFinite(caLo)) f.caMin = caLo
    if (Number.isFinite(caHi)) f.caMax = caHi
    if (Number.isFinite(paLo)) f.paMin = paLo
    if (Number.isFinite(paHi)) f.paMax = paHi
    if (Number.isFinite(ageLo)) f.ageMin = ageLo
    if (Number.isFinite(ageHi)) f.ageMax = ageHi
    if (Number.isFinite(vLo)) f.valueMin = vLo
    if (Number.isFinite(vHi)) f.valueMax = vHi
    if (Number.isFinite(wLo)) f.wageMin = wLo
    if (Number.isFinite(wHi)) f.wageMax = wHi
    const ct = num(contractType)
    if (contractType.trim() !== '' && Number.isFinite(ct)) f.contractType = ct
    if (tlClub) f.transferListedClub = true
    if (tlRequest) f.transferListedRequest = true
    if (loanListed) f.listedForLoan = true
    if (euOnly) f.euPassport = true
    if (bosmanOnly) f.leavingOnBosman = true
    if (minReleaseClause) f.hasMinimumReleaseClause = true
    const expM = num(expiresWithinMonths)
    if (expiresWithinMonths.trim() !== '' && Number.isFinite(expM) && expM >= 0) {
      f.contractExpiresWithinMonths = Math.floor(expM)
    }
    const mins = attrMins.map((s) => {
      if (s.trim() === '') return null
      const n = Number(s)
      return Number.isFinite(n) && n > 0 ? n : null
    })
    if (mins.some((m) => m != null)) f.attrMins = mins
    try {
      if (typeof window.cmapi?.getRows !== 'function') {
        setErr('Open this app via the Electron window from npm run dev (not a browser tab).')
        setRows(DEMO_FALLBACK)
        return
      }
      const r = await window.cmapi.getRows(f)
      const list = Array.isArray(r) ? r : []
      setErr(null)
      if (list.length > 0) {
        setRows(list)
        return
      }
      setRows(loadInfo ? [] : DEMO_FALLBACK)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setRows(loadInfo ? [] : DEMO_FALLBACK)
    }
  }, [
    q,
    nation,
    club,
    caMin,
    caMax,
    paMin,
    paMax,
    ageMin,
    ageMax,
    valueMin,
    valueMax,
    wageMin,
    wageMax,
    contractType,
    tlClub,
    tlRequest,
    loanListed,
    euOnly,
    bosmanOnly,
    minReleaseClause,
    expiresWithinMonths,
    attrMins,
    loadInfo,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadDatabase = useCallback(async () => {
    setErr(null)
    if (typeof window.cmapi?.openDatabase !== 'function') {
      setErr(
        'CM Scout Next must run inside the Electron app window (the packaged .app or npm run dev). A normal browser tab cannot open files.',
      )
      return
    }
    setOpening(true)
    try {
      const r = await window.cmapi.openDatabase()
      if (!r || typeof r !== 'object' || !('ok' in r)) {
        setErr('Unexpected response from the app. Try restarting CM Scout Next.')
        return
      }
      if (!r.ok) {
        if (r.error !== 'cancelled') setErr(r.error)
        return
      }
      setLoadInfo({
        path: r.path,
        compressed: r.compressed,
        gameDate: r.gameDate,
        playerCount: r.playerCount,
      })
      setErr(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setRows(DEMO_FALLBACK)
    } finally {
      setOpening(false)
    }
  }, [])

  const columns = useMemo(
    () => [
      columnHelper.accessor((r) => r.cmScoutRatingBp ?? -1, {
        id: 'rating',
        header: 'CM Scout %',
        cell: ({ row }) => {
          const v = row.original.cmScoutRatingBp
          return v == null ? <span className="text-zinc-600">—</span> : <span>{v.toFixed(1)}%</span>
        },
      }),
      columnHelper.accessor('name', {
        header: 'Player',
        cell: (info) => (
          <span className="flex items-center gap-2">
            {info.row.original.isDemo && (
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                Demo
              </span>
            )}
            <span>{info.getValue()}</span>
          </span>
        ),
      }),
      columnHelper.accessor((r) => r.age ?? -1, {
        id: 'age',
        header: 'Age',
        cell: ({ row }) => (row.original.age == null ? '—' : String(row.original.age)),
      }),
      columnHelper.accessor('nation', {
        header: 'Nation',
        cell: ({ row }) => {
          const s = row.original.secondNation
          return s ? (
            <span>
              {row.original.nation}
              <span className="text-zinc-500"> / {s}</span>
            </span>
          ) : (
            row.original.nation
          )
        },
      }),
      columnHelper.accessor((r) => (r.euPassport ? 1 : 0), {
        id: 'eu',
        header: 'EU',
        cell: ({ row }) =>
          row.original.euPassport ? (
            <span className="text-emerald-400/90" title="EU-style nation (nation.dat GroupMembership)">
              Y
            </span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      }),
      columnHelper.accessor('club', { header: 'Club' }),
      columnHelper.accessor('ca', { header: 'CA' }),
      columnHelper.accessor('pa', { header: 'PA' }),
      columnHelper.accessor('wage', {
        header: 'Wage',
        cell: (info) => fmtMoney(info.getValue()),
      }),
      columnHelper.accessor('value', {
        header: 'Value',
        cell: (info) => fmtMoney(info.getValue()),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.staffIndex),
  })

  const pick = useCallback(async (staffIndex: number) => {
    setSel(staffIndex)
    if (typeof window.cmapi?.getProfile !== 'function') return
    const p = await window.cmapi.getProfile(staffIndex)
    setProfile(p)
  }, [])

  const activateProfile = useCallback(
    (staffIndex: number) => {
      const now = Date.now()
      const g = dblGuard.current
      if (g.sid === staffIndex && now - g.t < 450) return
      g.t = now
      g.sid = staffIndex
      void pick(staffIndex)
    },
    [pick],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || sel == null) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, button')) return
      e.preventDefault()
      void pick(sel)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, pick])

  const setAttrMinAt = (i: number, v: string) => {
    setAttrMins((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-5 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">CM Scout Next</h1>
          <p className="text-xs text-zinc-500">Championship Manager 01/02 · CM Scout–aligned data</p>
        </div>
        <button
          type="button"
          disabled={opening}
          onClick={() => void loadDatabase()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opening ? 'Opening…' : 'Load Database'}
        </button>
      </header>

      {err && (
        <div className="border-b border-rose-900/50 bg-rose-950/40 px-5 py-2 text-sm text-rose-200">{err}</div>
      )}

      {loadInfo && (
        <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-zinc-800/60 bg-zinc-900/40 px-5 py-2 text-xs text-zinc-400">
          <span className="truncate max-w-md" title={loadInfo.path}>
            {loadInfo.path}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
            {loadInfo.compressed ? 'Compressed' : 'Uncompressed'}
          </span>
          {loadInfo.gameDate && <span>Game date: {loadInfo.gameDate}</span>}
          <span className="text-emerald-400/90">{loadInfo.playerCount} players</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="cm-scroll w-[22rem] shrink-0 overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/50 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Filters</h2>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">Search name</span>
              <input
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100 outline-none focus:border-emerald-600"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Zidane"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">Nation (1st or 2nd)</span>
              <input
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                value={nation}
                onChange={(e) => setNation(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">Club</span>
              <input
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                value={club}
                onChange={(e) => setClub(e.target.value)}
              />
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
                <span className="mb-1 block text-xs text-zinc-500">CA min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={caMin}
                  onChange={(e) => setCaMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">CA max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={caMax}
                  onChange={(e) => setCaMax(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">PA min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={paMin}
                  onChange={(e) => setPaMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">PA max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={paMax}
                  onChange={(e) => setPaMax(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">Value min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">Value max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
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
            <div>
              <span className="mb-1 block text-xs text-zinc-500">Contract type (exact byte, empty = any)</span>
              <input
                type="number"
                min={0}
                max={255}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
              <span className="text-xs font-medium text-zinc-400">Transfer / loan</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={tlClub} onChange={(e) => setTlClub(e.target.checked)} />
                Listed by club
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={tlRequest} onChange={(e) => setTlRequest(e.target.checked)} />
                Listed by request
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={loanListed} onChange={(e) => setLoanListed(e.target.checked)} />
                Listed for loan
              </label>
            </div>
            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
              <span className="text-xs font-medium text-zinc-400">Contract / passport</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={euOnly} onChange={(e) => setEuOnly(e.target.checked)} />
                EU passport (1st or 2nd nation)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={bosmanOnly} onChange={(e) => setBosmanOnly(e.target.checked)} />
                Leaving on Bosman / free
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={minReleaseClause}
                  onChange={(e) => setMinReleaseClause(e.target.checked)}
                />
                Minimum fee release clause
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-zinc-500">
                  Contract expires within (months, empty = any)
                </span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={expiresWithinMonths}
                  onChange={(e) => setExpiresWithinMonths(e.target.value)}
                  placeholder="e.g. 6"
                />
              </label>
            </div>
            <details className="rounded-md border border-zinc-800 bg-zinc-900/40">
              <summary className="cursor-pointer px-2 py-2 text-xs font-medium text-zinc-400">
                Attribute minimums (1–20, in-match scale)
              </summary>
              <div className="max-h-48 overflow-y-auto border-t border-zinc-800 px-2 py-2 cm-scroll">
                <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
                  {CM_SCOUT_ATTR_LABELS.map((label, i) => (
                    <label key={label} className="contents">
                      <span className="truncate text-zinc-500">{label}</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="w-12 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200"
                        value={attrMins[i]}
                        onChange={(e) => setAttrMinAt(i, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="cm-scroll min-h-0 flex-1 overflow-auto p-3">
            <p className="mb-3 rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs leading-relaxed text-zinc-400">
              <span className="font-medium text-zinc-300">CM Scout %</span> uses the same weights file as CM Scout
              Intrinsic (<code className="text-emerald-400/80">WeightsSet_CMScout.txt</code>) and “best position” logic
              (max among roles the player fits). Elite players in a strong database often land in the 70s–90s.{' '}
              <span className="font-medium text-zinc-300">Age</span> uses staff DOB (TCM date) vs the loaded game date when
              available. <span className="font-medium text-zinc-300">EU</span> follows nation.dat{' '}
              <code className="text-zinc-500">GroupMembership == 2</code> (community loader rule).{' '}
              <span className="font-medium text-zinc-300">Profile:</span> single-click, double-click,{' '}
              <kbd className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">Enter</kbd>, or Open profile.
              {!loadInfo && (
                <>
                  {' '}
                  Load <code className="text-emerald-400/90">index.dat</code> for real ratings; demo row is illustrative.
                </>
              )}
            </p>
            {sel != null && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void pick(sel)}
                  className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50"
                >
                  Open profile
                </button>
                <span className="text-[11px] text-zinc-500">for selected row</span>
              </div>
            )}
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-zinc-800">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="cursor-pointer select-none px-2 py-2 font-medium text-zinc-400 hover:text-zinc-200"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSel(row.original.staffIndex)}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      activateProfile(row.original.staffIndex)
                    }}
                    className={`cursor-pointer select-none border-b border-zinc-800/50 hover:bg-zinc-800/40 ${
                      sel === row.original.staffIndex ? 'bg-emerald-950/35' : ''
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="select-none px-2 py-1.5 text-zinc-200"
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          activateProfile(row.original.staffIndex)
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="w-[420px] shrink-0 overflow-y-auto border-l border-zinc-800/80 bg-zinc-950/60 p-4 cm-scroll">
          {!profile && <p className="text-sm text-zinc-500">Select a player for profile & attributes.</p>}
          {profile && (
            <div className="space-y-4">
              {profile.isDemo && (
                <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
                  Demo roster — not loaded from your save. Illustrative stats for Maxim Tsigalko (CM 01/02 archetype).
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-white">{profile.name}</h2>
                <p className="text-sm text-zinc-400">
                  {profile.nation}
                  {profile.euPassport && (
                    <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      EU
                    </span>
                  )}{' '}
                  · {profile.club}
                </p>
                {profile.dobIso && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    DOB <span className="font-mono text-zinc-400">{profile.dobIso}</span>
                  </p>
                )}
                <p className="mt-1 text-sm">
                  <span className="text-zinc-500">CA</span>{' '}
                  <span className="font-mono text-emerald-300">{profile.ca}</span>
                  <span className="mx-2 text-zinc-600">|</span>
                  <span className="text-zinc-500">PA</span>{' '}
                  <span className="font-mono text-emerald-300">{profile.pa}</span>
                </p>
              </div>
              {profile.contract && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                  <h3 className="mb-2 font-semibold text-zinc-300">Contract</h3>
                  <div className="grid grid-cols-2 gap-1 text-zinc-400">
                    <span>Wage</span>
                    <span className="text-right text-zinc-200">{fmtMoney(profile.contract.wage)}</span>
                    <span>Goal bonus</span>
                    <span className="text-right text-zinc-200">{fmtMoney(profile.contract.goalBonus)}</span>
                    <span>Assist bonus</span>
                    <span className="text-right text-zinc-200">{fmtMoney(profile.contract.assistBonus)}</span>
                    <span>Release fee</span>
                    <span className="text-right text-zinc-200">{fmtMoney(profile.contract.releaseFee)}</span>
                    <span>Started</span>
                    <span className="text-right font-mono text-zinc-200">
                      {profile.contract.dateStarted ?? '—'}
                    </span>
                    <span>Expires</span>
                    <span className="text-right font-mono text-zinc-200">
                      {profile.contract.contractExpires ?? '—'}
                    </span>
                    <span>Bosman / free</span>
                    <span className="text-right text-zinc-200">{profile.contract.leavingOnBosman ? 'Yes' : 'No'}</span>
                    <span>Min-fee release</span>
                    <span className="text-right text-zinc-200">
                      {profile.contract.minimumReleaseClause ? 'Yes' : 'No'}
                    </span>
                    <span>Type byte</span>
                    <span className="text-right font-mono text-zinc-200">{profile.contract.type}</span>
                  </div>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  CA18 · in-game / intrinsic / in-match
                </h3>
                <ul className="space-y-1 text-sm">
                  {profile.ca18.map((a) => (
                    <li key={a.key} className="flex justify-between gap-2 rounded px-1 py-0.5 hover:bg-zinc-800/40">
                      <span className="text-zinc-400 capitalize">{a.key.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-xs">
                        <span className={attrColor(a.inGame)}>{a.inGame}</span>
                        <span className="text-zinc-600"> · </span>
                        <span className="text-zinc-500">{a.raw}</span>
                        <span className="text-zinc-600"> · </span>
                        <span className="text-sky-300/80">{a.inMatch}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Physical &amp; other</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(profile.other).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-zinc-500 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span
                        className={`font-mono ${attrColor(
                          v.inGame,
                          k === 'injury_proneness' || k === 'dirtiness',
                        )}`}
                      >
                        {v.inGame}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Staff / hidden (from staff.dat)</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(profile.mentalStaff).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-zinc-500 capitalize">{k}</span>
                      <span className={`font-mono ${attrColor(v.inGame)}`}>{v.inGame}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
