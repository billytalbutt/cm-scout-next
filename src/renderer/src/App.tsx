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
import { ELITE_PROSPECT_PA_MIN } from '../../shared/regenConstants'
import type { DatabaseLoadProgress } from '../../shared/loadProgress'
import { DatabaseLoadOverlay } from './DatabaseLoadOverlay'
import { gridFlagsForVisibleColumnIds, GRID_DEFAULT_COLUMN_ORDER, sanitizeGridColumnOrder } from '../../shared/gridColumnCatalog'
import { buildGridColumns, createGridColumnHelper } from './grid/gridColumns'
import { GridColumnPickerModal } from './grid/GridColumnPickerModal'
import { loadGridColumnOrder, saveGridColumnOrder } from './grid/gridPersistence'
import { cm0102FootWord, cm0102MoraleWord } from '../../shared/cm0102Bands'
import { CM_SCOUT_ATTR_LABELS } from '../../shared/cmScoutAttrLabels'
import { nextAttrMinLadderOnRightClick } from '../../shared/attrMinLadder'
import { attrMinsStringsFromEnginePreset, type EngineSnifferPresetId } from '../../shared/engineSnifferAttrPresets'
import { ENGINE_META_PROFILE_IDS, ENGINE_META_PROFILE_LABELS } from '../../shared/engineMetaProfileCatalog'
import { CM_SCOUT_ROLE_PROFILE_UI_ORDER, CM_SCOUT_ROLE_SHORT } from '../../shared/cmScoutRoles'
import { DebouncedTextFilters } from './DebouncedTextFilters'
import { StaffBrowsePanel } from './StaffBrowsePanel'
import { StaffFilterSidebar } from './StaffFilterSidebar'
import { BrowseTabBar, type BrowseTabId } from './BrowseTabBar'
import {
  PlayerPositionFilterPanel,
  type PlayerPositionFilterState,
} from './filters/PlayerPositionFilterPanel'
import type { PositionRoleFilterId, PositionSideFilterId } from '../../shared/playerPositionFilter'
import { RegenProfileHint } from './profile/RegenProfileHint'
import { RegenNewSinceLastCheck } from './regen/RegenNewSinceLastCheck'
import { clearRegenSeen, markRegensSeen, newRegenStaffIds } from './regen/regenSeenStorage'
import { StaffProfilePane } from './StaffProfilePane'
import { BrandHeaderStickers } from './BrandHeaderStickers'
import { isProfilePopoutWindow } from './profile/profileWindowRoute'
import { ClubDetailPane } from './clubs/ClubDetailPane'
import { ClubSearchSidebar } from './clubs/ClubSearchSidebar'
import { useClubBrowse } from './clubs/useClubBrowse'
import { useClubFavorites } from './clubs/useClubFavorites'
import type { ClubListRow } from './ClubBrowsePanel'
import { TacticsLabPanel } from './TacticsLabPanel'
import { TacticsAssignmentPane } from './tactics/TacticsAssignmentPane'
import { ShortlistsPanel } from './shortlists/ShortlistsPanel'
import { ShortlistContextMenu, type ShortlistMenuTarget } from './shortlists/ShortlistContextMenu'
import { AddToShortlistButton } from './shortlists/AddToShortlistButton'
import { useShortlists } from './shortlists/useShortlists'
import type { ShortlistKind } from '../../shared/shortlistTypes'
import {
  buildPlayerGridFilterPayload,
  type PlayerGridFilterBuildInput,
} from './filters/buildPlayerGridFilter'
import {
  initialPitchSlots,
  snapAndRedistributePitch,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from '../../shared/tacticsPitchSnap'
import { loadSavedTacticsLayout } from './tactics/tacticsLayoutStorage'
import { AttributeEditorPanel } from './AttributeEditorPanel'
import { StaffEditorPanel } from './StaffEditorPanel'
import { DevelopmentPanel } from './DevelopmentPanel'
import { PlayerDevelopmentDetail } from './PlayerDevelopmentDetail'
import { MerlinKnowledgeBasePanel } from './MerlinKnowledgeBasePanel'
import type { PlayerDevelopmentSummary } from '../../shared/playerDevelopmentTypes'
import { ClubEditorPanel } from './ClubEditorPanel'
import { ComparePanel } from './compare/ComparePanel'
import type { ProfileNavigationContext } from '../../shared/profileNavigation'
import { attrColor, engineBracketClass, profileAttrHighlightClass, ProfileAttrColumn } from './ProfileAttrBlocks'
import { applyProfileHighlightPack, highlightPackForArchetype } from './profileHighlightApply'
import { NaturalRoleHighlightPicker } from './profile/NaturalRoleHighlightPicker'
import { formatIsoDateUk } from '../../shared/dateDisplay'
import { InstructionHintRow, ProfilePlayerIdentity } from './profile/profileUi'
import { EffectivenessRecipeBreakdown } from './profile/EffectivenessRecipeBreakdown'
import { PlayerRiskChips } from './profile/PlayerRiskChips'
import { RolePercentMiniCell } from './profile/RolePercentMiniCell'
import { defaultProfileHighlightArchetypeId } from '../../shared/profileHighlightRole'
import { defaultArchetypeFromCmScoutIndex } from '../../main/positionHighlights'
import {
  getCopiedPlayerAttributes,
  setCopiedPlayerAttributes,
  subscribeCopiedPlayerAttributes,
  type CopiedPlayerAttributes,
} from '../../shared/copiedPlayerAttributes'
import { EditorPlayerPicker } from './editor/EditorPlayerPicker'
import { CONTRACT_TYPE_FILTER_OPTIONS, type ContractTypeCategoryId } from '../../shared/contractTypes'
import { STAFF_ATTR_FILTER_COUNT } from '../../shared/staffAttrCatalog'
import { staffJobForClubDropdownEntries } from '../../shared/staffJobCatalog'
import type { StaffBrowseFilter } from '../../main/staffBrowse'
import { MERLIN_LS } from '../../shared/merlinStorageKeys'

const gridColHelper = createGridColumnHelper()

const ENGINE_ATTRS_LS = MERLIN_LS.profileEngineAttrs
const FILTERS_COLLAPSED_LS = MERLIN_LS.filtersCollapsed
const PROFILE_PANE_WIDTH_LS = MERLIN_LS.profilePanePx
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
  if (kind === 'rating') return <span className="font-mono text-zinc-200">{v.toFixed(2)}</span>
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
        className="shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 font-medium">Show Uncapped Attributes</span>
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
  type FootRow = ProfilePayload['feetMorale']['left']
  const row = (label: string, v: FootRow, band: (n: number) => string) => (
    <div
      key={label}
      className={`flex justify-between gap-1.5 border-b border-zinc-800/30 py-1 text-[12px] ${profileAttrHighlightClass(v)}`}
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
    archiveReadPath?: string
    archiveSiblingWarning?: string
    compressed: boolean
    gameDate: string | null
    playerCount: number
    staffDatRows: number
    playerBlobRows: number
    competitions: Array<{ id: number; name: string }>
    playerStatsHistoryPresent?: boolean
    regenBaseline: {
      active: boolean
      savedAt?: string
      entryCount?: number
      indexPath?: string
      tracksDevelopment?: boolean
      snapshotVersion?: 1 | 2
    }
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<GridPlayerRow[]>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'rating', desc: true }])
  const [caMin, setCaMin] = useState('')
  const [caMax, setCaMax] = useState('')
  const [paMin, setPaMin] = useState('')
  const [paMax, setPaMax] = useState('')
  const [cmScoutMin, setCmScoutMin] = useState('')
  const [cmScoutMax, setCmScoutMax] = useState('')
  const [effMin, setEffMin] = useState('')
  const [effMax, setEffMax] = useState('')
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
  const [csGoalsMin, setCsGoalsMin] = useState('')
  const [csGoalsMax, setCsGoalsMax] = useState('')
  const [csAssistsMin, setCsAssistsMin] = useState('')
  const [csAssistsMax, setCsAssistsMax] = useState('')
  const [csAppsMin, setCsAppsMin] = useState('')
  const [csAvrMin, setCsAvrMin] = useState('')
  const [csLeagueGoalsMin, setCsLeagueGoalsMin] = useState('')
  const [csLeagueAssistsMin, setCsLeagueAssistsMin] = useState('')
  const [csCompetitionId, setCsCompetitionId] = useState('')
  const [csCompGoalsMin, setCsCompGoalsMin] = useState('')
  const [csCompGoalsMax, setCsCompGoalsMax] = useState('')
  const [csCompAssistsMin, setCsCompAssistsMin] = useState('')
  const [csCompAssistsMax, setCsCompAssistsMax] = useState('')
  const [csCompAppsMin, setCsCompAppsMin] = useState('')
  const [contractTypeCategory, setContractTypeCategory] = useState<'' | ContractTypeCategoryId>('')
  const [tlClub, setTlClub] = useState(false)
  const [tlRequest, setTlRequest] = useState(false)
  const [loanListed, setLoanListed] = useState(false)
  const [euOnly, setEuOnly] = useState(false)
  const [bosmanOnly, setBosmanOnly] = useState(false)
  const [minReleaseClause, setMinReleaseClause] = useState(false)
  const [unprotectedContractOnly, setUnprotectedContractOnly] = useState(false)
  const [expiresWithinMonths, setExpiresWithinMonths] = useState('')
  const [attrMins, setAttrMins] = useState<string[]>(() => Array.from({ length: 48 }, () => ''))
  /** Among attribute cells with a min &gt; 0, require at least this many to pass (empty = all must pass). */
  const [attrMinMatchAtLeast, setAttrMinMatchAtLeast] = useState('')
  const activeAttrFilterCount = useMemo(() => countActiveAttrMinsStrings(attrMins), [attrMins])
  const [staffJobForClub, setStaffJobForClub] = useState('')
  /** Editor → Staff/MD: restrict list to chairman (1) + managing director (2). */
  const [staffBoardOnly, setStaffBoardOnly] = useState(false)
  const [staffIncludePlayers, setStaffIncludePlayers] = useState(false)
  const [staffCoachingCaMin, setStaffCoachingCaMin] = useState('')
  const [staffCoachingCaMax, setStaffCoachingCaMax] = useState('')
  const [staffReputationMin, setStaffReputationMin] = useState('')
  const [staffReputationMax, setStaffReputationMax] = useState('')
  const [staffCoachingPaMin, setStaffCoachingPaMin] = useState('')
  const [staffCoachingPaMax, setStaffCoachingPaMax] = useState('')
  const [staffAttrMins, setStaffAttrMins] = useState<string[]>(() =>
    Array.from({ length: STAFF_ATTR_FILTER_COUNT }, () => ''),
  )
  const [staffAttrMinMatchAtLeast, setStaffAttrMinMatchAtLeast] = useState('')
  const activeStaffAttrFilterCount = useMemo(
    () => countActiveAttrMinsStrings(staffAttrMins),
    [staffAttrMins],
  )
  const staffJobOptions = useMemo(() => staffJobForClubDropdownEntries(), [])

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

  useEffect(() => {
    if (activeStaffAttrFilterCount === 0) {
      setStaffAttrMinMatchAtLeast((prev) => (prev !== '' ? '' : prev))
      return
    }
    setStaffAttrMinMatchAtLeast((prev) => {
      if (prev.trim() === '') return prev
      const m = parseInt(prev, 10)
      if (!Number.isFinite(m) || m <= 0) return prev
      if (m > activeStaffAttrFilterCount) return String(activeStaffAttrFilterCount)
      return prev
    })
  }, [staffAttrMins, activeStaffAttrFilterCount])

  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  /** CM Scout % column (0–6) driving attribute highlight rings on the open profile. */
  const [profileHighlightArchetypeId, setProfileHighlightArchetypeId] = useState('mc')
  const [copyAttrsMsg, setCopyAttrsMsg] = useState<string | null>(null)
  const [copiedAttrs, setCopiedAttrs] = useState<CopiedPlayerAttributes | null>(() => getCopiedPlayerAttributes())
  const [staffProfile, setStaffProfile] = useState<StaffProfilePayload | null>(null)
  const [staffTableSel, setStaffTableSel] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [opening, setOpening] = useState(false)
  const [loadProgress, setLoadProgress] = useState<DatabaseLoadProgress | null>(null)
  const [gridMeta, setGridMeta] = useState<{ total: number } | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadGridColumnOrder())
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null)
  const [clubList, setClubList] = useState<string[]>([])
  const [nationList, setNationList] = useState<string[]>([])
  const [committedText, setCommittedText] = useState({ q: '', nation: '', club: '' })

  const staffBrowseFilter = useMemo((): StaffBrowseFilter => {
    const num = (s: string) => {
      if (s === '') return undefined
      const n = Number(s)
      return Number.isFinite(n) ? n : undefined
    }
    const mins = staffAttrMins.map((s) => {
      if (s.trim() === '') return null
      const n = Number(s)
      return Number.isFinite(n) && n > 0 ? n : null
    })
    const matchN = num(staffAttrMinMatchAtLeast)
    const job =
      !staffBoardOnly && staffJobForClub !== '' && Number.isFinite(Number(staffJobForClub))
        ? Math.floor(Number(staffJobForClub))
        : undefined
    const expM = num(expiresWithinMonths)
    return {
      q: committedText.q,
      nation: committedText.nation,
      club: committedText.club,
      jobForClub: job,
      jobForClubIn: staffBoardOnly ? [1, 2] : undefined,
      includePlayers: staffIncludePlayers,
      ageMin: num(ageMin),
      ageMax: num(ageMax),
      wageMin: num(wageMin),
      wageMax: num(wageMax),
      coachingCaMin: num(staffCoachingCaMin),
      coachingCaMax: num(staffCoachingCaMax),
      reputationMin: num(staffReputationMin),
      reputationMax: num(staffReputationMax),
      coachingPaMin: num(staffCoachingPaMin),
      coachingPaMax: num(staffCoachingPaMax),
      contractTypeCategory: contractTypeCategory || undefined,
      contractExpiresWithinMonths:
        expiresWithinMonths.trim() !== '' && expM != null && expM >= 1 ? Math.floor(expM) : undefined,
      leavingOnBosman: bosmanOnly || undefined,
      euPassport: euOnly || undefined,
      attrMins: mins.some((m) => m != null) ? mins : undefined,
      attrMinMatchAtLeast:
        staffAttrMinMatchAtLeast.trim() !== '' && matchN != null && matchN >= 1 ? Math.floor(matchN) : undefined,
    }
  }, [
    committedText,
    staffJobForClub,
    staffBoardOnly,
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
    expiresWithinMonths,
    bosmanOnly,
    euOnly,
    staffAttrMins,
    staffAttrMinMatchAtLeast,
  ])

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
  const [browseTab, setBrowseTab] = useState<BrowseTabId>('players')
  const [compareLeftStaffIndex, setCompareLeftStaffIndex] = useState<number | null>(null)
  const [compareRightStaffIndex, setCompareRightStaffIndex] = useState<number | null>(null)
  const [comparePickTarget, setComparePickTarget] = useState<'left' | 'right' | null>(null)
  const [shortlistNavOrder, setShortlistNavOrder] = useState<number[]>([])
  const [shortlistKind, setShortlistKind] = useState<ShortlistKind>('players')
  const [editorPane, setEditorPane] = useState<'player' | 'staff' | 'club'>('player')
  /** Last club selected in Clubs tab — Tactics Lab uses this for save tactic wiring. */
  const [tacticsSeedClubId, setTacticsSeedClubId] = useState<number | null>(null)
  const [tacticsSeedClubName, setTacticsSeedClubName] = useState<string | null>(null)
  const onTacticsSeedClubChange = useCallback((clubId: number | null, clubName: string | null) => {
    setTacticsSeedClubId(clubId)
    setTacticsSeedClubName(clubName)
  }, [])
  const clubBrowse = useClubBrowse(
    !!loadInfo,
    loadInfo?.path ?? null,
    (id, name) => onTacticsSeedClubChange(id, name ?? null),
  )
  const { clearClubSearch, selId: clubsTabSelId } = clubBrowse
  const clubFavorites = useClubFavorites(loadInfo?.path ?? null)

  const selectedClubForFavorites = useMemo((): ClubListRow | null => {
    const id = clubBrowse.selId
    if (id == null) return null
    const fromSuggest = clubBrowse.suggestions.find((c) => c.id === id)
    if (fromSuggest) return fromSuggest
    const fromFav = clubFavorites.favorites.find((c) => c.id === id)
    if (fromFav) return fromFav
    const d = clubBrowse.detail
    if (d?.id === id) {
      return {
        id: d.id,
        name: d.name,
        nation: d.nation,
        division: d.division,
        reputation: d.reputation,
        cash: d.cash,
        stadiumId: d.stadiumId,
      }
    }
    return null
  }, [clubBrowse.selId, clubBrowse.suggestions, clubBrowse.detail, clubFavorites.favorites])
  const [tacticsClearNotice, setTacticsClearNotice] = useState<string | null>(null)
  const clearTacticsSquadClub = useCallback(() => {
    const hadClubsTab = clubsTabSelId != null
    onTacticsSeedClubChange(null, null)
    clearClubSearch()
    if (hadClubsTab) {
      setTacticsClearNotice(
        'Squad club cleared. The club you had selected on the Clubs tab was cleared as well.',
      )
      window.setTimeout(() => setTacticsClearNotice(null), 8000)
    }
  }, [clubsTabSelId, clearClubSearch, onTacticsSeedClubChange])
  const clearTacticsWorkspace = useCallback(() => {
    setTacticsAssignments({})
    clearTacticsSquadClub()
  }, [clearTacticsSquadClub])
  const shortlists = useShortlists(loadInfo?.path ?? null)
  const [shortlistMenu, setShortlistMenu] = useState<{
    x: number
    y: number
    kind: ShortlistKind
    target: ShortlistMenuTarget
  } | null>(null)
  const [tacticsPitchSlots, setTacticsPitchSlots] = useState<PitchSlot[]>(() => initialPitchSlots())
  const [tacticsAssignments, setTacticsAssignments] = useState<
    Partial<Record<string, TacticsPlayerAssignment | null>>
  >({})

  useEffect(() => {
    if (!loadInfo?.path) return
    const saved = loadSavedTacticsLayout(loadInfo.path)
    if (saved?.length) {
      setTacticsPitchSlots(snapAndRedistributePitch(saved))
    }
  }, [loadInfo?.path])
  const [positionFilterRoles, setPositionFilterRoles] = useState<PositionRoleFilterId[]>([])
  const [positionFilterSides, setPositionFilterSides] = useState<PositionSideFilterId[]>([])
  const [regenBaselineSaving, setRegenBaselineSaving] = useState(false)
  const [regenSeenTick, setRegenSeenTick] = useState(0)
  const [devDetail, setDevDetail] = useState<PlayerDevelopmentSummary | null>(null)
  const [regenOnly, setRegenOnly] = useState(false)
  const [regenProspectPaMin, setRegenProspectPaMin] = useState(String(ELITE_PROSPECT_PA_MIN))
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
    setContractTypeCategory('')
    setTlClub(false)
    setTlRequest(false)
    setLoanListed(false)
    setEuOnly(false)
    setBosmanOnly(false)
    setMinReleaseClause(false)
    setExpiresWithinMonths('')
    setAttrMins(Array.from({ length: 48 }, () => ''))
    setAttrMinMatchAtLeast('')
    setStaffJobForClub('')
    setStaffIncludePlayers(false)
    setStaffCoachingCaMin('')
    setStaffCoachingCaMax('')
    setStaffReputationMin('')
    setStaffReputationMax('')
    setStaffCoachingPaMin('')
    setStaffCoachingPaMax('')
    setStaffAttrMins(Array.from({ length: STAFF_ATTR_FILTER_COUNT }, () => ''))
    setStaffAttrMinMatchAtLeast('')
    setRegenOnly(false)
    setCmScoutMin('')
    setCmScoutMax('')
    setEffMin('')
    setEffMax('')
    setCsGoalsMin('')
    setCsGoalsMax('')
    setCsAssistsMin('')
    setCsAssistsMax('')
    setCsAppsMin('')
    setCsAvrMin('')
    setCsLeagueGoalsMin('')
    setCsLeagueAssistsMin('')
    setCsCompetitionId('')
    setCsCompGoalsMin('')
    setCsCompGoalsMax('')
    setCsCompAssistsMin('')
    setCsCompAssistsMax('')
    setCsCompAppsMin('')
    setEngineSniffer('off')
    setPositionFilterRoles([])
    setPositionFilterSides([])
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

  const playerFilterInputs = useMemo(
    (): Omit<PlayerGridFilterBuildInput, 'browseTab' | 'gridInclude'> => ({
      committedText,
      caMin,
      caMax,
      paMin,
      paMax,
      cmScoutMin,
      cmScoutMax,
      effMin,
      effMax,
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
      csGoalsMin,
      csGoalsMax,
      csAssistsMin,
      csAssistsMax,
      csAppsMin,
      csAvrMin,
      csLeagueGoalsMin,
      csLeagueAssistsMin,
      csCompetitionId,
      csCompGoalsMin,
      csCompGoalsMax,
      csCompAssistsMin,
      csCompAssistsMax,
      csCompAppsMin,
      contractTypeCategory,
      tlClub,
      tlRequest,
      loanListed,
      euOnly,
      bosmanOnly,
      minReleaseClause,
      unprotectedContractOnly,
      expiresWithinMonths,
      attrMins,
      attrMinMatchAtLeast,
      regenOnly,
      engineSniffer,
      positionFilterRoles,
      positionFilterSides,
    }),
    [
      committedText,
      caMin,
      caMax,
      paMin,
      paMax,
      cmScoutMin,
      cmScoutMax,
      effMin,
      effMax,
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
      csGoalsMin,
      csGoalsMax,
      csAssistsMin,
      csAssistsMax,
      csAppsMin,
      csAvrMin,
      csLeagueGoalsMin,
      csLeagueAssistsMin,
      csCompetitionId,
      csCompGoalsMin,
      csCompGoalsMax,
      csCompAssistsMin,
      csCompAssistsMax,
      csCompAppsMin,
      contractTypeCategory,
      tlClub,
      tlRequest,
      loanListed,
      euOnly,
      bosmanOnly,
      minReleaseClause,
      unprotectedContractOnly,
      expiresWithinMonths,
      attrMins,
      attrMinMatchAtLeast,
      regenOnly,
      engineSniffer,
      positionFilterRoles,
      positionFilterSides,
    ],
  )

  const playerGridFilterPayload = useMemo(
    () =>
      buildPlayerGridFilterPayload({
        ...playerFilterInputs,
        browseTab: browseTab === 'regens' ? 'regens' : 'players',
        gridInclude: { role7: true },
      }),
    [playerFilterInputs, browseTab],
  )

  const showPlayerFilters =
    browseTab === 'players' || browseTab === 'regens' || (browseTab === 'shortlists' && shortlistKind === 'players')
  const showStaffFilters =
    browseTab === 'staff' ||
    (browseTab === 'shortlists' && shortlistKind === 'staff') ||
    (browseTab === 'editor' && editorPane === 'staff')
  const staffEditorFilters = browseTab === 'editor' && editorPane === 'staff'

  const profileAsideRef = useRef<HTMLDivElement>(null)
  const profileAsideShellRef = useRef<HTMLElement>(null)
  const lastProfilePanePxRef = useRef(readProfilePanePx())
  const [profilePanePx, setProfilePanePx] = useState(() => lastProfilePanePxRef.current)

  const applyProfilePaneWidth = useCallback((px: number) => {
    const shell = profileAsideShellRef.current
    if (shell) shell.style.width = `${px}px`
  }, [])

  useEffect(() => {
    lastProfilePanePxRef.current = profilePanePx
    applyProfilePaneWidth(profilePanePx)
  }, [profilePanePx, applyProfilePaneWidth])

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
      applyProfilePaneWidth(next)
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setProfilePanePx(lastProfilePanePxRef.current)
      try {
        localStorage.setItem(PROFILE_PANE_WIDTH_LS, String(lastProfilePanePxRef.current))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [applyProfilePaneWidth])

  const onProfileSplitterDoubleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    lastProfilePanePxRef.current = DEFAULT_PROFILE_PANE_PX
    setProfilePanePx(DEFAULT_PROFILE_PANE_PX)
    applyProfilePaneWidth(DEFAULT_PROFILE_PANE_PX)
    try {
      localStorage.setItem(PROFILE_PANE_WIDTH_LS, String(DEFAULT_PROFILE_PANE_PX))
    } catch {
      /* ignore */
    }
  }, [applyProfilePaneWidth])

  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    if (!loadInfo) {
      setRows([])
      setGridMeta(null)
      setGridRefreshing(false)
      return
    }
    if (
      browseTab === 'staff' ||
      browseTab === 'clubs' ||
      browseTab === 'tactics' ||
      browseTab === 'editor' ||
      browseTab === 'shortlists' ||
      browseTab === 'compare' ||
      browseTab === 'development' ||
      browseTab === 'knowledge'
    ) {
      setGridRefreshing(false)
      return
    }
    const seq = ++refreshSeq.current
    setGridRefreshing(true)
    const f = buildPlayerGridFilterPayload({
      ...playerFilterInputs,
      browseTab,
      gridInclude,
    })
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
      if (first && typeof first === 'object' && 'error' in first && (first as { error?: string }).error) {
        setErr(String((first as { error: string }).error))
        setRows([])
        setGridMeta(null)
        return
      }
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
      if (list.length > 0) {
        setErr(null)
        startTransition(() => {
          setRows(list)
          setGridMeta({ total })
        })
        return
      }
      setGridMeta({ total })
      setRows([])
      setErr(null)
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
    playerFilterInputs,
    browseTab,
    gridInclude,
    loadInfo,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!profile) return
    profileAsideRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [profile])

  const saveRegenBaseline = useCallback(async () => {
    if (typeof window.cmapi?.saveRegenBaseline !== 'function' || regenBaselineSaving) return
    setRegenBaselineSaving(true)
    try {
      const out = await window.cmapi.saveRegenBaseline()
      if (!out || typeof out !== 'object' || !('ok' in out) || !out.ok) {
        const err =
          out && typeof out === 'object' && 'error' in out
            ? String((out as { error: string }).error)
            : 'Save failed'
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
                tracksDevelopment: out.tracksDevelopment,
                snapshotVersion: out.snapshotVersion,
              },
            }
          : li,
      )
      void refresh()
    } finally {
      setRegenBaselineSaving(false)
    }
  }, [refresh, regenBaselineSaving])

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
              tracksDevelopment: out.tracksDevelopment,
              snapshotVersion: out.snapshotVersion,
            },
          }
        : li,
    )
    clearRegenSeen(loadInfo?.path ?? null)
    setRegenSeenTick((t) => t + 1)
    void refresh()
  }, [loadInfo?.path, refresh])

  const allRegenStaffIds = useMemo(
    () => rows.filter((r) => r.isRegenLikely).map((r) => String(r.staffId)),
    [rows],
  )

  const newRegenStaffIdsList = useMemo(() => {
    void regenSeenTick
    return newRegenStaffIds(loadInfo?.path ?? null, allRegenStaffIds)
  }, [allRegenStaffIds, loadInfo?.path, regenSeenTick])

  const markRegensAsSeen = useCallback(() => {
    markRegensSeen(loadInfo?.path ?? null, allRegenStaffIds)
    setRegenSeenTick((t) => t + 1)
  }, [allRegenStaffIds, loadInfo?.path])

  useEffect(() => {
    const unsub = window.cmapi?.onDatabaseLoadProgress?.((p) => {
      setLoadProgress(p)
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    if (sel == null || !profile) return
    setProfileHighlightArchetypeId(defaultProfileHighlightArchetypeId(profile))
  }, [sel, profile?.defaultHighlightArchetypeId, profile?.effByArchetype, profile?.effArchetypeId])

  const displayProfile = useMemo(() => {
    if (!profile) return profile
    const pack = highlightPackForArchetype(profile, profileHighlightArchetypeId)
    if (!pack) return profile
    return applyProfileHighlightPack(profile, pack)
  }, [profile, profileHighlightArchetypeId])

  const loadDatabase = useCallback(async () => {
    setErr(null)
    if (typeof window.cmapi?.openDatabase !== 'function') {
      setErr(
        'CM-01/02 Merlin must run inside the Electron app window (the packaged .app or npm run dev). A normal browser tab cannot open files.',
      )
      return
    }
    const loadStartedAt = Date.now()
    setOpening(true)
    setLoadProgress({
      phase: 'read',
      message: 'Choose your save file…',
      progress: 0.02,
    })
    try {
      const r = await window.cmapi.openDatabase()
      if (!r || typeof r !== 'object' || !('ok' in r)) {
        setErr('Unexpected response from the app. Try restarting CM-01/02 Merlin.')
        return
      }
      if (!r.ok) {
        if (r.error !== 'cancelled') setErr(r.error)
        return
      }
      if (r.playerCount <= 0) {
        setErr('No playable players were found in this save file.')
        setLoadInfo({
          path: r.path,
          archiveReadPath: r.archiveReadPath,
          archiveSiblingWarning: r.archiveSiblingWarning,
          compressed: r.compressed,
          gameDate: r.gameDate,
          playerCount: 0,
          staffDatRows: r.staffDatRows,
          playerBlobRows: r.playerBlobRows,
          regenBaseline: r.regenBaseline,
          competitions: r.competitions ?? [],
          playerStatsHistoryPresent: r.playerStatsHistoryPresent,
        })
        setRows([])
        setGridMeta({ total: 0 })
        return
      }
      const gridIncludeAfterLoad = gridFlagsForVisibleColumnIds(columnOrder)
      const gridPkt = await window.cmapi.getRows({
        offset: 0,
        limit: 12000,
        gridInclude: gridIncludeAfterLoad,
      } as Record<string, unknown>)
      if (
        gridPkt &&
        typeof gridPkt === 'object' &&
        'error' in gridPkt &&
        (gridPkt as { error?: string }).error
      ) {
        setErr(String((gridPkt as { error: string }).error))
        return
      }
      const initialRows =
        gridPkt &&
        typeof gridPkt === 'object' &&
        'rows' in gridPkt &&
        Array.isArray((gridPkt as { rows: unknown }).rows)
          ? ((gridPkt as { rows: GridPlayerRow[] }).rows ?? [])
          : []
      const initialTotal =
        gridPkt && typeof gridPkt === 'object' && 'total' in gridPkt && typeof (gridPkt as { total: unknown }).total === 'number'
          ? (gridPkt as { total: number }).total
          : initialRows.length
      setLoadInfo({
        path: r.path,
        archiveReadPath: r.archiveReadPath,
        archiveSiblingWarning: r.archiveSiblingWarning,
        compressed: r.compressed,
        gameDate: r.gameDate,
        playerCount: r.playerCount,
        staffDatRows: r.staffDatRows,
        playerBlobRows: r.playerBlobRows,
        regenBaseline: r.regenBaseline,
        competitions: r.competitions ?? [],
        playerStatsHistoryPresent: r.playerStatsHistoryPresent,
      })
      setTacticsSeedClubId(null)
      setClubList(r.clubs)
      setNationList(r.nations ?? [])
      clearAllFilters()
      setBrowseTab('players')
      setRows(initialRows)
      setGridMeta({ total: initialTotal })
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
      const minOverlayMs = 450
      const wait = Math.max(0, minOverlayMs - (Date.now() - loadStartedAt))
      window.setTimeout(() => setLoadProgress(null), wait)
    }
  }, [columnOrder, clearAllFilters])

  const autoOpenDatabaseDone = useRef(false)
  useEffect(() => {
    if (isProfilePopoutWindow()) return
    if (loadInfo || autoOpenDatabaseDone.current) return
    const id = window.setTimeout(() => {
      if (autoOpenDatabaseDone.current) return
      autoOpenDatabaseDone.current = true
      void loadDatabase()
    }, 200)
    return () => window.clearTimeout(id)
  }, [loadDatabase, loadInfo])

  const columns = useMemo(() => buildGridColumns(gridColHelper, columnOrder), [columnOrder])

  /** Regens tab: linked regens + elite young prospects (PA floor). */
  const gridRows = useMemo(() => {
    if (browseTab !== 'regens') return rows
    const paFloor = Number(regenProspectPaMin)
    const minPa = Number.isFinite(paFloor) && paFloor >= 1 ? paFloor : ELITE_PROSPECT_PA_MIN
    return rows.filter(
      (r) => r.isRegenLikely === true || (r.isEliteProspect === true && r.pa >= minPa),
    )
  }, [rows, browseTab, regenProspectPaMin])

  const table = useReactTable<GridPlayerRow>({
    data: gridRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.staffIndex),
  })

  const scrollParentRef = useRef<HTMLDivElement>(null)
  const browseTabScrollRef = useRef<Partial<Record<BrowseTabId, number>>>({})
  const changeBrowseTab = useCallback(
    (next: BrowseTabId) => {
      const el = scrollParentRef.current
      if (el) browseTabScrollRef.current[browseTab] = el.scrollTop
      setBrowseTab(next)
      if (loadInfo && (next === 'players' || next === 'regens' || next === 'compare')) {
        window.setTimeout(() => void refresh(), 0)
      }
    },
    [browseTab, loadInfo, refresh],
  )
  const tableRows = table.getRowModel().rows

  const buildPopoutNavigation = useCallback(
    (kind: 'player' | 'staff'): ProfileNavigationContext | undefined => {
      if (kind !== 'player') return undefined
      if (browseTab === 'players' || browseTab === 'regens' || browseTab === 'compare') {
        const order = tableRows.map((r) => r.original.staffIndex)
        if (order.length < 2) return undefined
        return { orderedStaffIndices: order, source: 'grid' }
      }
      if (browseTab === 'shortlists' && shortlistNavOrder.length >= 2) {
        return { orderedStaffIndices: shortlistNavOrder, source: 'shortlist' }
      }
      return undefined
    },
    [browseTab, tableRows, shortlistNavOrder],
  )

  const openPopoutProfile = useCallback(
    (staffIndex: number, kind: 'player' | 'staff') => {
      void window.cmapi?.openProfileWindow({
        staffIndex,
        kind,
        navigation: buildPopoutNavigation(kind),
      })
    },
    [buildPopoutNavigation],
  )

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
    const el = scrollParentRef.current
    if (!el) return
    const saved = browseTabScrollRef.current[browseTab] ?? 0
    requestAnimationFrame(() => {
      el.scrollTo({ top: saved, behavior: 'auto' })
    })
  }, [browseTab])

  useEffect(() => {
    if (browseTab !== 'players' && browseTab !== 'regens') return
    scrollParentRef.current?.scrollTo({ top: 0 })
    browseTabScrollRef.current[browseTab] = 0
  }, [sorting])

  useEffect(() => {
    if (browseTab !== 'players' && browseTab !== 'regens') return
    scrollParentRef.current?.scrollTo({ top: 0 })
    browseTabScrollRef.current[browseTab] = 0
  }, [rows])

  const loadStaffProfile = useCallback(async (staffIndex: number) => {
    setProfile(null)
    if (typeof window.cmapi?.getStaffProfile !== 'function') return
    const p = await window.cmapi.getStaffProfile(staffIndex)
    setStaffProfile(p)
  }, [])

  const [profileLoading, setProfileLoading] = useState(false)

  const pick = useCallback(async (staffIndex: number) => {
    setSel(staffIndex)
    setStaffProfile(null)
    setProfile(null)
    if (typeof window.cmapi?.getProfile !== 'function') return
    setProfileLoading(true)
    try {
      const p = await window.cmapi.getProfile(staffIndex)
      setProfile(p)
    } catch (e) {
      setProfile(null)
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window.cmapi?.onProfilePopoutSelection !== 'function') return
    return window.cmapi.onProfilePopoutSelection((staffIndex) => {
      void pick(staffIndex)
      const rowIdx = tableRows.findIndex((r) => r.original.staffIndex === staffIndex)
      if (rowIdx >= 0) {
        requestAnimationFrame(() => {
          rowVirtualizer.scrollToIndex(rowIdx, { align: 'auto' })
        })
      }
    })
  }, [pick, tableRows, rowVirtualizer])

  useEffect(() => subscribeCopiedPlayerAttributes(() => setCopiedAttrs(getCopiedPlayerAttributes())), [])

  const applyAttrFilterMinsFromPlayer = useCallback(async (staffIndex: number, source: 'clipboard' | 'picker') => {
    if (typeof window.cmapi?.getAttrFilterMins !== 'function') return
    try {
      const out = await window.cmapi.getAttrFilterMins(staffIndex)
      if (!out?.mins?.length) {
        window.alert('Could not load attribute minimums for that player.')
        return
      }
      const verb = source === 'clipboard' ? 'Paste' : 'Set'
      const msg = `${verb} attribute minimums from ${out.name} into the player search filters?\n\nAll 48 attributes (including hiddens) will be filled from that player. Adjust “Match ≥” to allow near-matches.`
      if (!window.confirm(msg)) return
      setAttrMins([...out.mins])
      setEngineSniffer('off')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const pasteAttrFilterFromCopied = useCallback(() => {
    const c = getCopiedPlayerAttributes()
    if (!c) {
      window.alert('Copy a player’s attributes from their profile first (Copy attributes).')
      return
    }
    void applyAttrFilterMinsFromPlayer(c.staffIndex, 'clipboard')
  }, [applyAttrFilterMinsFromPlayer])

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

  useEffect(() => {
    if (browseTab !== 'development') {
      setDevDetail(null)
      return
    }
    if (sel == null || typeof window.cmapi?.getPlayerDevelopmentDetail !== 'function') {
      setDevDetail(null)
      return
    }
    let cancelled = false
    void window.cmapi.getPlayerDevelopmentDetail(sel).then((res) => {
      if (cancelled) return
      if (res?.ready && res.summary) {
        setDevDetail(res.summary)
      } else {
        setDevDetail(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [browseTab, sel])

  const activateProfile = useCallback(
    (staffIndex: number) => {
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

  const setStaffAttrMinAt = (i: number, v: string) => {
    setStaffAttrMins((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const adjustStaffMatchAtLeast = useCallback(
    (delta: number) => {
      if (activeStaffAttrFilterCount === 0) return
      setStaffAttrMinMatchAtLeast((prev) => {
        const cur = prev.trim() === '' ? null : parseInt(prev, 10)
        if (delta > 0) {
          if (cur == null || !Number.isFinite(cur)) return '1'
          return String(Math.min(activeStaffAttrFilterCount, cur + 1))
        }
        if (cur == null || !Number.isFinite(cur)) return ''
        if (cur <= 1) return ''
        return String(cur - 1)
      })
    },
    [activeStaffAttrFilterCount],
  )

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
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-2 backdrop-blur">
        <BrandHeaderStickers />
        <button
          type="button"
          disabled={opening}
          onClick={() => void loadDatabase()}
          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-md shadow-emerald-900/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opening ? 'Opening…' : 'Load Database'}
        </button>
      </header>

      {loadProgress ? <DatabaseLoadOverlay progress={loadProgress} /> : null}

      {opening && !loadProgress && (
        <div className="flex shrink-0 items-center justify-center border-b border-zinc-800/60 bg-zinc-900/50 px-5 py-3 text-sm text-zinc-400">
          Choose your save file in the dialog…
        </div>
      )}

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
            {loadInfo.gameDate && <span>Game date: {formatIsoDateUk(loadInfo.gameDate)}</span>}
            <span className="text-emerald-400/90">
              {loadInfo.playerCount.toLocaleString()} playable in grid
            </span>
            <span className="text-zinc-500">
              staff.dat {loadInfo.staffDatRows.toLocaleString()} rows · player.dat{' '}
              {loadInfo.playerBlobRows.toLocaleString()} rows
            </span>
            {loadInfo.archiveReadPath && (
              <span className="text-amber-200/90" title={loadInfo.archiveReadPath}>
                Loaded bytes from {loadInfo.archiveReadPath.split(/[/\\]/).pop()}
              </span>
            )}
          </div>
          {loadInfo.archiveSiblingWarning && (
            <div className="border-b border-amber-900/40 bg-amber-950/30 px-5 py-2 text-xs text-amber-100/95">
              {loadInfo.archiveSiblingWarning}
            </div>
          )}
          <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-800/60 bg-zinc-900/30 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <HoverTip
              tip={
                <>
                  Affects the <span className="text-zinc-300">profile</span> attribute lists only: when on, bracketed
                  uncapped values appear when they differ from the in-game display (mostly CA18 conversions).
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
              title={browseTab === 'clubs' ? 'Show club search' : 'Show filters'}
              aria-expanded={false}
              onClick={() => persistFiltersCollapsed(false)}
              className="flex flex-col items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 hover:border-emerald-600/50 hover:bg-zinc-800 hover:text-emerald-200"
            >
              <span aria-hidden className="text-base leading-none text-zinc-500">
                ▸
              </span>
              <span className="max-w-[2.5rem] text-center leading-tight">
                {browseTab === 'clubs' ? 'Clubs' : 'Filters'}
              </span>
            </button>
          </div>
        ) : browseTab === 'clubs' ? (
          <aside className="relative z-20 flex w-[24rem] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/50">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-800/60 px-3 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Clubs</h2>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  title="Clear club search"
                  onClick={clubBrowse.clearClubSearch}
                  className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Clear
                </button>
                <button
                  type="button"
                  title="Hide club search (more room for club detail)"
                  aria-expanded
                  onClick={() => persistFiltersCollapsed(true)}
                  className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="cm-scroll min-h-0 flex-1 overflow-y-auto p-4 text-sm">
              <ClubSearchSidebar
                loadInfo={!!loadInfo}
                q={clubBrowse.q}
                debouncedQ={clubBrowse.debouncedQ}
                suggestions={clubBrowse.suggestions}
                selId={clubBrowse.selId}
                selectedClub={selectedClubForFavorites}
                loadingSuggest={clubBrowse.loadingSuggest}
                err={clubBrowse.err}
                menuOpen={clubBrowse.menuOpen}
                favorites={clubFavorites.favorites}
                isFavorite={clubFavorites.isFavorite}
                onToggleFavorite={clubFavorites.toggleFavorite}
                onRemoveFavorite={clubFavorites.removeFavorite}
                onInputChange={clubBrowse.onInputChange}
                onInputFocus={clubBrowse.onInputFocus}
                onInputBlur={clubBrowse.onInputBlur}
                onPickClub={clubBrowse.pickClub}
              />
            </div>
          </aside>
        ) : (
          <aside className="relative z-20 flex w-[24rem] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/50">
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
            {showStaffFilters && (
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
                staffJobForClub={staffBoardOnly ? '' : staffJobForClub}
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
                showBoardOnlyPreset={staffEditorFilters}
                boardOnly={staffBoardOnly}
                setBoardOnly={(v) => {
                  setStaffBoardOnly(v)
                  if (v) setStaffJobForClub('')
                }}
                defaultHiddenOpen={staffEditorFilters}
              />
            )}
            {browseTab === 'compare' && (
              <p className="text-[11px] leading-snug text-zinc-500">
                Filters apply to the player grid below. Pick left/right slots, then click a row to assign a player for
                side-by-side comparison.
              </p>
            )}
            {(browseTab === 'tactics' ||
              browseTab === 'editor' ||
              browseTab === 'development' ||
              browseTab === 'knowledge') && (
              <p className="text-[11px] leading-snug text-zinc-500">
                Numeric and attribute filters apply on <span className="text-zinc-400">All players</span>,{' '}
                <span className="text-zinc-400">Regens</span>, or <span className="text-zinc-400">Staff</span>. Use{' '}
                <span className="text-zinc-400">Development</span> for snapshot attribute progress and{' '}
                <span className="text-zinc-400">Knowledge base</span> for engine reference.
              </p>
            )}
            {browseTab === 'shortlists' && (
              <p className="text-[11px] leading-snug text-zinc-500">
                Shortlists are saved per loaded database. Left-hand filters apply to the shortlist table — switch between
                player and staff shortlists with the tabs above the list. Export player lists as{' '}
                <span className="font-mono text-zinc-400">.pls</span> into your CM0102 Search folder.
              </p>
            )}
            {showPlayerFilters && (
            <>
            <p className="filter-section-heading">General</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="filter-field-label">Age min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Age max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                />
              </label>
            </div>

            <p className="filter-section-heading pt-1">Ability</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="filter-field-label">CA min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={caMin}
                  onChange={(e) => setCaMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CA max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={caMax}
                  onChange={(e) => setCaMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">PA min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={paMin}
                  onChange={(e) => setPaMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">PA max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={paMax}
                  onChange={(e) => setPaMax(e.target.value)}
                />
              </label>
            </div>

            <p className="filter-section-heading pt-1">Scouting</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="filter-field-label">Scout % min</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={cmScoutMin}
                  onChange={(e) => setCmScoutMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Scout % max</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={cmScoutMax}
                  onChange={(e) => setCmScoutMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Eff % min</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={effMin}
                  onChange={(e) => setEffMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Eff % max</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={effMax}
                  onChange={(e) => setEffMax(e.target.value)}
                />
              </label>
            </div>

            <PlayerPositionFilterPanel
              roles={positionFilterRoles}
              sides={positionFilterSides}
              onChange={({ roles, sides }: PlayerPositionFilterState) => {
                setPositionFilterRoles(roles)
                setPositionFilterSides(sides)
              }}
            />

            <p className="filter-section-heading pt-1">Transfer &amp; contract</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="filter-field-label">Value min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Value max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Wage min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={wageMin}
                  onChange={(e) => setWageMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">Wage max</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={wageMax}
                  onChange={(e) => setWageMax(e.target.value)}
                />
              </label>
            </div>
            <label>
              <span className="filter-field-label">Contract type</span>
              <select
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                value={contractTypeCategory}
                onChange={(e) =>
                  setContractTypeCategory((e.target.value || '') as '' | ContractTypeCategoryId)
                }
              >
                {CONTRACT_TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id || 'any'} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2">
              <span className="filter-subsection-title">Transfer / loan</span>
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
              <span className="filter-subsection-title">Contract / passport</span>
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
              <label
                className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
                title="CM 01/02 post-2001 rule: after 3 years (signed under 28) or 2 years (signed at 28+), the player can be approached to sign during a transfer window."
              >
                <input
                  type="checkbox"
                  checked={unprotectedContractOnly}
                  onChange={(e) => setUnprotectedContractOnly(e.target.checked)}
                />
                Unprotected contract (approach to sign)
              </label>
              <label className="block">
                <span className="filter-field-label-sm">
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

            <p className="filter-section-heading pt-1">Light stats</p>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="filter-field-label">SH career goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerGoalsMin}
                  onChange={(e) => setShCareerGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">SH career goals max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerGoalsMax}
                  onChange={(e) => setShCareerGoalsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">SH season goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonGoalsMin}
                  onChange={(e) => setShSeasonGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">SH season goals max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonGoalsMax}
                  onChange={(e) => setShSeasonGoalsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">SH career apps min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shCareerAppsMin}
                  onChange={(e) => setShCareerAppsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">SH season apps min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={shSeasonAppsMin}
                  onChange={(e) => setShSeasonAppsMin(e.target.value)}
                />
              </label>
            </div>
            <p className="mb-2 pt-1 text-[11px] font-medium text-zinc-400">
              CM save season (Senior club — from player stats in this save)
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label>
                <span className="filter-field-label">CS Senior goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csGoalsMin}
                  onChange={(e) => setCsGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS Senior goals max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csGoalsMax}
                  onChange={(e) => setCsGoalsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS Senior assists min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csAssistsMin}
                  onChange={(e) => setCsAssistsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS Senior assists max</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csAssistsMax}
                  onChange={(e) => setCsAssistsMax(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS Senior apps min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csAppsMin}
                  onChange={(e) => setCsAppsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS Avg rating min</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csAvrMin}
                  onChange={(e) => setCsAvrMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS League goals min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csLeagueGoalsMin}
                  onChange={(e) => setCsLeagueGoalsMin(e.target.value)}
                />
              </label>
              <label>
                <span className="filter-field-label">CS League assists min</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
                  value={csLeagueAssistsMin}
                  onChange={(e) => setCsLeagueAssistsMin(e.target.value)}
                />
              </label>
            </div>
            {loadInfo && loadInfo.competitions.length > 0 && (
              <>
                <p className="mb-2 text-[11px] font-medium text-zinc-400">
                  CM save — by competition (pick a comp, then set min/max goals or assists)
                </p>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <label className="col-span-2 sm:col-span-3">
                    <span className="filter-field-label">Competition</span>
                    <select
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                      value={csCompetitionId}
                      onChange={(e) => setCsCompetitionId(e.target.value)}
                    >
                      <option value="">Any (no comp filter)</option>
                      {loadInfo.competitions.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} (id {c.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="filter-field-label">Goals min</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!csCompetitionId}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 disabled:opacity-40"
                      value={csCompGoalsMin}
                      onChange={(e) => setCsCompGoalsMin(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="filter-field-label">Goals max</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!csCompetitionId}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 disabled:opacity-40"
                      value={csCompGoalsMax}
                      onChange={(e) => setCsCompGoalsMax(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="filter-field-label">Assists min</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!csCompetitionId}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 disabled:opacity-40"
                      value={csCompAssistsMin}
                      onChange={(e) => setCsCompAssistsMin(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="filter-field-label">Assists max</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!csCompetitionId}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 disabled:opacity-40"
                      value={csCompAssistsMax}
                      onChange={(e) => setCsCompAssistsMax(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="filter-field-label">Apps min</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!csCompetitionId}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 disabled:opacity-40"
                      value={csCompAppsMin}
                      onChange={(e) => setCsCompAppsMin(e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
            <details className="rounded-md border border-zinc-800 bg-zinc-900/40">
              <summary
                className="filter-details-summary"
                title="Same 1–20 scale as on-screen attribute bars. Enter 21+ for uncapped CA18 / raw-byte overflow (editor-style intrinsics). Right-click a minimum box: 5 → 10 → 15 → 20 → clear."
              >
                Attributes
              </summary>
              <div className="space-y-2 border-t border-zinc-800 px-2 py-2">
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!copiedAttrs || !loadInfo}
                    onClick={() => pasteAttrFilterFromCopied()}
                    title={
                      copiedAttrs
                        ? `Paste minimums from ${copiedAttrs.name}`
                        : 'Copy attributes on a player profile first'
                    }
                    className="w-full rounded-md border border-sky-700/50 bg-sky-950/40 px-2 py-1.5 text-[11px] font-medium text-sky-100 transition hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Paste attributes from player
                  </button>
                  {copiedAttrs ? (
                    <p className="text-[10px] text-zinc-500">
                      Clipboard: <span className="font-medium text-sky-200/90">{copiedAttrs.name}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-600">
                      Copy attributes on a profile, then paste here (editor paste stays on the Editor tab).
                    </p>
                  )}
                </div>
                {loadInfo && (
                  <EditorPlayerPicker
                    loadInfo={loadInfo}
                    selectedStaffIndex={null}
                    compact
                    searchLabel="Load minimums from player"
                    onPick={(idx) => void applyAttrFilterMinsFromPlayer(idx, 'picker')}
                  />
                )}
                <div
                  className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500"
                  title="Match ≥: empty = every active attribute minimum must pass; otherwise at least N of them must pass."
                >
                  <span className="text-zinc-300">Active</span>
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
                      <span className="filter-attr-label">{label}</span>
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
              <span className="filter-subsection-title">Regens</span>
              <label
                className={`flex items-center gap-2 text-xs ${
                  browseTab === 'regens' ||
                  browseTab === 'staff' ||
                  browseTab === 'clubs' ||
                  browseTab === 'tactics' ||
                  browseTab === 'editor' ||
                  browseTab === 'shortlists' ||
                  browseTab === 'development' ||
                  browseTab === 'knowledge'
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
                    browseTab === 'editor' ||
                    browseTab === 'shortlists' ||
                    browseTab === 'development' ||
                    browseTab === 'knowledge'
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
                <span className="filter-subsection-title flex cursor-default items-center">
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
            </>
            )}
          </div>
          </aside>
        )}

        <div className="flex min-h-0 min-w-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ flex: '1 1 0%', minWidth: '12rem' }}>
          <div className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-zinc-800/80 bg-zinc-950/40 px-3 pt-3.5 pb-3">
            <BrowseTabBar active={browseTab} onChange={changeBrowseTab} />
          </div>
          <div ref={scrollParentRef} className="cm-scroll relative min-h-0 flex-1 overflow-auto px-3 pb-3 pt-0">
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
                filter={staffBrowseFilter}
                selectedStaffIndex={staffTableSel}
                onSelectStaff={(si) => {
                  setStaffTableSel(si)
                  void loadStaffProfile(si)
                }}
                onOpenPlayerProfile={(si) => void pick(si)}
                onRowContextMenu={(e, row) => {
                  e.preventDefault()
                  setShortlistMenu({
                    x: e.clientX,
                    y: e.clientY,
                    kind: 'staff',
                    target: { staffIndex: row.staffIndex, staffId: row.staffId, name: row.name },
                  })
                }}
              />
            )}
            {browseTab === 'shortlists' && (
              <ShortlistsPanel
                loadInfo={!!loadInfo}
                shortlists={shortlists}
                kind={shortlistKind}
                onKindChange={setShortlistKind}
                playerFilter={playerGridFilterPayload}
                staffFilter={staffBrowseFilter}
                onPlayerNavOrderChange={setShortlistNavOrder}
                onOpenPlayer={(si) => {
                  void pick(si)
                }}
                onOpenStaff={(si) => {
                  setStaffTableSel(si)
                  void loadStaffProfile(si)
                }}
              />
            )}
            <div
              className={browseTab === 'clubs' ? 'min-h-0 flex flex-1 flex-col p-3' : 'hidden'}
              aria-hidden={browseTab !== 'clubs'}
            >
              <ClubDetailPane
                loadInfo={!!loadInfo}
                detail={clubBrowse.detail}
                selectedStaffIndex={sel}
                onOpenPlayerProfile={(si) => void pick(si)}
                onOpenStaffProfile={(si) => {
                  setSel(si)
                  setStaffTableSel(si)
                  void loadStaffProfile(si)
                }}
              />
            </div>
            {browseTab === 'development' && (
              <DevelopmentPanel
                loadInfo={!!loadInfo}
                regenBaseline={loadInfo?.regenBaseline ?? null}
                selectedStaffIndex={sel}
                onSelectPlayer={(si) => {
                  setSel(si)
                  setDevDetail(null)
                }}
                onSaveSnapshot={() => void saveRegenBaseline()}
                savingSnapshot={regenBaselineSaving}
              />
            )}
            {browseTab === 'knowledge' && (
              <div className="cm-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8">
                <MerlinKnowledgeBasePanel />
              </div>
            )}
            {browseTab === 'tactics' && (
              <TacticsLabPanel
                loadInfo={!!loadInfo}
                dbPath={loadInfo?.path ?? null}
                tacticsSeedClubId={tacticsSeedClubId}
                tacticsSeedClubName={tacticsSeedClubName}
                onTacticsSeedClubChange={onTacticsSeedClubChange}
                clubsTabHasSelection={clubsTabSelId != null}
                tacticsClearNotice={tacticsClearNotice}
                onClearTacticsSquadClub={clearTacticsSquadClub}
                pitchSlots={tacticsPitchSlots}
                onPitchSlotsChange={setTacticsPitchSlots}
                assignments={tacticsAssignments}
              />
            )}
            {browseTab === 'editor' && (
              <div className="cm-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-800 pb-2">
                  {(
                    [
                      { id: 'player' as const, label: 'Player' },
                      { id: 'staff' as const, label: 'Staff / MD' },
                      { id: 'club' as const, label: 'Club' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditorPane(t.id)}
                      className={`pill-tab text-xs ${editorPane === t.id ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {editorPane === 'club' && (
                  <ClubEditorPanel
                    key={loadInfo?.path ?? 'no-save'}
                    loadInfo={!!loadInfo}
                    compressed={!!loadInfo?.compressed}
                    databasePath={loadInfo?.path ?? null}
                    onSavedToPath={(path) =>
                      setLoadInfo((prev) => (prev ? { ...prev, path } : prev))
                    }
                  />
                )}
                {editorPane === 'player' && (
                  <AttributeEditorPanel
                    loadInfo={!!loadInfo}
                    compressed={!!loadInfo?.compressed}
                    staffIndex={sel}
                  />
                )}
                {editorPane === 'staff' && (
                  <StaffEditorPanel
                    loadInfo={!!loadInfo}
                    compressed={!!loadInfo?.compressed}
                    browseFilter={staffBrowseFilter}
                    staffIndex={staffTableSel}
                    onSelectStaff={setStaffTableSel}
                  />
                )}
              </div>
            )}
            {browseTab === 'compare' && (
              <div className="cm-scroll min-h-0 flex-1 overflow-y-auto p-3">
                <ComparePanel
                  loadInfo={!!loadInfo}
                  leftStaffIndex={compareLeftStaffIndex}
                  rightStaffIndex={compareRightStaffIndex}
                  showEngineAttrs={showEngineAttrs}
                  onPickLeft={() => {
                    if (sel != null) {
                      setCompareLeftStaffIndex(sel)
                      setComparePickTarget(null)
                    } else setComparePickTarget('left')
                  }}
                  onPickRight={() => {
                    if (sel != null) {
                      setCompareRightStaffIndex(sel)
                      setComparePickTarget(null)
                    } else setComparePickTarget('right')
                  }}
                  onClear={() => {
                    setCompareLeftStaffIndex(null)
                    setCompareRightStaffIndex(null)
                    setComparePickTarget(null)
                  }}
                />
                {comparePickTarget && (
                  <p className="mt-2 text-[11px] text-amber-200/90">
                    Click a player row below to set the {comparePickTarget} player.
                  </p>
                )}
              </div>
            )}
            {(browseTab === 'players' || browseTab === 'regens' || browseTab === 'compare') && (
            <>
            {browseTab === 'regens' && loadInfo && loadInfo.regenBaseline.active && newRegenStaffIdsList.length > 0 && (
              <RegenNewSinceLastCheck
                rows={rows}
                newStaffIds={newRegenStaffIdsList}
                onMarkSeen={markRegensAsSeen}
                onSelectStaffIndex={(idx) => setSel(idx)}
              />
            )}
            {browseTab === 'regens' && loadInfo && (
              <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-semibold uppercase tracking-wider text-zinc-400">Regen tracking</span>
                  <HoverTip
                    tip={
                      <div className="space-y-2 text-zinc-300">
                        <p>
                          Like <span className="font-medium text-white">GPF2</span>: take a snapshot early (stored locally,
                          same save path). <strong>Linked</strong> rows use the GPF2 rule — same staff{' '}
                          <code className="text-zinc-400">id</code>, new name — plus fingerprint matching for new faces
                          (PA, nation, positions, birth month/day).
                        </p>
                        <p>
                          The list also includes <strong>elite prospects</strong> — young high-PA players worth scouting even
                          when we cannot name their predecessor yet (adjust PA floor below).
                        </p>
                        <p>
                          Snapshots also power the <strong>Development</strong> tab (attribute growth since snapshot).
                        </p>
                        <p className="text-zinc-400">
                          Legends who retired before your first snapshot cannot be linked. Save Compressed = No. Re-saving a
                          snapshot overwrites the old one.
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
                    <span className="text-zinc-400">
                      Snapshot on · {loadInfo.regenBaseline.entryCount?.toLocaleString() ?? '—'} players ·{' '}
                      <span className="font-mono text-zinc-300">
                        {(loadInfo.regenBaseline.savedAt ?? '').slice(0, 19).replace('T', ' ')}
                      </span>
                      {loadInfo.regenBaseline.tracksDevelopment === false && (
                        <span className="text-zinc-600"> · re-save for development tracking</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-500">
                      No snapshot — save one after load for regens &amp; development tracking
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={regenBaselineSaving}
                    onClick={() => void saveRegenBaseline()}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {regenBaselineSaving ? 'Saving snapshot…' : 'Save snapshot'}
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
                  <label className="inline-flex items-center gap-1.5 text-zinc-400">
                    <span>Prospect PA ≥</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={regenProspectPaMin}
                      onChange={(e) => setRegenProspectPaMin(e.target.value)}
                      className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-zinc-500">
                  Linked = predecessor known (GPF2 slot or fingerprint). Prospect = young high PA, link unknown. Reload
                  after playing CM — no new snapshot needed for players already in the baseline.
                </p>
              </div>
            )}
            {loadInfo && gridRows.length === 0 && (
              <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                {loadInfo.playerCount === 0
                  ? 'No playable players were found in this save. Try the other file in the same folder (Game.sav vs index.dat), or quit CM and open the save you Continue with.'
                  : browseTab === 'regens'
                    ? 'No linked regens or elite prospects match the current filters. Lower Prospect PA or relax other filters.'
                    : 'No players match the current filters. Use Clear all in the filter panel, or relax individual filters.'}
              </p>
            )}
            {!loadInfo && rows.length === 0 && (
              <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                Load a database (index.dat or .sav) to populate the grid.
              </p>
            )}
            <table className="w-full border-collapse text-left text-sm">
              <thead className="cm-grid-sticky-head">
                {loadInfo && gridMeta && gridRows.length > 0 && (
                  <tr className="border-b border-zinc-800/80">
                    <th
                      colSpan={colCount}
                      className="bg-zinc-950 px-2 py-1.5 text-left text-[11px] font-normal text-zinc-500"
                    >
                      Showing <span className="font-mono text-zinc-300">{gridRows.length.toLocaleString()}</span>{' '}
                      {browseTab === 'regens' ? 'regens' : 'loaded rows'}
                      {browseTab !== 'regens' && (
                        <>
                          {' '}
                          · total matching{' '}
                          <span className="font-mono text-zinc-300">{gridMeta.total.toLocaleString()}</span>
                        </>
                      )}
                    </th>
                  </tr>
                )}
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
                        className="cursor-pointer select-none bg-zinc-950 px-2 py-2 font-medium text-zinc-400 hover:text-zinc-200"
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
                      onClick={() => {
                        const si = row.original.staffIndex
                        setSel(si)
                        if (browseTab === 'compare' && comparePickTarget) {
                          if (comparePickTarget === 'left') setCompareLeftStaffIndex(si)
                          else setCompareRightStaffIndex(si)
                          setComparePickTarget(null)
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        activateProfile(row.original.staffIndex)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setShortlistMenu({
                          x: e.clientX,
                          y: e.clientY,
                          kind: 'players',
                          target: {
                            staffIndex: row.original.staffIndex,
                            staffId: row.original.staffId,
                            name: row.original.name,
                          },
                        })
                      }}
                      className={`cursor-pointer select-none border-b border-zinc-800/50 ${
                        sel === row.original.staffIndex
                          ? 'browse-list-row-selected'
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="select-none px-2 py-1.5 text-zinc-200"
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

        {browseTab !== 'knowledge' && (
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
        )}

        {browseTab !== 'knowledge' && (
        <aside
          ref={profileAsideShellRef}
          style={{ width: profilePanePx, maxWidth: 'min(720px, 92vw)' }}
          className="flex min-h-0 min-w-[240px] shrink-0 flex-col overflow-hidden border-l border-zinc-800/80 bg-zinc-950/60"
        >
          <div
            ref={profileAsideRef}
            className="cm-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-0"
          >
          {browseTab === 'tactics' ? (
            <div className="pt-4">
            <TacticsAssignmentPane
              loadInfo={!!loadInfo}
              seedClubId={tacticsSeedClubId}
              seedClubName={tacticsSeedClubName}
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
              onReplaceAssignments={(next) => setTacticsAssignments(next)}
              onClearAll={clearTacticsWorkspace}
            />
            </div>
          ) : browseTab === 'development' ? (
            devDetail ? (
              <PlayerDevelopmentDetail
                summary={devDetail}
                snapshotAt={loadInfo?.regenBaseline?.savedAt}
                snapshotGameDate={loadInfo?.gameDate ?? null}
                onOpenProfile={() => void pick(devDetail.staffIndex)}
              />
            ) : (
              <p className="pt-4 text-sm text-zinc-500">
                {sel != null
                  ? 'Loading development detail…'
                  : 'Select a player from the development list to compare attributes against your snapshot.'}
              </p>
            )
          ) : (
            <>
          {profileLoading && (
            <div className="flex flex-col items-center justify-center gap-3 px-0 py-16 pt-4 text-center">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400"
                aria-hidden
              />
              <p className="text-sm text-zinc-400">Loading player profile…</p>
            </div>
          )}
          {!profileLoading &&
            !profile &&
            browseTab !== 'development' &&
            !((browseTab === 'staff' || browseTab === 'clubs') && staffProfile) && (
            <p className="pt-4 text-sm text-zinc-500">
              {browseTab === 'staff'
                ? 'Select a staff member from the table.'
                : browseTab === 'clubs'
                  ? 'Click a squad player or staff member to open their profile here.'
                  : sel != null
                    ? 'Double-click a row or press Enter to open profile.'
                    : 'Select a player for profile & attributes.'}
            </p>
          )}
          {(browseTab === 'staff' || browseTab === 'clubs') && staffProfile && (
            <StaffProfilePane
              p={staffProfile}
              showEngineAttrs={showEngineAttrs}
              actions={
                <>
                  <button
                    type="button"
                    title="Open staff profile in a separate window"
                    onClick={() => openPopoutProfile(staffProfile.staffIndex, 'staff')}
                    className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700/60"
                  >
                    Pop out
                  </button>
                  <AddToShortlistButton
                    kind="staff"
                    target={{
                      staffIndex: staffProfile.staffIndex,
                      staffId: staffProfile.staffId,
                      name: staffProfile.name,
                    }}
                    shortlists={shortlists}
                  />
                </>
              }
            />
          )}
          {profile && !profileLoading && (
            <div className="space-y-4">
              <div className="profile-pane-sticky">
                <ProfilePlayerIdentity profile={profile} />
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
                        DOB <span className="font-mono text-zinc-400">{formatIsoDateUk(profile.dobIso)}</span>
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
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {sel != null && (
                    <button
                      type="button"
                      title="Open this profile in a separate window (Attributes / Hidden / Other tabs)"
                      onClick={() => openPopoutProfile(sel, 'player')}
                      className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700/60"
                    >
                      Pop out
                    </button>
                  )}
                  {sel != null && loadInfo && (
                    <AddToShortlistButton
                      kind="players"
                      variant="toolbar"
                      target={{
                        staffIndex: sel,
                        staffId: rows.find((r) => r.staffIndex === sel)?.staffId ?? 0,
                        name: profile.name,
                      }}
                      shortlists={shortlists}
                      disabled={!rows.find((r) => r.staffIndex === sel)?.staffId}
                    />
                  )}
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
              </div>

              {profile.regen?.isLikely && (
                <RegenProfileHint
                  regen={profile.regen}
                  onOpenPredecessor={(staffIndex) =>
                    openPopoutProfile(staffIndex, 'player')
                  }
                />
              )}

              <div>
                <HoverTip
                  tip={
                    <div className="space-y-2">
                      <p>
                        In-game CM0102 three-column order (12 / 12 / 7, then feet and morale). Row tint and amber
                        rings follow the natural role selected under CM Scout % / Eff % by recipe (default: best
                        recipe %):{' '}
                        <span className="font-mono text-zinc-200">
                          {displayProfile?.highlightRolesLabel ?? profile.highlightRolesLabel}
                        </span>
                        .
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
                        {' · '}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-6 rounded ring-1 ring-inset ring-amber-100/40" />
                          Recipe primary (×5 in Eff %)
                        </span>
                        {' · '}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-sky-400">Blue label</span>
                          Forum key attrs for role (2–4 per position)
                        </span>
                        <span className="block pt-1 text-zinc-500">
                          Hidden panel: amber ring on consistency, important matches, natural fitness, injury proneness,
                          professionalism, pressure. Same{' '}
                          <span className="font-semibold text-sky-400">blue labels</span> on community hidden attrs
                          (consistency, big games, natural fitness, professionalism, pressure, ambition). AMC vs wide AM
                          use separate highlight packs — pick the Eff recipe tile.
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
                <div
                  key={`attr-${profileHighlightArchetypeId}`}
                  className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2"
                >
                  <ProfileAttrColumn cells={(displayProfile ?? profile).attrColumns[0]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={(displayProfile ?? profile).attrColumns[1]} showEngineAttrs={showEngineAttrs} />
                  <div className="min-w-0">
                    <ProfileAttrColumn cells={(displayProfile ?? profile).attrColumns[2]} showEngineAttrs={showEngineAttrs} />
                    <FeetMoraleBlock feet={(displayProfile ?? profile).feetMorale} showEngineAttrs={showEngineAttrs} />
                  </div>
                </div>
              </div>

              <div>
                <HoverTip
                  tip={
                    <div className="space-y-2">
                      <p>
                        CM second-screen style order: player fields (consistency, corners, penalties, throw-ins,
                        one-on-ones, versatility, dirtiness, important matches, injury proneness, natural fitness) plus
                        staff.dat mentals (adaptability, ambition, loyalty, pressure, professionalism, sportsmanship,
                        temperament). Determination stays in the main Attributes left column from staff.dat.
                      </p>
                      <p className="text-zinc-400">
                        Amber ring marks game-breaking hiddens for every player (Important matches, Consistency, Natural
                        fitness, Injury proneness, Professionalism, Pressure) — same set for all positions.
                      </p>
                    </div>
                  }
                >
                  <h3 className="mb-1 flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Hidden
                    <InfoDot />
                  </h3>
                </HoverTip>
                <div
                  key={`hidden-${profileHighlightArchetypeId}`}
                  className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2"
                >
                  <ProfileAttrColumn cells={(displayProfile ?? profile).hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={(displayProfile ?? profile).hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
                  <ProfileAttrColumn cells={(displayProfile ?? profile).hiddenColumns[2]} showEngineAttrs={showEngineAttrs} />
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                <HoverTip
                  tip={
                    <p className="text-zinc-300">
                      Instruction names match the CM0102 manual Player Instruction dialog (Run with the Ball, Try Through
                      Balls, Free Role, etc.). Yes / No is heuristic scout advice only — not decompiled match AI.
                    </p>
                  }
                >
                  <h3 className="mb-1.5 flex cursor-default items-center font-semibold text-zinc-300">
                    Player Instructions
                    <InfoDot />
                  </h3>
                </HoverTip>
                <ul className="space-y-1.5">
                  {profile.tacticalInstructionHints.map((h) => (
                    <InstructionHintRow
                      key={h.id}
                      label={h.label}
                      tier={h.tier}
                      reason={h.reason}
                    />
                  ))}
                </ul>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
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
                      <span>Contract type</span>
                      <span className="text-right text-zinc-200">{profile.contract.typeLabel}</span>
                      <span>Started</span>
                      <span className="text-right font-mono text-zinc-200">
                        {profile.contract.dateStarted ? formatIsoDateUk(profile.contract.dateStarted) : '—'}
                      </span>
                      <span>Expires</span>
                      <span className="text-right font-mono text-zinc-200">
                        {profile.contract.contractExpires
                          ? formatIsoDateUk(profile.contract.contractExpires)
                          : '—'}
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
              </div>

              {profile.cmScoutRolePercents && profile.cmScoutRolePercents.length === 7 && (
                  <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-2.5">
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
                              <p className="text-zinc-400">
                                <strong className="text-emerald-400">Green</strong> = best % among columns;{' '}
                                <strong className="text-amber-400">amber</strong> = 2nd and 3rd best (ties share a tier).
                                Plain tiles are lower values. Grid BP can be lower if the best column is not a “suitable”
                                role for this player.
                              </p>
                            )}
                          {profile.effArchetype && (
                            <div className="border-t border-zinc-700/80 pt-2">
                              <p className="font-semibold text-zinc-300">Effectiveness %</p>
                              {profile.effPercent != null ? (
                                <>
                                  <p className="mt-1 text-zinc-400">
                                    Best archetype:{' '}
                                    <span className="font-mono text-zinc-200">
                                      {profile.effPercent.toFixed(1)}% ({profile.effArchetype})
                                    </span>
                                  </p>
                                  <div className="mt-2">
                                    <PlayerRiskChips
                                      injuryRisk={profile.injuryRisk}
                                      disciplineRisk={profile.disciplineRisk}
                                      lowConsistencyRisk={profile.lowConsistencyRisk}
                                    />
                                  </div>
                                </>
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
                                    <span className="text-zinc-300">{profile.effWinnerDetail.archetypeLabel}</span>{' '}
                                    — primary ×5, secondary ×1.5. Attribute values above on-screen 20 are marked with{' '}
                                    <span className="text-amber-300/90">↑</span> in the breakdown below.
                                  </p>
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
                    <div className="mt-2 space-y-2">
                      {profile.effByArchetype && profile.effByArchetype.length > 0 && (
                        <NaturalRoleHighlightPicker
                          profile={profile}
                          activeArchetypeId={profileHighlightArchetypeId}
                          onSelectArchetype={setProfileHighlightArchetypeId}
                        />
                      )}
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                        Scout rating per position
                      </p>
                      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
                        {(() => {
                          const percents = profile.cmScoutRolePercents!
                          const tierByRole = cmScoutRoleValueTierByRole(percents)
                          return CM_SCOUT_ROLE_PROFILE_UI_ORDER.map((roleIdx) => {
                            const lab = CM_SCOUT_ROLE_SHORT[roleIdx]!
                            const pct = percents[roleIdx]!
                            const tier = tierByRole.get(roleIdx)
                            return (
                              <RolePercentMiniCell
                                key={lab + roleIdx}
                                label={lab}
                                percent={`${pct}%`}
                                tier={tier}
                                selected={
                                  defaultArchetypeFromCmScoutIndex(roleIdx) === profileHighlightArchetypeId
                                }
                                title={`Highlight attributes for ${lab} (CM Scout column)`}
                                onClick={() =>
                                  setProfileHighlightArchetypeId(defaultArchetypeFromCmScoutIndex(roleIdx))
                                }
                              />
                            )
                          })
                        })()}
                      </div>
                    </div>
                    {profile.effArchetype && profile.effWinnerDetail && (
                      <div className="mt-2">
                        <EffectivenessRecipeBreakdown
                          detail={profile.effWinnerDetail}
                          runnerUp={profile.effRunnerUp}
                          effPercent={profile.effPercent}
                          suppressHeaderSummary
                        />
                      </div>
                    )}
                  </div>
                )}

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
                <HoverTip
                  tip={
                    <div className="space-y-2 text-zinc-300">
                      <p>
                        <strong>Current season</strong> uses the same decoded totals as the player grid (
                        <code className="text-emerald-400/80">player stats.dat</code> senior club and{' '}
                        <code className="text-emerald-400/80">player stats history.tmp</code> when present). Season
                        label is from the save game date (e.g. August 2005 → 2005/06).
                      </p>
                      {profile.seasonStats.savePerformanceHint && (
                        <p className="text-[11px] text-zinc-400">{profile.seasonStats.savePerformanceHint}</p>
                      )}
                    </div>
                  }
                >
                  <h3 className="mb-2 flex cursor-default items-center font-semibold text-zinc-300">
                    Current season
                    {profile.seasonStats.cmHistorySeasonLabel ? (
                      <span className="ml-2 font-mono text-sm font-normal text-emerald-200/90">
                        {profile.seasonStats.cmHistorySeasonLabel}
                      </span>
                    ) : null}
                    <InfoDot />
                  </h3>
                </HoverTip>
                <div className="overflow-x-auto rounded border border-emerald-900/40 bg-emerald-950/20">
                  <table className="w-full min-w-[16rem] border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                        <th className="px-2 py-1.5 font-medium">Competition</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Gls</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Ast</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">MoM</th>
                        <th className="px-2 py-1.5 text-right font-mono font-medium">Av.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const visible = (profile.seasonStats.cmHistoryScopes ?? []).filter(
                          (s) =>
                            s.key !== 'international' &&
                            s.key !== 'nonCompetitive' &&
                            (s.key === 'seniorClub' || s.apps > 0 || s.goals > 0 || s.assists > 0),
                        )
                        if (profile.seasonStats.cmHistoryAvailable && visible.length > 0) {
                          return visible.map((s) => (
                            <tr
                              key={s.key}
                              className={
                                s.key === 'seniorClub'
                                  ? 'border-t border-emerald-800/50 bg-emerald-950/40 font-semibold'
                                  : 'border-b border-zinc-800/40'
                              }
                            >
                              <td className="px-2 py-1.5 text-zinc-100">{s.label}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{s.apps}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{s.goals}</td>
                              <td className="px-2 py-1.5 text-right">{formatProfileStatCell(s.assists)}</td>
                              <td className="px-2 py-1.5 text-right">{formatProfileStatCell(s.mom ?? null)}</td>
                              <td className="px-2 py-1.5 text-right">
                                {formatProfileStatCell(s.averageRating, 'rating')}
                              </td>
                            </tr>
                          ))
                        }
                        return (
                          <tr>
                            <td colSpan={6} className="px-2 py-2.5 text-center text-zinc-500">
                              No current-season stats decoded for this player.
                            </td>
                          </tr>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
            </>
          )}
          </div>
        </aside>
        )}
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
      <ShortlistContextMenu
        open={shortlistMenu != null}
        x={shortlistMenu?.x ?? 0}
        y={shortlistMenu?.y ?? 0}
        kind={shortlistMenu?.kind ?? 'players'}
        target={shortlistMenu?.target ?? null}
        shortlists={shortlists}
        onClose={() => setShortlistMenu(null)}
      />
    </div>
  )
}
