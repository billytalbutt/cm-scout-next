import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type MouseEvent, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ProfileAttrCell, ProfilePayload, StaffProfilePayload } from './vite-env.d'
import type { GridPlayerRow } from '../../shared/gridTypes'
import { gridFlagsForVisibleColumnIds, GRID_DEFAULT_COLUMN_ORDER, sanitizeGridColumnOrder } from '../../shared/gridColumnCatalog'
import { buildGridColumns, createGridColumnHelper } from './grid/gridColumns'
import { EliteEngineStar } from './grid/EliteEngineStar'
import { GridColumnPickerModal } from './grid/GridColumnPickerModal'
import { loadGridColumnOrder, saveGridColumnOrder } from './grid/gridPersistence'
import { cm0102FootWord, cm0102MoraleWord } from '../../shared/cm0102Bands'
import { CM_SCOUT_ATTR_LABELS } from '../../shared/cmScoutAttrLabels'
import { attrMinsStringsFromEnginePreset, type EngineSnifferPresetId } from '../../shared/engineSnifferAttrPresets'
import { ENGINE_META_PROFILE_IDS, ENGINE_META_PROFILE_LABELS } from '../../shared/engineMetaProfileCatalog'
import { CM_SCOUT_ROLE_PROFILE_UI_ORDER, CM_SCOUT_ROLE_SHORT } from '../../shared/cmScoutRoles'
import { DebouncedTextFilters } from './DebouncedTextFilters'
import { StaffBrowsePanel } from './StaffBrowsePanel'
import { StaffProfilePane } from './StaffProfilePane'
import { ClubBrowsePanel } from './ClubBrowsePanel'
import { TacticsLabPanel } from './TacticsLabPanel'
import { TacticsAssignmentPane } from './tactics/TacticsAssignmentPane'
import {
  initialPitchSlots,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../shared/tacticsPitchSnap'
import { AttributeEditorPanel } from './AttributeEditorPanel'
import { attrColor, engineBracketClass, ProfileAttrColumn } from './ProfileAttrBlocks'
import { setCopiedPlayerAttributes } from '../../shared/copiedPlayerAttributes'

const gridColHelper = createGridColumnHelper()

const ENGINE_ATTRS_LS = 'cm-scout-next-profile-engine-attrs'
const FILTERS_COLLAPSED_LS = 'cm-scout-next-filters-collapsed'
const PROFILE_PANE_WIDTH_LS = 'cm-scout-next-profile-pane-px'
const DEFAULT_PROFILE_PANE_PX = 400
const MIN_PROFILE_PANE_PX = 240
const MAX_PROFILE_PANE_PX = 720

type EngineSnifferUi = 'off' | EngineSnifferPresetId

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

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

/** Contract bonuses use −1 in the save when no bonus is set (CM sentinel). */
function fmtContractMoney(n: number) {
  if (!Number.isFinite(n) || n < 0) return '—'
  return fmtMoney(n)
}

/** Scout advice in the spirit of CM0102 instruction Yes/No columns — not read from the executable. */
function playerInstructionAdvice(tier: 'strong' | 'ok' | 'avoid'): string {
  if (tier === 'strong') return 'Yes'
  if (tier === 'ok') return 'Yes (borderline)'
  return 'No'
}

function formatProfileStatCell(v: number | null | undefined, kind: 'int' | 'rating' = 'int'): ReactNode {
  if (v == null || Number.isNaN(v)) return <span className="text-zinc-600">—</span>
  if (kind === 'rating') return <span className="font-mono text-zinc-200">{v.toFixed(1)}</span>
  return <span className="font-mono text-zinc-200">{Math.round(v)}</span>
}

/** Map role index 0–6 → tier by **distinct** % value (ties share the same tier). Top three values → 0 best … 2 third. */
function cmScoutRoleValueTierByRole(percents: readonly number[]): Map<number, 0 | 1 | 2> {
  const uniq = [...new Set(percents)].sort((a, b) => b - a)
  const valueToTier = new Map<number, 0 | 1 | 2>()
  for (let t = 0; t < Math.min(3, uniq.length); t++) {
    valueToTier.set(uniq[t]!, t as 0 | 1 | 2)
  }
  const out = new Map<number, 0 | 1 | 2>()
  for (let i = 0; i < percents.length; i++) {
    const tier = valueToTier.get(percents[i]!)
    if (tier !== undefined) out.set(i, tier)
  }
  return out
}

function countActiveAttrMinsStrings(attrMins: readonly string[]): number {
  let c = 0
  for (const s of attrMins) {
    const t = s.trim()
    if (!t) continue
    const n = Number(t)
    if (Number.isFinite(n) && n > 0) c++
  }
  return c
}

/** Right-click: empty → 5 → 10 → 15 → 20 → empty (already ≥20 clears). */
function nextAttrMinLadderOnRightClick(current: string): string {
  const t = current.trim()
  const n = Number(t)
  if (!t || !Number.isFinite(n) || n <= 0) return '5'
  if (n >= 20) return ''
  for (const step of [5, 10, 15, 20] as const) {
    if (step > n) return String(step)
  }
  return ''
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
  const [rows, setRows] = useState<GridPlayerRow[]>([])
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
  /** Among attribute cells with a min &gt; 0, require at least this many to pass (empty = all must pass). */
  const [attrMinMatchAtLeast, setAttrMinMatchAtLeast] = useState('')
  const activeAttrFilterCount = useMemo(() => countActiveAttrMinsStrings(attrMins), [attrMins])

  useEffect(() => {
    if (activeAttrFilterCount === 0) {
      setAttrMinMatchAtLeast((prev) => (prev !== '' ? '' : prev))
      return
    }
    setAttrMinMatchAtLeast((prev) => {
      if (prev.trim() === '') return prev
      const m = parseInt(prev, 10)
      if (!Number.isFinite(m) || m <= 0) return prev
      if (m > activeAttrFilterCount) return String(activeAttrFilterCount)
      return prev
    })
  }, [attrMins, activeAttrFilterCount])
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [copyAttrsMsg, setCopyAttrsMsg] = useState<string | null>(null)
  const [staffProfile, setStaffProfile] = useState<StaffProfilePayload | null>(null)
  const [staffTableSel, setStaffTableSel] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [opening, setOpening] = useState(false)
  const [gridMeta, setGridMeta] = useState<{ total: number } | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadGridColumnOrder())
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null)
  const [clubList, setClubList] = useState<string[]>([])
  const [nationList, setNationList] = useState<string[]>([])
  const [committedText, setCommittedText] = useState({ q: '', nation: '', club: '' })
  const [textFiltersResetKey, setTextFiltersResetKey] = useState(0)
  const [textFiltersPending, setTextFiltersPending] = useState(false)
  const [gridRefreshing, setGridRefreshing] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(FILTERS_COLLAPSED_LS) === '1'
    } catch {
      return false
    }
  })
  const [browseTab, setBrowseTab] = useState<'players' | 'regens' | 'staff' | 'clubs' | 'tactics' | 'editor'>('players')
  /** Last club selected in Clubs tab — Tactics Lab uses this for save tactic wiring. */
  const [tacticsSeedClubId, setTacticsSeedClubId] = useState<number | null>(null)
  const [tacticsPitchSlots, setTacticsPitchSlots] = useState<PitchSlot[]>(() => initialPitchSlots())
  const [tacticsAssignments, setTacticsAssignments] = useState<
    Partial<Record<string, TacticsPlayerAssignment | null>>
  >({})
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

  const clearAllFilters = useCallback(() => {
    setCommittedText({ q: '', nation: '', club: '' })
    setTextFiltersResetKey((k) => k + 1)
    setCaMin('')
    setCaMax('')
    setPaMin('')
    setPaMax('')
    setAgeMin('')
    setAgeMax('')
    setValueMin('')
    setValueMax('')
    setWageMin('')
    setWageMax('')
    setShCareerGoalsMin('')
    setShCareerGoalsMax('')
    setShSeasonGoalsMin('')
    setShSeasonGoalsMax('')
    setShCareerAppsMin('')
    setShSeasonAppsMin('')
    setContractType('')
    setTlClub(false)
    setTlRequest(false)
    setLoanListed(false)
    setEuOnly(false)
    setBosmanOnly(false)
    setMinReleaseClause(false)
    setExpiresWithinMonths('')
    setAttrMins(Array.from({ length: 48 }, () => ''))
    setAttrMinMatchAtLeast('')
    setRegenOnly(false)
    setEngineSniffer('off')
  }, [])

  const persistShowEngineAttrs = useCallback((v: boolean) => {
    setShowEngineAttrs(v)
    try {
      localStorage.setItem(ENGINE_ATTRS_LS, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const adjustMatchAtLeast = useCallback(
    (delta: number) => {
      if (activeAttrFilterCount === 0) return
      setAttrMinMatchAtLeast((prev) => {
        const cur = prev.trim() === '' ? null : parseInt(prev, 10)
        if (delta > 0) {
          if (cur == null || !Number.isFinite(cur)) return '1'
          return String(Math.min(activeAttrFilterCount, cur + 1))
        }
        if (cur == null || !Number.isFinite(cur)) return ''
        if (cur <= 1) return ''
        return String(cur - 1)
      })
    },
    [activeAttrFilterCount],
  )

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
    if (browseTab === 'staff' || browseTab === 'clubs' || browseTab === 'tactics' || browseTab === 'editor') {
      setGridRefreshing(false)
      return
    }
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
    const matchN = num(attrMinMatchAtLeast)
    if (attrMinMatchAtLeast.trim() !== '' && Number.isFinite(matchN) && matchN >= 1) {
      f.attrMinMatchAtLeast = Math.floor(matchN)
    }
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
        setRows([])
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
      setRows([])
    } catch (e) {
      if (refreshSeq.current !== seq) return
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setGridMeta(null)
      setRows([])
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
    attrMinMatchAtLeast,
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
        'CM Merlin Scout must run inside the Electron app window (the packaged .app or npm run dev). A normal browser tab cannot open files.',
      )
      return
    }
    setOpening(true)
    try {
      const r = await window.cmapi.openDatabase()
      if (!r || typeof r !== 'object' || !('ok' in r)) {
        setErr('Unexpected response from the app. Try restarting CM Merlin Scout.')
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
      setTacticsSeedClubId(null)
      setClubList(r.clubs)
      setNationList(r.nations ?? [])
      setCommittedText({ q: '', nation: '', club: '' })
      setErr(null)
      setProfile(null)
      setStaffProfile(null)
      setStaffTableSel(null)
      setSel(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setGridMeta(null)
      setRows([])
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

  const loadStaffProfile = useCallback(async (staffIndex: number) => {
    setProfile(null)
    if (typeof window.cmapi?.getStaffProfile !== 'function') return
    const p = await window.cmapi.getStaffProfile(staffIndex)
    setStaffProfile(p)
  }, [])

  const pick = useCallback(async (staffIndex: number) => {
    setSel(staffIndex)
    setStaffProfile(null)
    if (typeof window.cmapi?.getProfile !== 'function') return
    const p = await window.cmapi.getProfile(staffIndex)
    setProfile(p)
  }, [])

  const copyPlayerAttributes = useCallback(async () => {
    if (sel == null || typeof window.cmapi?.getEditorSnapshot !== 'function') return
    setCopyAttrsMsg(null)
    try {
      const snap = await window.cmapi.getEditorSnapshot(sel)
      if (!snap || typeof snap !== 'object' || !('values' in snap)) {
        setCopyAttrsMsg('This row has no editable player bytes.')
        return
      }
      const s = snap as { staffIndex: number; name: string; values: Record<string, number> }
      setCopiedPlayerAttributes({
        staffIndex: s.staffIndex,
        name: s.name,
        values: { ...s.values },
        copiedAt: Date.now(),
      })
      setCopyAttrsMsg(`Copied attributes from ${s.name}`)
    } catch (e) {
      setCopyAttrsMsg(e instanceof Error ? e.message : String(e))
    }
  }, [sel])

  useEffect(() => {
    if (browseTab !== 'staff') {
      setStaffProfile(null)
      setStaffTableSel(null)
    }
  }, [browseTab])

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
        <div className="flex items-center gap-4">
          <img
            src="/merlin-mascot.png"
            alt=""
            className="h-32 w-32 shrink-0 object-contain"
            title="CM Merlin Scout"
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">CM Merlin Scout</h1>
            <p className="text-xs text-zinc-500">Championship Manager 01/02 · CM Scout–aligned data</p>
          </div>
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
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  title="Reset every filter to defaults"
                  onClick={clearAllFilters}
                  className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400 hover:border-amber-700/50 hover:bg-zinc-800 hover:text-amber-100"
                >
                  Clear all
                </button>
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
            </div>
            <div className="cm-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            <DebouncedTextFilters
              key={`${loadInfo?.path ?? 'pre'}-${textFiltersResetKey}`}
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
              <summary
                className="cursor-pointer px-2 py-2 text-xs font-medium text-zinc-400"
                title="Same 1–20 scale as on-screen attribute bars. Enter 21+ for uncapped CA18 / raw-byte overflow (editor-style intrinsics). Right-click a minimum box: 5 → 10 → 15 → 20 → clear."
              >
                Attributes
              </summary>
              <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                <div
                  className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500"
                  title="Match ≥: empty = every active attribute minimum must pass; otherwise at least N of them must pass."
                >
                  <span className="text-zinc-400">Active</span>
                  <span
                    className="inline-flex h-6 w-12 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-950 font-mono text-[11px] text-emerald-200/90"
                    title="Attributes with a minimum value &gt; 0"
                  >
                    {activeAttrFilterCount}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-0.5">
                  <span className="shrink-0 pr-0.5 text-[10px] text-zinc-500">≥</span>
                  <button
                    type="button"
                    disabled={activeAttrFilterCount === 0}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-900 p-0 text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Decrease (at 1 → clear = all must pass)"
                    onClick={() => adjustMatchAtLeast(-1)}
                  >
                    ▼
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="h-6 w-12 shrink-0 rounded border border-zinc-700 bg-zinc-950 px-1 py-0 text-center font-mono text-[11px] text-zinc-200"
                    value={attrMinMatchAtLeast}
                    onChange={(e) => setAttrMinMatchAtLeast(e.target.value.replace(/\D/g, ''))}
                    placeholder="all"
                    disabled={activeAttrFilterCount === 0}
                    title="Match at least N (type or use arrows)"
                  />
                  <button
                    type="button"
                    disabled={activeAttrFilterCount === 0}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-900 p-0 text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Increase (from empty → 1)"
                    onClick={() => adjustMatchAtLeast(1)}
                  >
                    ▲
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border-t border-zinc-800 px-2 py-2 cm-scroll">
                <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
                  {CM_SCOUT_ATTR_LABELS.map((label, i) => (
                    <label key={label} className="contents">
                      <span className="truncate text-zinc-500">{label}</span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="w-12 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200"
                        value={attrMins[i]}
                        onChange={(e) => setAttrMinAt(i, e.target.value)}
                        title="Right-click: cycle 5 → 10 → 15 → 20 → clear"
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setAttrMinAt(i, nextAttrMinLadderOnRightClick(attrMins[i] ?? ''))
                        }}
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
                  browseTab === 'regens' ||
                  browseTab === 'staff' ||
                  browseTab === 'clubs' ||
                  browseTab === 'tactics' ||
                  browseTab === 'editor'
                    ? 'cursor-not-allowed text-zinc-500'
                    : 'cursor-pointer text-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={regenOnly}
                  disabled={
                    browseTab === 'regens' ||
                    browseTab === 'staff' ||
                    browseTab === 'clubs' ||
                    browseTab === 'tactics' ||
                    browseTab === 'editor'
                  }
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
                    <p className="font-medium text-white">Engine sniffer (DNA)</p>
                    <p>
                      Heuristic row filter and attribute floors — not decompiled match AI. Thresholds use save bytes
                      (normally 1–20 on screen); <span className="font-mono text-zinc-300">21+</span> treats editor-style
                      overflow as top-tier for that attribute.
                    </p>
                    <p>
                      Picking a preset fills <strong className="text-zinc-400">Attributes</strong> (minimums) with that
                      archetype’s baseline floors. While any minimum is set, the grid uses{' '}
                      <strong className="text-zinc-400">only those bars</strong> (and optional <strong className="text-zinc-400">Match ≥</strong>); clear every minimum to use the sniffer heuristic alone. Right-click a minimum box: 5 → 10 → 15 → 20
                      → clear.
                    </p>
                    <p>
                      <span className="font-medium text-sky-200/90">MC hub presets</span> (regulator / volume) also require
                      midfield naturals and CM Scout % to favour M/AM over a pure centre-back read — elite CBs with big
                      passing numbers are excluded.
                    </p>
                    <p className="text-zinc-400">
                      Presets: regulator hub CM, volume playmaker, DMC anchor, DMC regista, reader DC, libero passer,
                      poacher/target ST, WB motor, wide carrier, AMC shadow, commanding GK.
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
                onChange={(e) => {
                  const v = e.target.value as EngineSnifferUi
                  setEngineSniffer(v)
                  if (v !== 'off') {
                    setAttrMins(attrMinsStringsFromEnginePreset(v))
                  }
                }}
              >
                <option value="off">Off</option>
                {ENGINE_META_PROFILE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {ENGINE_META_PROFILE_LABELS[id]}
                  </option>
                ))}
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
            <button
              type="button"
              onClick={() => setBrowseTab('staff')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'staff'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setBrowseTab('clubs')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'clubs'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              Clubs
            </button>
            <button
              type="button"
              onClick={() => setBrowseTab('tactics')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'tactics'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              Tactics
            </button>
            <button
              type="button"
              onClick={() => setBrowseTab('editor')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                browseTab === 'editor'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              Editor
            </button>
            {browseTab === 'regens' && loadInfo && (
              <span className="text-[10px] text-zinc-500">
                Heuristic list only — grid columns can still show Is regen / Regen of.
              </span>
            )}
          </div>
          <div ref={scrollParentRef} className="cm-scroll relative min-h-0 flex-1 overflow-auto p-3">
            {(textFiltersPending || gridRefreshing) &&
              loadInfo &&
              (browseTab === 'players' || browseTab === 'regens') && (
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
            {browseTab === 'staff' && (
              <StaffBrowsePanel
                loadInfo={!!loadInfo}
                nationList={nationList}
                clubList={clubList}
                selectedStaffIndex={staffTableSel}
                onSelectStaff={(si) => {
                  setStaffTableSel(si)
                  void loadStaffProfile(si)
                }}
                onOpenPlayerProfile={(si) => void pick(si)}
              />
            )}
            <div
              className={browseTab === 'clubs' ? 'min-h-0 flex flex-1 flex-col' : 'hidden'}
              aria-hidden={browseTab !== 'clubs'}
            >
              <ClubBrowsePanel
                loadInfo={!!loadInfo}
                onOpenPlayerProfile={(si) => void pick(si)}
                onClubSelectForTactics={(id) => setTacticsSeedClubId(id)}
              />
            </div>
            {browseTab === 'tactics' && (
              <TacticsLabPanel
                loadInfo={!!loadInfo}
                tacticsSeedClubId={tacticsSeedClubId}
                pitchSlots={tacticsPitchSlots}
                onPitchSlotsChange={setTacticsPitchSlots}
                assignments={tacticsAssignments}
              />
            )}
            {browseTab === 'editor' && (
              <AttributeEditorPanel
                loadInfo={!!loadInfo}
                compressed={!!loadInfo?.compressed}
                staffIndex={sel}
              />
            )}
            {(browseTab === 'players' || browseTab === 'regens') && (
            <>
            {loadInfo && rows.length === 0 && (
              <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                {browseTab === 'regens'
                  ? 'No heuristic regens match the current filters. Try All players, or relax filters — the regen list is a same-save guess, not exhaustive.'
                  : 'No players match the current filters. Use Clear all in the filter panel, or relax individual filters.'}
              </p>
            )}
            {!loadInfo && rows.length === 0 && (
              <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                Load a database (index.dat or .sav) to populate the grid.
              </p>
            )}
            {loadInfo && gridMeta && rows.length > 0 && (
              <p className="mb-2 text-[11px] text-zinc-500">
                Showing <span className="font-mono text-zinc-300">{rows.length.toLocaleString()}</span> loaded rows
                {' · '}
                total matching <span className="font-mono text-zinc-300">{gridMeta.total.toLocaleString()}</span>
              </p>
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
            </>
            )}
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
          {browseTab === 'tactics' ? (
            <TacticsAssignmentPane
              loadInfo={!!loadInfo}
              pitchSlots={tacticsPitchSlots}
              assignments={tacticsAssignments}
              onAssign={(slotId, a) =>
                setTacticsAssignments((prev) => ({
                  ...prev,
                  [slotId]: a,
                }))
              }
              onClearSlot={(slotId) =>
                setTacticsAssignments((prev) => {
                  const next = { ...prev }
                  delete next[slotId]
                  return next
                })
              }
            />
          ) : (
            <>
          {!profile && !(browseTab === 'staff' && staffProfile) && (
            <p className="text-sm text-zinc-500">
              {browseTab === 'staff'
                ? 'Select a staff member from the table.'
                : 'Select a player for profile & attributes.'}
            </p>
          )}
          {browseTab === 'staff' && staffProfile && (
            <StaffProfilePane p={staffProfile} showEngineAttrs={showEngineAttrs} />
          )}
          {profile && (
            <div className="space-y-4">
              <div className="border-b border-zinc-800/80 pb-3">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-white">
                  {profile.eliteEngineBadgeKind && profile.eliteEngineBadgeTitle && (
                    <EliteEngineStar
                      title={profile.eliteEngineBadgeTitle}
                      detail={profile.eliteEngineBadgeDetail ?? ''}
                    />
                  )}
                  <span>{profile.name}</span>
                </h2>
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
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={sel == null || !loadInfo || loadInfo.compressed}
                  onClick={() => void copyPlayerAttributes()}
                  className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy attributes
                </button>
                {copyAttrsMsg && <span className="text-[11px] text-emerald-300/90">{copyAttrsMsg}</span>}
                {loadInfo?.compressed && (
                  <span className="text-[10px] text-zinc-500">Editor copy needs an uncompressed save.</span>
                )}
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

              <div className="mt-2 rounded-lg border border-sky-900/40 bg-sky-950/20 p-3 text-xs">
                <HoverTip
                  tip={
                    <p className="text-zinc-300">
                      Instruction names match the CM0102 manual Player Instruction dialog (Run with the Ball, Try Through
                      Balls, etc.). Yes / No is heuristic scout advice only — not decompiled match AI.
                    </p>
                  }
                >
                  <h3 className="mb-1.5 flex cursor-default items-center font-semibold text-sky-200/95">
                    Scouting DNA &amp; Player Instructions
                    <InfoDot />
                  </h3>
                </HoverTip>
                {profile.engineMetaProfiles.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">Meta profile DNA</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {profile.engineMetaProfiles.map((m) => (
                        <span
                          key={m.id}
                          className="rounded border border-sky-600/35 bg-sky-950/40 px-1.5 py-0.5 font-mono text-[10px] text-sky-100/95"
                          title={m.id}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mb-2 rounded border border-zinc-800/80 bg-zinc-950/40 p-2">
                  <p
                    className={`text-[11px] font-medium ${
                      profile.freeRoleHint.recommend ? 'text-emerald-300/95' : 'text-zinc-400'
                    }`}
                  >
                    {profile.freeRoleHint.headline}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-zinc-500">{profile.freeRoleHint.detail}</p>
                </div>
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">Player Instructions</p>
                  <ul className="mt-1 space-y-1.5">
                    {profile.tacticalInstructionHints.map((h) => (
                      <li
                        key={h.id}
                        className={`rounded border px-2 py-1.5 text-[10px] leading-snug ${
                          h.tier === 'strong'
                            ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-100/95'
                            : h.tier === 'ok'
                              ? 'border-amber-700/35 bg-amber-950/25 text-amber-100/90'
                              : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-500'
                        }`}
                      >
                        <span className="font-medium text-zinc-300">{h.label}</span>
                        <span className="ml-1.5 font-mono text-zinc-400">{playerInstructionAdvice(h.tier)}</span>
                        <span className="mt-0.5 block text-zinc-500">{h.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

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
                            Same weights as CM Scout: each column is a weighted blend of{' '}
                            <span className="text-zinc-300">in-game CA18 display + raw mentals</span> for that role
                            (injury/dirtiness inverted). Shown for all seven roles; grid “CM Scout %” uses the best among
                            roles the player is considered suitable for (highlighted).
                          </p>
                          {profile.cmScoutRatingBp != null &&
                            profile.cmScoutRolePercents &&
                            Math.max(...profile.cmScoutRolePercents) > profile.cmScoutRatingBp + 0.05 && (
                              <p className="text-amber-200/90">
                                <strong className="text-emerald-200/90">Green</strong> rings mark the best % among
                                columns; <strong className="text-amber-200/90">two amber</strong> shades mark the 2nd- and
                                3rd-best distinct values (ties share the same tier). Grid BP can be lower if the best
                                column is not a “suitable” role for this player.
                              </p>
                            )}
                          {profile.effArchetype && (
                            <div className="border-t border-zinc-700/80 pt-2">
                              <p className="font-semibold text-zinc-300">Effectiveness %</p>
                              {profile.effPercent != null ? (
                                <p className="mt-1 text-zinc-400">
                                  Best archetype:{' '}
                                  <span className="font-mono text-emerald-200/90">
                                    {profile.effPercent.toFixed(1)}% ({profile.effArchetype})
                                  </span>
                                </p>
                              ) : (
                                <p className="mt-1 italic text-violet-200/95">
                                  Natural positions did not match any effectiveness recipe — use CM Scout % above.
                                </p>
                              )}
                              {profile.effWinnerDetail && (
                                <>
                                  <p className="mt-2 font-semibold text-zinc-300">Why this Eff %</p>
                                  <p className="mt-1 text-zinc-500">
                                    Winning recipe{' '}
                                    <span className="text-emerald-200/90">{profile.effWinnerDetail.archetypeLabel}</span>{' '}
                                    — primary ×5, secondary ×1.5, engine rows on lighter weights; values are profile
                                    1–20. ★ = on-screen 20 (1.25×). Consistency multiplies the score.
                                  </p>
                                  {profile.effWinnerDetail.brainMult ? (
                                    <p className="mt-1 text-zinc-500">
                                      Brain: base {profile.effWinnerDetail.basePercent.toFixed(1)}% × (
                                      {profile.effWinnerDetail.brainMult.decisions}/20 ×{' '}
                                      {profile.effWinnerDetail.brainMult.anticipation}/20)
                                    </p>
                                  ) : null}
                                  {profile.effWinnerDetail.consistencyReliability && profile.effPercent != null && (
                                    <p className="mt-1 text-zinc-500">
                                      Consistency {profile.effWinnerDetail.consistencyReliability.consistency.toFixed(0)}
                                      /20 → ×{profile.effWinnerDetail.consistencyReliability.factor.toFixed(3)} →{' '}
                                      <span className="font-mono text-emerald-200/90">
                                        {profile.effPercent.toFixed(1)}%
                                      </span>{' '}
                                      final
                                    </p>
                                  )}
                                  {profile.effRatingDisclaimer && (
                                    <p className="mt-2 text-[9px] text-zinc-500">{profile.effRatingDisclaimer}</p>
                                  )}
                                </>
                              )}
                            </div>
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
                    {profile.effArchetype && profile.effWinnerDetail && (
                      <div className="mt-2 rounded border border-zinc-800/90 bg-zinc-950/55 p-2 text-[10px] leading-snug text-zinc-400">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              <div>
                                <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-600">Primary</p>
                                <ul className="mt-0.5 space-y-0.5 font-mono text-zinc-300">
                                  {profile.effWinnerDetail.lines
                                    .filter((l) => l.slot === 'primary')
                                    .map((l) => (
                                      <li key={`pe-${l.key}`}>
                                        {l.label} {l.raw}
                                        {l.godTier ? <span className="text-amber-300/90"> ★</span> : null}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-600">Secondary</p>
                                <ul className="mt-0.5 space-y-0.5 font-mono text-zinc-300">
                                  {profile.effWinnerDetail.lines
                                    .filter((l) => l.slot === 'secondary')
                                    .map((l) => (
                                      <li key={`se-${l.key}`}>
                                        {l.label} {l.raw}
                                        {l.godTier ? <span className="text-amber-300/90"> ★</span> : null}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                            {profile.effWinnerDetail.engineLines.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-600">Engine</p>
                                <ul className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-zinc-300">
                                  {profile.effWinnerDetail.engineLines.map((l) => (
                                    <li key={`eng-${l.key}`}>
                                      {l.label} {l.raw}
                                      {l.key === 'injury_proneness' ? (
                                        <span className="text-zinc-600"> inv</span>
                                      ) : null}
                                      {l.godTier ? <span className="text-amber-300/90"> ★</span> : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {profile.effRunnerUp && (
                              <p className="mt-2 border-t border-zinc-800/80 pt-2 text-zinc-500">
                                Runner-up:{' '}
                                <span className="text-zinc-300">{profile.effRunnerUp.archetypeLabel}</span> at{' '}
                                <span className="font-mono text-zinc-200">{profile.effRunnerUp.score.toFixed(1)}%</span>
                              </p>
                            )}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                      {(() => {
                        const percents = profile.cmScoutRolePercents!
                        const tierByRole = cmScoutRoleValueTierByRole(percents)
                        return CM_SCOUT_ROLE_PROFILE_UI_ORDER.map((roleIdx) => {
                          const lab = CM_SCOUT_ROLE_SHORT[roleIdx]!
                          const pct = percents[roleIdx]!
                          const suit = profile.cmScoutRoleSuitable?.[roleIdx]
                          const tier = tierByRole.get(roleIdx)
                          const ring =
                            tier === 0
                              ? 'ring-1 ring-emerald-500/50'
                              : tier === 1
                                ? 'ring-1 ring-amber-400/55'
                                : tier === 2
                                  ? 'ring-1 ring-amber-800/50'
                                  : ''
                          const pctClass =
                            tier === 0
                              ? 'text-emerald-200'
                              : tier === 1
                                ? 'text-amber-200'
                                : tier === 2
                                  ? 'text-amber-500'
                                  : 'text-zinc-200'
                          return (
                            <div
                              key={lab + roleIdx}
                              className={`min-w-0 rounded border px-0.5 py-1 ${
                                suit
                                  ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                                  : 'border-zinc-800/80 bg-zinc-950/40'
                              } ${ring}`}
                            >
                              <div className="truncate text-[8px] font-medium uppercase tracking-tight text-zinc-500">
                                {lab}
                              </div>
                              <div className={`font-mono text-[10px] tabular-nums ${pctClass}`}>{pct}%</div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}

              {profile.contract && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                  <h3 className="mb-2 font-semibold text-zinc-300">Contract</h3>
                  <div className="grid grid-cols-2 gap-1 text-zinc-400">
                    <span>Wage</span>
                    <span className="text-right text-zinc-200">{fmtMoney(profile.contract.wage)}</span>
                    <span>Goal bonus</span>
                    <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.goalBonus)}</span>
                    <span>Assist bonus</span>
                    <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.assistBonus)}</span>
                    <span>Release fee</span>
                    <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.releaseFee)}</span>
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
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                <HoverTip
                  tip={
                    <div className="space-y-2 text-zinc-300">
                      <p>
                        The <strong>Current season</strong> row uses <code className="text-emerald-400/80">staff_history.dat</code>{' '}
                        at this player&apos;s club (league + cups combined — same as CM &quot;Senior club&quot; apps/goals).
                        Assists and average rating are not in that file yet. Career table below lists every club/year row.
                      </p>
                      <p className="text-zinc-400">
                        If the season table is empty: the index may not have loaded staff_history (missing block or
                        unexpected layout — try reloading after the game writes history, or an uncompressed save), or this
                        player has no history rows yet. International caps from staff.dat still appear above when set.
                      </p>
                      <p>
                        By competition: league vs cups split and extra columns need save performance blocks joined to
                        staff id and competition id (names from <code className="text-zinc-400">club_comp.dat</code>).
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
                          No staff_history rows matched the season-tagged year; totals use the save&apos;s calendar year
                          instead.
                        </p>
                      )}
                      {profile.seasonStats.inferredDomesticLeague && (
                        <p>
                          Primary league from club division → club_comp:{' '}
                          <span className="font-medium text-zinc-100">
                            {profile.seasonStats.inferredDomesticLeague.name}
                          </span>{' '}
                          <span className="text-zinc-500">
                            (id {profile.seasonStats.inferredDomesticLeague.competitionId})
                          </span>
                        </p>
                      )}
                      {profile.seasonStats.savePerformanceHint && (
                        <p className="border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-400">
                          {profile.seasonStats.savePerformanceHint}
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
                <div className="mb-3 overflow-x-auto rounded border border-emerald-900/40 bg-emerald-950/20">
                  <table className="w-full min-w-[16rem] border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                        <th className="px-2 py-1.5 font-medium">Current season</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Goals</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Ast</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Av.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.seasonStats.currentSeasonPerformance ? (
                        <tr className="border-b border-zinc-800/40">
                          <td
                            className="max-w-[12rem] truncate px-2 py-1.5 text-zinc-100"
                            title={profile.seasonStats.currentSeasonPerformance.label}
                          >
                            {profile.seasonStats.currentSeasonPerformance.label}
                            <span className="ml-1 text-zinc-500">
                              ({profile.seasonStats.currentSeasonPerformance.historyYear})
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-200">
                            {profile.seasonStats.currentSeasonPerformance.apps}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-200">
                            {profile.seasonStats.currentSeasonPerformance.goals}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {formatProfileStatCell(profile.seasonStats.currentSeasonPerformance.assists)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {formatProfileStatCell(
                              profile.seasonStats.currentSeasonPerformance.averageRating,
                              'rating',
                            )}
                          </td>
                        </tr>
                      ) : profile.seasonStats.currentSeasonRows.length > 0 ? (
                        profile.seasonStats.currentSeasonRows.map((r, i) => (
                          <tr key={`${r.year}-${r.club}-${i}`} className="border-b border-zinc-800/40">
                            <td className="max-w-[12rem] truncate px-2 py-1.5 text-zinc-100" title={r.club}>
                              {r.club}
                              <span className="ml-1 text-zinc-500">({r.year})</span>
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{r.apps}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{r.goals}</td>
                            <td className="px-2 py-1.5 text-right">{formatProfileStatCell(r.assists)}</td>
                            <td className="px-2 py-1.5 text-right">
                              {formatProfileStatCell(r.averageRating, 'rating')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-2 py-2.5 text-center text-zinc-500">
                            {profile.seasonStats.staffHistoryParsed
                              ? profile.seasonStats.allSeasons.length > 0
                                ? 'No row for this club in the current season year'
                                : 'No staff history for this player'
                              : 'No staff_history.dat — use a .sav under your CM Game folder (e.g. …/Game/Game/) so Data/staff_history.dat is found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Tkl</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Pass</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Hdr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.seasonStats.allSeasons.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-2 py-3 text-center text-zinc-500">
                            —
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
                            <td className="px-2 py-1 text-right">{formatProfileStatCell(r.assists)}</td>
                            <td className="px-2 py-1 text-right">{formatProfileStatCell(r.averageRating, 'rating')}</td>
                            <td className="px-2 py-1 text-right">{formatProfileStatCell(r.tackles)}</td>
                            <td className="px-2 py-1 text-right">{formatProfileStatCell(r.passes)}</td>
                            <td className="px-2 py-1 text-right">{formatProfileStatCell(r.headers)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
            </>
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
