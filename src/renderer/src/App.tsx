import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type MouseEvent, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProfileAttrCell, ProfilePayload } from './vite-env.d'
import type { GridPlayerRow } from '../../shared/gridTypes'
import { gridFlagsForVisibleColumnIds, GRID_DEFAULT_COLUMN_ORDER, sanitizeGridColumnOrder } from '../../shared/gridColumnCatalog'
import { buildGridColumns, createGridColumnHelper } from './grid/gridColumns'
import { GridColumnPickerModal } from './grid/GridColumnPickerModal'
import { loadGridColumnOrder, saveGridColumnOrder } from './grid/gridPersistence'
import { cm0102FootWord, cm0102MoraleWord } from '../../shared/cm0102Bands'
import { CM_SCOUT_ATTR_LABELS } from '../../shared/cmScoutAttrLabels'
import { CM_SCOUT_ROLE_SHORT } from '../../shared/cmScoutRoles'
import { DebouncedTextFilters } from './DebouncedTextFilters'

const gridColHelper = createGridColumnHelper()

const ENGINE_ATTRS_LS = 'cm-scout-next-profile-engine-attrs'
const FILTERS_COLLAPSED_LS = 'cm-scout-next-filters-collapsed'
const PROFILE_PANE_WIDTH_LS = 'cm-scout-next-profile-pane-px'
const DEFAULT_PROFILE_PANE_PX = 400
const MIN_PROFILE_PANE_PX = 240
const MAX_PROFILE_PANE_PX = 720

type EngineSnifferUi = 'off' | 'assist_prospect' | 'striker_finisher'

function readProfilePanePx(): number {
  try {
    const v = localStorage.getItem(PROFILE_PANE_WIDTH_LS)
    if (v != null) {
      const n = parseInt(v, 10)
      if (Number.isFinite(n)) return Math.min(MAX_PROFILE_PANE_PX, Math.max(MIN_PROFILE_PANE_PX, n))
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PROFILE_PANE_PX
}

/** Shown immediately and if IPC fails — same as main-process demo row (`GridPlayerRow` subset). */
const DEMO_FALLBACK: GridPlayerRow[] = [
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
    isRegenLikely: false,
    regenOf: '',
    isDemo: true,
    staffHistCareerApps: 45,
    staffHistCareerGoals: 29,
    staffHistSeasonApps: 26,
    staffHistSeasonGoals: 15,
  },
]

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

/** Long help text on hover only — keeps the chrome minimal until you need it. */
function HoverTip({
  tip,
  children,
  tipClassName = '',
}: {
  tip: ReactNode
  children: ReactNode
  tipClassName?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex max-w-full items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-0 top-full z-[200] mt-1 block max-w-[min(22rem,calc(100vw-2rem)))] rounded-lg border border-zinc-600 bg-zinc-950 p-2.5 text-[11px] leading-snug text-zinc-200 shadow-2xl shadow-black/60 ring-1 ring-zinc-800/90 ${tipClassName}`}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

function InfoDot() {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/80 text-[9px] font-semibold text-zinc-400"
      aria-hidden
    >
      ?
    </span>
  )
}

function attrColor(v: number, invert = false): string {
  const x = invert ? 21 - v : v
  if (x >= 18) return 'text-emerald-300 font-semibold'
  if (x >= 15) return 'text-emerald-200/90'
  if (x >= 12) return 'text-zinc-200'
  if (x >= 8) return 'text-amber-200/80'
  return 'text-rose-300/90'
}

/** Bracket styling when uncapped CA18-style / raw engine value differs from the on-screen number. */
function engineBracketClass(uncapped: number, inGame: number): string {
  if (uncapped > inGame) return 'rounded bg-amber-500/20 px-1 font-semibold text-amber-100 tabular-nums'
  return 'rounded bg-violet-500/15 px-1 font-semibold text-violet-100 tabular-nums'
}

/** Checkbox for bracketed “engine” display when uncapped CA18-style value ≠ on-screen number (Attributes + Hidden). */
function ProfileEngineAttrsControl({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className="flex max-w-full cursor-pointer select-none items-center gap-2 rounded-md border border-zinc-600/90 bg-zinc-950/80 px-2.5 py-2 text-[11px] leading-snug text-zinc-100 shadow-sm shadow-black/20"
      title="Hover the control for a longer explanation."
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 rounded border-zinc-500 text-sky-500 focus:ring-1 focus:ring-sky-500/50"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 font-medium">Show engine value when different</span>
    </label>
  )
}

function ProfileAttrColumn({
  cells,
  showEngineAttrs,
}: {
  cells: ProfileAttrCell[]
  showEngineAttrs?: boolean
}) {
  const tint = (tier?: 'primary' | 'secondary') => {
    if (tier === 'primary') return 'rounded px-1 -mx-1 bg-emerald-500/[0.14]'
    if (tier === 'secondary') return 'rounded px-1 -mx-1 bg-sky-500/[0.11]'
    return ''
  }
  return (
    <ul className="min-w-0 space-y-0.5 text-[12px]">
      {cells.map((a) => (
        <li
          key={a.key}
          className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 ${tint(a.highlightTier)}`}
        >
          <span className="truncate text-zinc-400" title={a.key}>
            {a.label}
          </span>
          <span
            className={`shrink-0 font-mono text-[13px] tabular-nums ${attrColor(a.inGame, a.invert)}`}
            title={`In-game ${a.inGame}${
              showEngineAttrs && a.inGameUncapped !== a.inGame ? ` · engine display ${a.inGameUncapped}` : ''
            } · intrinsic ${a.raw} · in-match ${a.inMatch}`}
          >
            {a.inGame}
            {showEngineAttrs && a.inGameUncapped !== a.inGame && (
              <span className={`ml-0.5 text-[12px] ${engineBracketClass(a.inGameUncapped, a.inGame)}`}>
                ({a.inGameUncapped})
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function FeetMoraleBlock({
  feet,
  showEngineAttrs,
}: {
  feet: ProfilePayload['feetMorale']
  showEngineAttrs?: boolean
}) {
  const tint = (tier?: 'primary' | 'secondary') => {
    if (tier === 'primary') return 'rounded px-1 -mx-1 bg-emerald-500/[0.14]'
    if (tier === 'secondary') return 'rounded px-1 -mx-1 bg-sky-500/[0.11]'
    return ''
  }
  type FootRow = ProfilePayload['feetMorale']['left']
  const row = (label: string, v: FootRow, band: (n: number) => string) => (
    <div
      key={label}
      className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 text-[12px] ${tint(v.highlightTier)}`}
    >
      <span className="text-zinc-400">{label}</span>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={`font-mono text-[13px] tabular-nums ${attrColor(v.inGame)}`}
          title={`In-game ${v.inGame}${
            showEngineAttrs && v.inGameUncapped !== v.inGame ? ` · engine display ${v.inGameUncapped}` : ''
          } · intrinsic ${v.raw} · in-match ${v.inMatch}`}
        >
          {v.inGame}
          {showEngineAttrs && v.inGameUncapped !== v.inGame && (
            <span className={`ml-0.5 text-[12px] ${engineBracketClass(v.inGameUncapped, v.inGame)}`}>
              ({v.inGameUncapped})
            </span>
          )}
        </span>
        <span className="max-w-[9rem] text-right text-[9px] leading-tight text-zinc-500">{band(v.inGame)}</span>
      </div>
    </div>
  )
  return (
    <div className="mt-2 space-y-0.5 border-t border-zinc-700/50 pt-2">
      {row(feet.left.label, feet.left, cm0102FootWord)}
      {row(feet.right.label, feet.right, cm0102FootWord)}
      {row(feet.morale.label, feet.morale, cm0102MoraleWord)}
    </div>
  )
}

export function App() {
  const [loadInfo, setLoadInfo] = useState<{
    path: string
    compressed: boolean
    gameDate: string | null
    playerCount: number
    staffDatRows: number
    playerBlobRows: number
    regenBaseline: {
      active: boolean
      savedAt?: string
      entryCount?: number
      indexPath?: string
    }
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<GridPlayerRow[]>(DEMO_FALLBACK)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'rating', desc: true }])
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
  const [shCareerGoalsMin, setShCareerGoalsMin] = useState('')
  const [shCareerGoalsMax, setShCareerGoalsMax] = useState('')
  const [shSeasonGoalsMin, setShSeasonGoalsMin] = useState('')
  const [shSeasonGoalsMax, setShSeasonGoalsMax] = useState('')
  const [shCareerAppsMin, setShCareerAppsMin] = useState('')
  const [shSeasonAppsMin, setShSeasonAppsMin] = useState('')
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
  const [gridMeta, setGridMeta] = useState<{ total: number } | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadGridColumnOrder())
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null)
  const [clubList, setClubList] = useState<string[]>([])
  const [nationList, setNationList] = useState<string[]>([])
  const [committedText, setCommittedText] = useState({ q: '', nation: '', club: '' })
  const [textFiltersPending, setTextFiltersPending] = useState(false)
  const [gridRefreshing, setGridRefreshing] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(FILTERS_COLLAPSED_LS) === '1'
    } catch {
      return false
    }
  })
  const [browseTab, setBrowseTab] = useState<'players' | 'regens'>('players')
  const [regenOnly, setRegenOnly] = useState(false)
  const [engineSniffer, setEngineSniffer] = useState<EngineSnifferUi>('off')
  const [showEngineAttrs, setShowEngineAttrs] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(ENGINE_ATTRS_LS) === '1'
    } catch {
      return false
    }
  })

  const persistFiltersCollapsed = useCallback((v: boolean) => {
    setFiltersCollapsed(v)
    try {
      localStorage.setItem(FILTERS_COLLAPSED_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const persistShowEngineAttrs = useCallback((v: boolean) => {
    setShowEngineAttrs(v)
    try {
      localStorage.setItem(ENGINE_ATTRS_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const gridInclude = useMemo(() => gridFlagsForVisibleColumnIds(columnOrder), [columnOrder])
  const dblGuard = useRef<{ t: number; sid: number }>({ t: 0, sid: -1 })
  const profileAsideRef = useRef<HTMLDivElement>(null)
  const lastProfilePanePxRef = useRef(readProfilePanePx())
  const [profilePanePx, setProfilePanePx] = useState(() => lastProfilePanePxRef.current)

  useEffect(() => {
    lastProfilePanePxRef.current = profilePanePx
  }, [profilePanePx])

  const onProfileSplitterMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = lastProfilePanePxRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const dw = ev.clientX - startX
      const next = Math.min(MAX_PROFILE_PANE_PX, Math.max(MIN_PROFILE_PANE_PX, startW + dw))
      lastProfilePanePxRef.current = next
      setProfilePanePx(next)
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem(PROFILE_PANE_WIDTH_LS, String(lastProfilePanePxRef.current))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const onProfileSplitterDoubleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    lastProfilePanePxRef.current = DEFAULT_PROFILE_PANE_PX
    setProfilePanePx(DEFAULT_PROFILE_PANE_PX)
    try {
      localStorage.setItem(PROFILE_PANE_WIDTH_LS, String(DEFAULT_PROFILE_PANE_PX))
    } catch {
      /* ignore */
    }
  }, [])

  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current
    setGridRefreshing(true)
    const f: Record<string, unknown> = {
      q: committedText.q,
      nation: committedText.nation,
      club: committedText.club,
    }
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
    const scgMin = num(shCareerGoalsMin)
    const scgMax = num(shCareerGoalsMax)
    const ssgMin = num(shSeasonGoalsMin)
    const ssgMax = num(shSeasonGoalsMax)
    const scaMin = num(shCareerAppsMin)
    const ssaMin = num(shSeasonAppsMin)
    if (Number.isFinite(scgMin)) f.shCareerGoalsMin = scgMin
    if (Number.isFinite(scgMax)) f.shCareerGoalsMax = scgMax
    if (Number.isFinite(ssgMin)) f.shSeasonGoalsMin = ssgMin
    if (Number.isFinite(ssgMax)) f.shSeasonGoalsMax = ssgMax
    if (Number.isFinite(scaMin)) f.shCareerAppsMin = scaMin
    if (Number.isFinite(ssaMin)) f.shSeasonAppsMin = ssaMin
    const ct = num(contractType)
    if (contractType.trim() !== '' && Number.isFinite(ct)) f.contractType = ct
    if (tlClub) f.transferListedClub = true
    if (tlRequest) f.transferListedRequest = true
    if (loanListed) f.listedForLoan = true
    if (euOnly) f.euPassport = true
    if (bosmanOnly) f.leavingOnBosman = true
    if (minReleaseClause) f.hasMinimumReleaseClause = true
    const expM = num(expiresWithinMonths)
    if (expiresWithinMonths.trim() !== '' && Number.isFinite(expM) && expM >= 1) {
      f.contractExpiresWithinMonths = Math.floor(expM)
    }
    const mins = attrMins.map((s) => {
      if (s.trim() === '') return null
      const n = Number(s)
      return Number.isFinite(n) && n > 0 ? n : null
    })
    if (mins.some((m) => m != null)) f.attrMins = mins
    if (browseTab === 'regens') {
      f.isRegenLikely = true
    } else if (regenOnly) {
      f.isRegenLikely = true
    }
    if (engineSniffer !== 'off') f.engineSniffer = engineSniffer
    f.gridInclude = gridInclude
    const ROWS_IPC_PAGE = 12000
    try {
      if (typeof window.cmapi?.getRows !== 'function') {
        if (refreshSeq.current !== seq) return
        setErr('Open this app via the Electron window from npm run dev (not a browser tab).')
        setRows(DEMO_FALLBACK)
        setGridMeta(null)
        return
      }
      const first = await window.cmapi.getRows({ ...f, offset: 0, limit: ROWS_IPC_PAGE } as Record<string, unknown>)
      if (refreshSeq.current !== seq) return
      let list: GridPlayerRow[] = []
      let total = 0
      if (Array.isArray(first)) {
        list = first as GridPlayerRow[]
        total = list.length
      } else if (
        first &&
        typeof first === 'object' &&
        'rows' in first &&
        Array.isArray((first as { rows: unknown }).rows)
      ) {
        const pkt = first as { total: number; rows: GridPlayerRow[] }
        list = [...pkt.rows]
        total = typeof pkt.total === 'number' ? pkt.total : list.length
        let offset = list.length
        while (offset < total) {
          const next = await window.cmapi.getRows({
            ...f,
            offset,
            limit: ROWS_IPC_PAGE,
          } as Record<string, unknown>)
          if (refreshSeq.current !== seq) return
          if (
            !next ||
            typeof next !== 'object' ||
            !('rows' in next) ||
            !Array.isArray((next as { rows: unknown }).rows)
          ) {
            setErr('Unexpected paged row response from the app.')
            list = []
            total = 0
            break
          }
          const n = next as { total: number; rows: GridPlayerRow[] }
          if (typeof n.total === 'number' && n.total !== total) {
            setErr(`Inconsistent total while loading rows (${total} vs ${n.total}). Try refreshing filters.`)
            list = []
            total = 0
            break
          }
          const chunk = n.rows
          if (chunk.length === 0) break
          list.push(...chunk)
          offset += chunk.length
          if (chunk.length < ROWS_IPC_PAGE) break
        }
      }
      setErr(null)
      if (list.length > 0) {
        startTransition(() => {
          setRows(list)
          setGridMeta({ total })
        })
        return
      }
      setGridMeta({ total })
      setRows(loadInfo ? [] : DEMO_FALLBACK)
    } catch (e) {
      if (refreshSeq.current !== seq) return
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setGridMeta(null)
      setRows(loadInfo ? [] : DEMO_FALLBACK)
    } finally {
      if (refreshSeq.current === seq) setGridRefreshing(false)
    }
  }, [
    committedText,
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
    shCareerGoalsMin,
    shCareerGoalsMax,
    shSeasonGoalsMin,
    shSeasonGoalsMax,
    shCareerAppsMin,
    shSeasonAppsMin,
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
    gridInclude,
    browseTab,
    regenOnly,
    engineSniffer,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!profile) return
    profileAsideRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [profile])

  const saveRegenBaseline = useCallback(async () => {
    if (typeof window.cmapi?.saveRegenBaseline !== 'function') return
    const out = await window.cmapi.saveRegenBaseline()
    if (!out || typeof out !== 'object' || !('ok' in out) || !out.ok) {
      const err =
        out && typeof out === 'object' && 'error' in out ? String((out as { error: string }).error) : 'Save failed'
      setErr(err)
      return
    }
    setErr(null)
    setLoadInfo((li) =>
      li
        ? {
            ...li,
            regenBaseline: {
              active: out.active,
              savedAt: out.savedAt,
              entryCount: out.entryCount,
              indexPath: out.indexPath,
            },
          }
        : li,
    )
    void refresh()
  }, [refresh])

  const clearRegenBaseline = useCallback(async () => {
    if (typeof window.cmapi?.clearRegenBaseline !== 'function') return
    const out = await window.cmapi.clearRegenBaseline()
    if (!out || typeof out !== 'object' || !('ok' in out) || !out.ok) {
      const err =
        out && typeof out === 'object' && 'error' in out ? String((out as { error: string }).error) : 'Clear failed'
      setErr(err)
      return
    }
    setErr(null)
    setLoadInfo((li) =>
      li
        ? {
            ...li,
            regenBaseline: {
              active: out.active,
              savedAt: out.savedAt,
              entryCount: out.entryCount,
              indexPath: out.indexPath,
            },
          }
        : li,
    )
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
        staffDatRows: r.staffDatRows,
        playerBlobRows: r.playerBlobRows,
        regenBaseline: r.regenBaseline,
      })
      setClubList(r.clubs)
      setNationList(r.nations ?? [])
      setCommittedText({ q: '', nation: '', club: '' })
      setErr(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setGridMeta(null)
      setRows(DEMO_FALLBACK)
    } finally {
      setOpening(false)
    }
  }, [])

  const columns = useMemo(() => buildGridColumns(gridColHelper, columnOrder), [columnOrder])

  const table = useReactTable<GridPlayerRow>({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.staffIndex),
  })

  const scrollParentRef = useRef<HTMLDivElement>(null)
  const tableRows = table.getRowModel().rows
  const colCount = table.getAllLeafColumns().length

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36,
    overscan: 18,
  })

  const vItems = rowVirtualizer.getVirtualItems()
  const padTop = vItems.length > 0 ? vItems[0]!.start : 0
  const padBottom = vItems.length > 0 ? rowVirtualizer.getTotalSize() - vItems[vItems.length - 1]!.end : 0

  useEffect(() => {
    scrollParentRef.current?.scrollTo({ top: 0 })
  }, [sorting])

  useEffect(() => {
    scrollParentRef.current?.scrollTo({ top: 0 })
  }, [rows])

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

  const applyColumnOrder = useCallback((next: string[]) => {
    const s = sanitizeGridColumnOrder(next)
    const o = s.length > 0 ? s : [...GRID_DEFAULT_COLUMN_ORDER]
    setColumnOrder(o)
    saveGridColumnOrder(o)
  }, [])

  useEffect(() => {
    const sid = sorting[0]?.id
    if (!sid) return
    if (!columnOrder.includes(sid)) {
      const fb = columnOrder[0] ?? 'name'
      setSorting([{ id: fb, desc: fb === 'rating' }])
    }
  }, [sorting, columnOrder])

  useEffect(() => {
    if (!headerMenu) return
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest?.('[data-grid-header-menu]')) return
      setHeaderMenu(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [headerMenu])

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
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-zinc-800/60 bg-zinc-900/40 px-5 py-2 text-xs text-zinc-400">
            <span className="truncate max-w-md" title={loadInfo.path}>
              {loadInfo.path}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300">
              {loadInfo.compressed ? 'Compressed' : 'Uncompressed'}
            </span>
            {loadInfo.gameDate && <span>Game date: {loadInfo.gameDate}</span>}
            <span className="text-emerald-400/90">
              {loadInfo.playerCount.toLocaleString()} playable in grid
            </span>
            <span className="text-zinc-500">
              staff.dat {loadInfo.staffDatRows.toLocaleString()} rows · player.dat{' '}
              {loadInfo.playerBlobRows.toLocaleString()} rows
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800/50 bg-zinc-950/45 px-5 py-2 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-zinc-500">Regen tracking</span>
            <HoverTip
              tip={
                <div className="space-y-2 text-zinc-300">
                  <p>
                    <span className="font-medium text-white">GPF2-style</span> (Generated Player Finder 2): save a
                    snapshot right after you load a game — later, when you open the <strong>same file path</strong> again,
                    we compare each staff <code className="text-zinc-400">id</code> to that snapshot. If the name-id
                    triple changed but the id is the same, we treat it like the community tool: same slot, new face =
                    likely regen; <strong>Regen of</strong> shows the old snapshot name.
                  </p>
                  <p className="text-zinc-400">
                    Use an <strong>uncompressed</strong> save (Game Settings → Save Compressed = No), as with GPF2.
                    If no snapshot exists, we fall back to the same-save PA + nation + positions + DOB heuristic (weaker).
                  </p>
                </div>
              }
            >
              <span className="inline-flex cursor-default items-center gap-1 text-zinc-400">
                How it works
                <InfoDot />
              </span>
            </HoverTip>
            {loadInfo.regenBaseline.active ? (
              <span className="text-emerald-400/90">
                Snapshot on · {loadInfo.regenBaseline.entryCount?.toLocaleString() ?? '—'} players ·{' '}
                <span className="font-mono text-emerald-200/90">
                  {(loadInfo.regenBaseline.savedAt ?? '').slice(0, 19).replace('T', ' ')}
                </span>
              </span>
            ) : (
              <span className="text-zinc-500">No snapshot — save one after load for GPF2-style accuracy</span>
            )}
            <button
              type="button"
              onClick={() => void saveRegenBaseline()}
              className="rounded-md border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-900/40"
            >
              Save snapshot
            </button>
            {loadInfo.regenBaseline.active && (
              <button
                type="button"
                onClick={() => void clearRegenBaseline()}
                className="rounded-md border border-zinc-600 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Clear snapshot
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-800/60 bg-zinc-900/30 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <HoverTip
              tip={
                <>
                  Affects the <span className="text-zinc-300">profile</span> attribute lists only: when on, bracketed
                  values appear if the uncapped engine-style number differs from the in-game display (mostly CA18
                  conversions).
                </>
              }
            >
              <span className="inline-flex cursor-default">
                <ProfileEngineAttrsControl checked={showEngineAttrs} onChange={persistShowEngineAttrs} />
              </span>
            </HoverTip>
          </div>
        </>
      )}

      <div className="flex min-h-0 flex-1">
        {filtersCollapsed ? (
          <div className="flex w-11 shrink-0 flex-col items-center border-r border-zinc-800/80 bg-zinc-950/70 py-2">
            <button
              type="button"
              title="Show filters"
              aria-expanded={false}
              onClick={() => persistFiltersCollapsed(false)}
              className="flex flex-col items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 hover:border-emerald-600/50 hover:bg-zinc-800 hover:text-emerald-200"
            >
              <span aria-hidden className="text-base leading-none text-zinc-500">
                ▸
              </span>
              <span className="max-w-[2.5rem] text-center leading-tight">Filters</span>
            </button>
          </div>
        ) : (
          <aside className="relative z-20 flex w-[22rem] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/50">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-800/60 px-3 py-2.5">
              <HoverTip
                tip={
                  <>
                    Checkboxes and numbers apply immediately. Name, nation, and club text commit after a short pause (~95
                    ms) so the grid is not recomputed on every keystroke; a subtle overlay shows while the list updates.
                  </>
                }
              >
                <h2 className="flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Filters
                  <InfoDot />
                </h2>
              </HoverTip>
              <button
                type="button"
                title="Hide filters (more room for the grid)"
                aria-expanded
                onClick={() => persistFiltersCollapsed(true)}
                className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Hide
              </button>
            </div>
            <div className="cm-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            <DebouncedTextFilters
              key={loadInfo?.path ?? 'pre'}
              nationList={nationList}
              clubList={clubList}
              onCommit={setCommittedText}
              onPendingChange={setTextFiltersPending}
            />
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
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH career goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerGoalsMin}
                  onChange={(e) => setShCareerGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH career goals max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerGoalsMax}
                  onChange={(e) => setShCareerGoalsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH season goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonGoalsMin}
                  onChange={(e) => setShSeasonGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH season goals max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonGoalsMax}
                  onChange={(e) => setShSeasonGoalsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH career apps min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerAppsMin}
                  onChange={(e) => setShCareerAppsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-zinc-500">SH season apps min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonAppsMin}
                  onChange={(e) => setShSeasonAppsMin(e.target.value)}
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
            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
              <span className="text-xs font-medium text-zinc-400">Regens</span>
              <label
                className={`flex items-center gap-2 text-xs ${
                  browseTab === 'regens' ? 'cursor-not-allowed text-zinc-500' : 'cursor-pointer text-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={regenOnly}
                  disabled={browseTab === 'regens'}
                  onChange={(e) => setRegenOnly(e.target.checked)}
                />
                Likely regen only <span className="text-zinc-600">(heuristic)</span>
              </label>
              {browseTab === 'regens' && (
                <p className="text-[10px] leading-snug text-zinc-500">
                  Regens tab is on — switch to All players to use this checkbox with the full list.
                </p>
              )}
            </div>
            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
              <HoverTip
                tip={
                  <div className="space-y-2 text-zinc-300">
                    <p className="font-medium text-white">Heuristic only</p>
                    <p>
                      Thresholds use raw bytes from your save (normally 1–20 on screen). Values{' '}
                      <span className="font-mono text-zinc-300">21+</span> match editor “intrinsic” overflow (e.g. 23–24)
                      and are treated as top-tier for that attribute.
                    </p>
                    <p>
                      <span className="font-medium text-emerald-200/90">Assist prospect</span> — Strict playmaker
                      lane: decisions / anticipation / teamwork 18+; passing / technique 18+, creativity 17+; stamina /
                      agility / balance 17+; consistency / important matches / adaptability 17+; corners or set
                      pieces 16+. Needs three of (decisions, anticipation, passing, technique, creativity) at 19+ unless
                      one of those is <span className="font-mono text-zinc-300">21+</span> raw (overflow), then slightly
                      relaxed floors with two at 19+. If any of those five is <span className="font-mono text-zinc-300">22+</span>, a shorter “super
                      overflow” path applies (still distributor roles only).
                    </p>
                    <p>
                      <span className="font-medium text-emerald-200/90">Striker finisher</span> — Tsigalko lane: pace,
                      acceleration, finishing, off the ball, flair, technique all 18+, with five of six at 19+; if any
                      of those six is <span className="font-mono text-zinc-300">21+</span> raw, all six stay 17+ and four
                      at 19+. If any core is <span className="font-mono text-zinc-300">22+</span>, all six 16+, balance /
                      dribbling 17+, mentals 16+, determination 17+. Balance / dribbling 18+ otherwise; consistency /
                      big games 17+; determination 18+.
                    </p>
                  </div>
                }
              >
                <span className="flex cursor-default items-center text-xs font-medium text-zinc-400">
                  Engine sniffer
                  <InfoDot />
                </span>
              </HoverTip>
              <select
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-600"
                value={engineSniffer}
                onChange={(e) => setEngineSniffer(e.target.value as EngineSnifferUi)}
              >
                <option value="off">Off</option>
                <option value="assist_prospect">Assist prospect (playmaker meta)</option>
                <option value="striker_finisher">Striker finisher (Tsigalko-shaped)</option>
              </select>
            </div>
          </div>
          </aside>
        )}

        <div className="flex min-h-0 min-w-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ flex: '1 1 0%', minWidth: '12rem' }}>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Browse</span>
            <button
              type="button"
              onClick={() => setBrowseTab('players')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'players'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              All players
            </button>
            <button
              type="button"
              onClick={() => setBrowseTab('regens')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'regens'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              Regens
            </button>
            {browseTab === 'regens' && loadInfo && (
              <span className="text-[10px] text-zinc-500">
                Heuristic list only — grid columns can still show Is regen / Regen of.
              </span>
            )}
          </div>
          <div ref={scrollParentRef} className="cm-scroll relative min-h-0 flex-1 overflow-auto p-3">
            {(textFiltersPending || gridRefreshing) && loadInfo && (
              <div
                className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-zinc-950/35 pt-16 backdrop-blur-[2px]"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-zinc-900/95 px-5 py-3 shadow-2xl shadow-emerald-950/40">
                  <span
                    className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-emerald-400/25 border-t-emerald-400"
                    style={{ animation: 'cm-spin 0.7s linear infinite' }}
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium text-emerald-100/95">Updating player list…</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {textFiltersPending && !gridRefreshing
                        ? 'Applying name / nation / club…'
                        : 'Filtering in the main process — large databases can take a moment.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-3">
              <HoverTip
                tip={
                  <div className="space-y-2 text-zinc-300">
                    <p>
                      <span className="font-medium text-white">CM Scout %</span> follows{' '}
                      <span className="text-zinc-400">CM Scout Intrinsic</span> (
                      <code className="text-emerald-400/80">DataService.CalculateRating</code> +{' '}
                      <code className="text-emerald-400/80">WeightsSet_CMScout.txt</code>
                      ): CA18 attributes are turned into “in-match” values, scaled to 1–20 using the min/max seen in
                      your loaded database, then weighted. The main grid number is{' '}
                      <span className="font-medium text-white">BP</span> (best among roles where natural position ≥15),
                      not necessarily the DM/M/AM column — add the seven role columns to line up with another tool’s
                      per-position percentages.
                    </p>
                    <p>
                      <span className="font-medium text-white">Age</span> uses staff DOB (TCM date) vs the loaded game
                      date when available. <span className="font-medium text-white">EU</span> follows nation.dat{' '}
                      <code className="text-zinc-400">GroupMembership == 2</code> (community loader rule).
                    </p>
                    <p>
                      <span className="font-medium text-white">Profile:</span> single-click, double-click,{' '}
                      <kbd className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">Enter</kbd>, or Open profile.
                    </p>
                    {!loadInfo && (
                      <p>
                        Load <code className="text-emerald-400/90">index.dat</code> for real ratings; demo row is
                        illustrative.
                      </p>
                    )}
                  </div>
                }
              >
                <span className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">Scouting &amp; profile</span>
                  <InfoDot />
                </span>
              </HoverTip>
            </div>
            {loadInfo && rows.length === 0 && (
              <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                {browseTab === 'regens'
                  ? 'No heuristic regens match the current filters. Try All players, or relax filters — the regen list is a same-save guess, not exhaustive.'
                  : 'No players match the current filters. Clear text fields and uncheck boxes to see the full squad again.'}
              </p>
            )}
            {loadInfo && gridMeta && rows.length > 0 && (
              <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  Showing <span className="font-mono text-zinc-300">{rows.length.toLocaleString()}</span> loaded rows
                  {' · '}
                  total matching <span className="font-mono text-zinc-300">{gridMeta.total.toLocaleString()}</span>
                </span>
                <HoverTip
                  tip={
                    <div className="space-y-2">
                      <p>
                        Fetched in pages over IPC so large saves stay reliable; sorts stay client-side on the full set.
                        The table virtualizes rows.
                      </p>
                      <p className="text-zinc-400">
                        With a <strong>regen snapshot</strong> (Save snapshot in the bar above), same staff id + new
                        name ids is used first (GPF2-style). Otherwise: PA + nationalities + positions + DOB heuristic.
                        Not guaranteed.
                      </p>
                    </div>
                  }
                >
                  <span className="inline-flex cursor-default items-center gap-0.5 rounded border border-zinc-700/70 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    Grid details
                    <InfoDot />
                  </span>
                </HoverTip>
              </p>
            )}
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
                  <tr
                    key={hg.id}
                    className="border-b border-zinc-800"
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setHeaderMenu({ x: e.clientX, y: e.clientY })
                    }}
                  >
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
                {padTop > 0 && (
                  <tr aria-hidden className="pointer-events-none border-0">
                    <td
                      colSpan={colCount}
                      style={{ height: padTop, padding: 0, border: 'none', lineHeight: 0, fontSize: 0 }}
                    />
                  </tr>
                )}
                {vItems.map((vi) => {
                  const row = tableRows[vi.index]!
                  return (
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
                  )
                })}
                {padBottom > 0 && (
                  <tr aria-hidden className="pointer-events-none border-0">
                    <td
                      colSpan={colCount}
                      style={{ height: padBottom, padding: 0, border: 'none', lineHeight: 0, fontSize: 0 }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize player grid and profile"
          title="Drag to resize · double-click to reset width"
          className="group relative w-1.5 shrink-0 cursor-col-resize select-none bg-zinc-900/40 hover:bg-emerald-950/30"
          onMouseDown={onProfileSplitterMouseDown}
          onDoubleClick={onProfileSplitterDoubleClick}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-zinc-700 group-hover:bg-emerald-500/70" />
        </div>

        <aside
          ref={profileAsideRef}
          style={{ width: profilePanePx, maxWidth: 'min(720px, 92vw)' }}
          className="min-w-[240px] shrink-0 overflow-y-auto overflow-x-hidden border-l border-zinc-800/80 bg-zinc-950/60 p-4 cm-scroll"
        >
          {!profile && <p className="text-sm text-zinc-500">Select a player for profile & attributes.</p>}
          {profile && (
            <div className="space-y-4">
              {profile.isDemo && (
                <div className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
                  Demo roster — not loaded from your save. Illustrative stats for Maxim Tsigalko (CM 01/02 archetype).
                </div>
              )}
              <div className="border-b border-zinc-800/80 pb-3">
                <h2 className="text-xl font-semibold tracking-tight text-white">{profile.name}</h2>
                <p className="mt-1 text-sm font-medium text-emerald-200/90">{profile.positionLabel}</p>
                <p className="mt-1.5 text-sm text-zinc-200">
                  {profile.nationDisplay}
                  {profile.euPassport && (
                    <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      EU
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{profile.club}</p>
                {(profile.seasonStats.internationalCaps.apps > 0 ||
                  profile.seasonStats.internationalCaps.goals > 0) && (
                  <p className="mt-1 text-xs text-zinc-400">
                    International{' '}
                    <span className="font-mono text-zinc-200">{profile.seasonStats.internationalCaps.apps}</span> caps
                    {profile.seasonStats.internationalCaps.goals > 0 && (
                      <>
                        {' '}
                        ·{' '}
                        <span className="font-mono text-zinc-200">{profile.seasonStats.internationalCaps.goals}</span>{' '}
                        goals
                      </>
                    )}
                  </p>
                )}
                {(profile.age != null || profile.dobIso) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {profile.age != null && (
                      <>
                        Age <span className="font-mono text-zinc-300">{profile.age}</span>
                      </>
                    )}
                    {profile.age != null && profile.dobIso && <span className="text-zinc-600"> · </span>}
                    {profile.dobIso && (
                      <>
                        DOB <span className="font-mono text-zinc-400">{profile.dobIso}</span>
                      </>
                    )}
                  </p>
                )}
                <p className="mt-2 text-sm">
                  <span className="text-zinc-500">CA</span>{' '}
                  <span className="font-mono text-emerald-300">{profile.ca}</span>
                  <span className="mx-2 text-zinc-600">|</span>
                  <span className="text-zinc-500">PA</span>{' '}
                  <span className="font-mono text-emerald-300">{profile.pa}</span>
                </p>
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  <span className="text-zinc-500">Rep</span>{' '}
                  <span className="text-zinc-600">home</span>{' '}
                  <span className="font-mono text-zinc-200">{profile.reputation.home.toLocaleString()}</span>
                  <span className="mx-1.5 text-zinc-700">·</span>
                  <span className="text-zinc-600">current</span>{' '}
                  <span className="font-mono text-zinc-200">{profile.reputation.current.toLocaleString()}</span>
                  <span className="mx-1.5 text-zinc-700">·</span>
                  <span className="text-zinc-600">world</span>{' '}
                  <span className="font-mono text-zinc-200">{profile.reputation.world.toLocaleString()}</span>
                </p>
                <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                  <h3 className="mb-2 font-semibold text-zinc-300">Transfer</h3>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-400">
                    <span>Value</span>
                    <span className="text-right font-mono text-zinc-200">{fmtMoney(profile.transfer.value)}</span>
                    <span>Listed by club</span>
                    <span className={`text-right ${profile.transfer.listedByClub ? 'text-emerald-300' : 'text-zinc-500'}`}>
                      {profile.transfer.listedByClub ? 'Yes' : 'No'}
                    </span>
                    <span>Listed by request</span>
                    <span
                      className={`text-right ${profile.transfer.listedByRequest ? 'text-emerald-300' : 'text-zinc-500'}`}
                    >
                      {profile.transfer.listedByRequest ? 'Yes' : 'No'}
                    </span>
                    <span>Listed for loan</span>
                    <span className={`text-right ${profile.transfer.listedForLoan ? 'text-emerald-300' : 'text-zinc-500'}`}>
                      {profile.transfer.listedForLoan ? 'Yes' : 'No'}
                    </span>
                    <span>Future transfer arranged</span>
                    <span className="text-right text-zinc-200">
                      {profile.transfer.futureTransferToClubName ?? '—'}
                    </span>
                  </div>
                </div>
                {profile.cmScoutRolePercents && profile.cmScoutRolePercents.length === 7 && (
                  <div className="mt-3 rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-2.5">
                    <HoverTip
                      tip={
                        <div className="space-y-2">
                          <p>
                            Same formula as CM Scout Intrinsic: each column is a weighted blend of normalized attributes
                            for that weight set (injury/dirtiness inverted). Shown for all seven roles; grid “CM Scout %”
                            uses the best among roles the player is considered suitable for (highlighted).
                          </p>
                          {profile.cmScoutRatingBp != null &&
                            profile.cmScoutRolePercents &&
                            Math.max(...profile.cmScoutRolePercents) > profile.cmScoutRatingBp + 0.05 && (
                              <p className="text-amber-200/90">
                                The amber ring marks the highest value among all seven columns. Grid BP can be lower if
                                that column is not a “suitable” role for this player.
                              </p>
                            )}
                        </div>
                      }
                    >
                      <h3 className="flex cursor-default items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        CM Scout % by role
                        <InfoDot />
                      </h3>
                    </HoverTip>
                    {profile.cmScoutRatingBp != null && (
                      <p className="mt-1 font-mono text-[11px] text-emerald-300/95">
                        BP (grid){' '}
                        <span className="text-emerald-200">{profile.cmScoutRatingBp}%</span>
                      </p>
                    )}
                    {profile.cmScoutRatingBp != null &&
                      profile.cmScoutRolePercents &&
                      Math.max(...profile.cmScoutRolePercents) > profile.cmScoutRatingBp + 0.05 && (
                        <p className="mt-1 text-[9px] text-zinc-500">
                          Amber ring = highest role column (hover heading for why BP can differ).
                        </p>
                      )}
                    <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                      {CM_SCOUT_ROLE_SHORT.map((lab, i) => {
                        const pct = profile.cmScoutRolePercents![i]!
                        const suit = profile.cmScoutRoleSuitable?.[i]
                        const bestIdx = profile.cmScoutRolePercents!.reduce(
                          (bi, v, j) => (v > profile.cmScoutRolePercents![bi]! ? j : bi),
                          0,
                        )
                        const isBest = i === bestIdx
                        return (
                          <div
                            key={lab}
                            className={`min-w-0 rounded border px-0.5 py-1 ${
                              suit
                                ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                                : 'border-zinc-800/80 bg-zinc-950/40'
                            } ${isBest ? 'ring-1 ring-amber-500/40' : ''}`}
                          >
                            <div className="truncate text-[8px] font-medium uppercase tracking-tight text-zinc-500">
                              {lab}
                            </div>
                            <div
                              className={`font-mono text-[10px] tabular-nums ${isBest ? 'text-amber-200' : 'text-zinc-200'}`}
                            >
                              {pct}%
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
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

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                <HoverTip
                  tip={
                    <div className="space-y-2 text-zinc-300">
                      <p>
                        Loaded from <code className="text-emerald-400/80">staff_history.dat</code> (one row per club per
                        season-year tag in the save; league and cups are aggregated into that row). Rows whose{' '}
                        <code className="text-zinc-400">year</code> matches the highlighted season are tinted. Assists and
                        average rating are not in this block (shown as —).
                      </p>
                      {profile.seasonStats.saveCalendarYear != null && (
                        <p className="text-[11px]">
                          Save calendar year{' '}
                          <span className="font-mono text-zinc-100">{profile.seasonStats.saveCalendarYear}</span>
                          {profile.seasonStats.boundaryDayOfYearUsed != null && (
                            <>
                              {' '}
                              · season boundary ≈ day-of-year{' '}
                              <span className="font-mono text-zinc-100">
                                {profile.seasonStats.boundaryDayOfYearUsed}
                              </span>
                              <span className="text-zinc-500">
                                {' '}
                                (average <code className="text-zinc-500">SeasonUpdateDay</code> from nation.dat when
                                present; otherwise 1 July)
                              </span>
                            </>
                          )}
                        </p>
                      )}
                      {profile.seasonStats.currentYearResolution === 'calendar_fallback' && (
                        <p className="text-amber-200/90">
                          No <code className="text-amber-200/70">staff_history</code> rows matched the season-tagged
                          year; totals use the save&apos;s calendar year instead. If your DB uses a different convention,
                          tell us what you see in-game.
                        </p>
                      )}
                      {profile.seasonStats.inferredDomesticLeague && (
                        <p>
                          Primary league from <code className="text-zinc-500">club.dat</code> division →{' '}
                          <code className="text-zinc-500">club_comp.dat</code>:{' '}
                          <span className="font-medium text-zinc-100">
                            {profile.seasonStats.inferredDomesticLeague.name}
                          </span>{' '}
                          <span className="text-zinc-500">
                            (id {profile.seasonStats.inferredDomesticLeague.competitionId})
                          </span>
                        </p>
                      )}
                    </div>
                  }
                >
                  <h3 className="mb-2 flex cursor-default items-center font-semibold text-zinc-300">
                    Season &amp; career record
                    <InfoDot />
                  </h3>
                </HoverTip>
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                  <span>
                    Career:{' '}
                    <span className="font-mono text-zinc-200">{profile.seasonStats.careerTotals.apps}</span> apps ·{' '}
                    <span className="font-mono text-zinc-200">{profile.seasonStats.careerTotals.goals}</span> goals
                  </span>
                  {profile.seasonStats.highlightHistoryYear != null && (
                    <span>
                      Season <code className="text-zinc-500">year</code>{' '}
                      <span className="font-mono text-emerald-200/90">{profile.seasonStats.highlightHistoryYear}</span>:
                      <span className="font-mono text-emerald-200/90">
                        {' '}
                        {profile.seasonStats.currentSeasonTotals.apps}
                      </span>{' '}
                      apps ·{' '}
                      <span className="font-mono text-emerald-200/90">
                        {profile.seasonStats.currentSeasonTotals.goals}
                      </span>{' '}
                      goals
                    </span>
                  )}
                </div>
                {profile.seasonStats.allSeasons.length === 0 && (
                  <p className="mb-2 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-2 text-[11px] leading-snug text-zinc-400">
                    {!profile.seasonStats.staffHistoryParsed ? (
                      <>
                        This index did not load <code className="text-zinc-500">staff_history.dat</code> (block
                        missing, empty, or decompressed size is not a multiple of 17-byte rows — some saves use a
                        4-byte prefix, which we now skip automatically when it fits). Reload after a game has written
                        history, or try an uncompressed save.
                      </>
                    ) : (
                      <>
                        No rows in <code className="text-zinc-500">staff_history.dat</code> for this staff id yet —
                        common before they register competitive minutes, or if this database omits history for them.
                        International caps from <code className="text-zinc-500">staff.dat</code> still show above when
                        non-zero.
                      </>
                    )}
                  </p>
                )}
                <div className="overflow-x-auto rounded border border-zinc-800/80">
                  <table className="w-full min-w-[19rem] border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                        <th className="px-2 py-1.5 font-medium">Year</th>
                        <th className="px-2 py-1.5 font-medium">Club</th>
                        <th className="px-2 py-1.5 text-center font-medium">Loan</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Goals</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Ast</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Av.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.seasonStats.allSeasons.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-2 py-3 text-zinc-500">
                            {profile.seasonStats.staffHistoryParsed
                              ? 'No table rows for this player (totals above are zero).'
                              : 'History block not available — see the note above.'}
                          </td>
                        </tr>
                      ) : (
                        profile.seasonStats.allSeasons.map((r, i) => (
                          <tr
                            key={`${r.year}-${r.club}-${i}`}
                            className={`border-b border-zinc-800/40 ${
                              profile.seasonStats.highlightHistoryYear != null &&
                              r.year === profile.seasonStats.highlightHistoryYear
                                ? 'bg-emerald-500/[0.07]'
                                : ''
                            }`}
                          >
                            <td className="px-2 py-1 font-mono text-zinc-300">{r.year}</td>
                            <td className="max-w-[10rem] truncate px-2 py-1 text-zinc-200" title={r.club}>
                              {r.club}
                            </td>
                            <td className="px-2 py-1 text-center text-zinc-500">{r.onLoan ? 'Y' : ''}</td>
                            <td className="px-2 py-1 text-right font-mono text-zinc-200">{r.apps}</td>
                            <td className="px-2 py-1 text-right font-mono text-zinc-200">{r.goals}</td>
                            <td className="px-2 py-1 text-right font-mono text-zinc-600">—</td>
                            <td className="px-2 py-1 text-right font-mono text-zinc-600">—</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 border-t border-zinc-800/80 pt-2">
                  <HoverTip
                    tip={
                      <p>
                        Per-competition apps/goals (CM-style league vs cups split) are not loaded yet — they live outside{' '}
                        <code className="text-zinc-400">staff_history.dat</code>. Next step is mapping the correct index
                        block(s) and row layout, then joining <code className="text-zinc-400">staff id</code> +{' '}
                        <code className="text-zinc-400">competition id</code> (names from{' '}
                        <code className="text-zinc-400">club_comp.dat</code>).
                      </p>
                    }
                  >
                    <h4 className="mb-1 flex cursor-default items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      By competition (detail)
                      <InfoDot />
                    </h4>
                  </HoverTip>
                  {profile.seasonStats.perCompetitionStatsInSave && profile.seasonStats.perCompetitionRows.length > 0 ? (
                    <div className="overflow-x-auto rounded border border-zinc-800/80">
                      <table className="w-full min-w-[16rem] border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                            <th className="px-2 py-1.5 font-medium">Competition</th>
                            <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                            <th className="px-2 py-1.5 text-right font-mono font-medium">Goals</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.seasonStats.perCompetitionRows.map((r) => (
                            <tr key={r.competitionId} className="border-b border-zinc-800/40">
                              <td className="max-w-[12rem] truncate px-2 py-1 text-zinc-200" title={r.competitionName}>
                                {r.competitionName}
                              </td>
                              <td className="px-2 py-1 text-right font-mono text-zinc-200">{r.apps}</td>
                              <td className="px-2 py-1 text-right font-mono text-zinc-200">{r.goals}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-600">Hover the heading for per-competition data status.</p>
                  )}
                </div>
              </div>

              <div>
                <HoverTip
                  tip={
                    <div className="space-y-2">
                      <p>
                        In-game CM0102 three-column order (12 / 12 / 7, then feet and morale). Row tint marks key
                        attributes for natural positions (suitability &gt;14):{' '}
                        <span className="font-mono text-zinc-200">{profile.highlightRolesLabel}</span>.
                      </p>
                      <p>
                        Hover a value for intrinsic and in-match numbers. Engine brackets: use the strip under the
                        loaded database path; a highlighted bracket appears only when the uncapped engine-style value
                        differs from the number shown.
                      </p>
                      <p className="text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-6 rounded bg-emerald-500/[0.14]" />
                          Core for role
                        </span>
                        {' · '}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-6 rounded bg-sky-500/[0.11]" />
                          Supporting / universal
                        </span>
                      </p>
                    </div>
                  }
                >
                  <h3 className="mb-1 flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Attributes
                    <InfoDot />
                  </h3>
                </HoverTip>
                <div className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2">
                  <ProfileAttrColumn cells={profile.attrColumns[0]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={profile.attrColumns[1]} showEngineAttrs={showEngineAttrs} />
                  <div className="min-w-0">
                    <ProfileAttrColumn cells={profile.attrColumns[2]} showEngineAttrs={showEngineAttrs} />
                    <FeetMoraleBlock feet={profile.feetMorale} showEngineAttrs={showEngineAttrs} />
                  </div>
                </div>
              </div>

              <div>
                <HoverTip
                  tip={
                    <p>
                      CM second-screen style order: player fields (consistency, corners, penalties, throw-ins,
                      one-on-ones, versatility, dirtiness, important matches, injury proneness, natural fitness) plus
                      staff.dat mentals (adaptability, ambition, loyalty, pressure, professionalism, sportsmanship,
                      temperament). Determination stays in the main Attributes left column from staff.dat.
                    </p>
                  }
                >
                  <h3 className="mb-1 flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Hidden
                    <InfoDot />
                  </h3>
                </HoverTip>
                <div className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2">
                  <ProfileAttrColumn cells={profile.hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={profile.hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={profile.hiddenColumns[2]} showEngineAttrs={showEngineAttrs} />
                </div>
              </div>
            </div>
          )}
        </aside>
        </div>
      </div>
      {headerMenu && (
        <ul
          data-grid-header-menu
          className="fixed z-[150] min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl"
          style={{ left: headerMenu.x, top: headerMenu.y }}
        >
          <li>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800"
              onClick={() => {
                setColumnPickerOpen(true)
                setHeaderMenu(null)
              }}
            >
              Customize columns…
            </button>
          </li>
          <li>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-zinc-200 hover:bg-zinc-800"
              onClick={() => {
                applyColumnOrder([...GRID_DEFAULT_COLUMN_ORDER])
                setHeaderMenu(null)
              }}
            >
              Reset columns to default
            </button>
          </li>
        </ul>
      )}
      <GridColumnPickerModal
        open={columnPickerOpen}
        onClose={() => setColumnPickerOpen(false)}
        columnOrder={columnOrder}
        onApply={applyColumnOrder}
      />
    </div>
  )
}
