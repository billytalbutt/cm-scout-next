import { ratingPositionSuitable } from './cmScoutRating'
import type { ClubCompRecord } from './database/clubComp'
import type { StaffHistoryRecord } from './database/staffHistory'
import {
  refineHighlightYearWithHistoryFallback,
  resolveStaffHistoryHighlightYear,
} from './database/seasonYear'
import {
  buildCa18Display,
  CA18_KEYS,
  otherAttrDisplay,
  type AttrDisplayBlock,
  type Ca18Key,
} from './database/attributes'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'
import { formatNaturalPositions, humanizeAttrKey, splitIntoThreeColumns } from './profileLayout'
import { computeHighlightSets, footMoraleHighlightTier, formatHighlightRoles } from './positionHighlights'

/**
 * Main profile attribute columns — CM0102-style three-column stack (top → bottom),
 * not alphabetical. Matches the in-game layout: accel…finishing | flair…positioning | set pieces…work rate.
 */
const MAIN_ATTR_COLS: readonly [readonly string[], readonly string[], readonly string[]] = [
  [
    'acceleration',
    'aggression',
    'agility',
    'anticipation',
    'balance',
    'bravery',
    'creativity',
    'crossing',
    'decisions',
    'determination',
    'dribbling',
    'finishing',
  ],
  [
    'flair',
    'handling',
    'heading',
    'influence',
    'jumping',
    'long_shots',
    'marking',
    'natural_fitness',
    'off_the_ball',
    'passing',
    'positioning',
  ],
  [
    'corners',
    'free_kicks',
    'penalties',
    'throw_ins',
    'one_on_ones',
    'pace',
    'reflexes',
    'stamina',
    'strength',
    'tackling',
    'technique',
    'teamwork',
    'work_rate',
  ],
] as const

/** Player attributes on CM’s separate “hidden” screen only (plus staff mentals below). */
const HIDDEN_PLAYER_KEYS = [
  'consistency',
  'dirtiness',
  'important_matches',
  'injury_proneness',
  'versatility',
] as const

function putProfileAttrIntoOther(
  key: string,
  p: PlayerRecord,
  s: StaffRecord,
  ca18: Record<Ca18Key, AttrDisplayBlock>,
  other: Record<string, AttrDisplayBlock>,
) {
  if (Object.prototype.hasOwnProperty.call(other, key)) return
  if (key === 'determination') {
    other[key] = otherAttrDisplay(s.determination)
    return
  }
  if ((CA18_KEYS as readonly string[]).includes(key)) {
    const k = key as Ca18Key
    const x = ca18[k]
    other[key] = { raw: x.raw, inGame: x.inGame, inGameUncapped: x.inGameUncapped, inMatch: x.inMatch }
    return
  }
  other[key] = otherAttrDisplay(p[key as keyof PlayerRecord] as number)
}

export type ProfileAttrCell = {
  key: string
  label: string
  inGame: number
  /** Uncapped CA18-style “engine” display when it differs from capped in-game */
  inGameUncapped: number
  raw: number
  inMatch: number
  invert: boolean
  /** FM-style row tint: key attributes for natural position(s) */
  highlightTier?: 'primary' | 'secondary'
}

export type ProfileFeetMorale = {
  left: {
    label: string
    inGame: number
    inGameUncapped: number
    raw: number
    inMatch: number
    highlightTier?: 'primary' | 'secondary'
  }
  right: {
    label: string
    inGame: number
    inGameUncapped: number
    raw: number
    inMatch: number
    highlightTier?: 'primary' | 'secondary'
  }
  morale: {
    label: string
    inGame: number
    inGameUncapped: number
    raw: number
    inMatch: number
    highlightTier?: 'primary' | 'secondary'
  }
}

export type ProfileDbContext = {
  nationSeasonUpdateDaySamples: number[]
  clubCompsById?: Map<number, ClubCompRecord>
  clubDivisionCompIdByClubId: Map<number, number>
}

function calendarYearFromGameIso(iso: string | null): number | null {
  if (!iso || iso.length < 4) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function historyToSeasonRow(h: StaffHistoryRecord, clubNames: Map<number, string>) {
  const name = clubNames.get(h.clubId)?.trim()
  return {
    year: h.year,
    club: name && name.length > 0 ? name : h.clubId < 0 ? '—' : `#${h.clubId}`,
    onLoan: h.onLoan !== 0,
    apps: h.apps,
    goals: h.goals,
  }
}

function buildProfileSeasonStats(
  row: UiPlayerRow,
  clubNames: Map<number, string>,
  gameDateIso: string | null,
  ctx: ProfileDbContext,
) {
  const hist = row.staffHistory ?? []
  const rawPick = resolveStaffHistoryHighlightYear(gameDateIso, ctx.nationSeasonUpdateDaySamples)
  const pick = refineHighlightYearWithHistoryFallback(hist, rawPick)
  const saveCalendarYear = pick.saveCalendarYear ?? calendarYearFromGameIso(gameDateIso)
  const highlightHistoryYear = pick.highlightHistoryYear
  const toRow = (h: StaffHistoryRecord) => historyToSeasonRow(h, clubNames)
  const allSeasons = [...hist].map(toRow).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return a.club.localeCompare(b.club)
  })
  let careerApps = 0
  let careerGoals = 0
  for (const h of hist) {
    careerApps += h.apps
    careerGoals += h.goals
  }
  const currentHist = highlightHistoryYear != null ? hist.filter((h) => h.year === highlightHistoryYear) : []
  let cApps = 0
  let cGoals = 0
  for (const h of currentHist) {
    cApps += h.apps
    cGoals += h.goals
  }

  const employerClubId = row.contract?.club_id ?? row.staff.club_job_id
  const divCompId = ctx.clubDivisionCompIdByClubId.get(employerClubId)
  let inferredDomesticLeague: { competitionId: number; name: string } | null = null
  if (divCompId != null && divCompId !== 0 && ctx.clubCompsById) {
    const comp = ctx.clubCompsById.get(divCompId)
    const label = (comp?.name ?? '').trim() || (comp?.shortName ?? '').trim()
    if (label) inferredDomesticLeague = { competitionId: divCompId, name: label }
  }

  return {
    internationalCaps: { apps: row.staff.int_apps, goals: row.staff.int_goals },
    saveCalendarYear,
    highlightHistoryYear,
    currentYearResolution: pick.resolution,
    boundaryDayOfYearUsed: pick.boundaryDayOfYearUsed,
    currentSeasonRows: currentHist.map(toRow).sort((a, b) => a.club.localeCompare(b.club)),
    currentSeasonTotals: { apps: cApps, goals: cGoals },
    careerTotals: { apps: careerApps, goals: careerGoals },
    allSeasons,
    inferredDomesticLeague,
    /** Populated when a per-staff competition stats block is mapped (not `staff_history.dat`). */
    perCompetitionRows: [] as { competitionId: number; competitionName: string; apps: number; goals: number }[],
    perCompetitionStatsInSave: false as const,
  }
}

export function buildProfilePayload(
  row: UiPlayerRow,
  clubNames: Map<number, string>,
  gameDateIso: string | null,
  dbContext: ProfileDbContext,
) {
  const p = row.player
  const s = row.staff
  const ca18 = buildCa18Display(p)

  const other: Record<string, AttrDisplayBlock> = {}
  for (const col of MAIN_ATTR_COLS) {
    for (const k of col) putProfileAttrIntoOther(k, p, s, ca18, other)
  }
  for (const k of HIDDEN_PLAYER_KEYS) putProfileAttrIntoOther(k, p, s, ca18, other)

  const mentalStaff: Record<string, AttrDisplayBlock> = {
    adaptability: otherAttrDisplay(s.adaptability),
    ambition: otherAttrDisplay(s.ambition),
    loyalty: otherAttrDisplay(s.loyalty),
    pressure: otherAttrDisplay(s.pressure),
    professionalism: otherAttrDisplay(s.professionalism),
    sportsmanship: otherAttrDisplay(s.sportsmanship),
    temperament: otherAttrDisplay(s.temperament),
  }

  const hl = computeHighlightSets(p)
  const rolesUsed = hl.rolesUsed

  const tierForPlayerAttr = (key: string): 'primary' | 'secondary' | undefined => {
    if (key === 'injury_proneness' || key === 'dirtiness') return undefined
    if (hl.playerPrimary.has(key)) return 'primary'
    if (hl.playerSecondary.has(key)) return 'secondary'
    return undefined
  }

  const tierForStaffAttr = (key: string): 'primary' | 'secondary' | undefined => {
    if (hl.staffPrimary.has(key)) return 'primary'
    if (hl.staffSecondary.has(key)) return 'secondary'
    return undefined
  }

  const toCell = (key: string): ProfileAttrCell => {
    const label = humanizeAttrKey(key)
    if ((CA18_KEYS as readonly string[]).includes(key)) {
      const x = ca18[key as Ca18Key]
      return {
        key,
        label,
        inGame: x.inGame,
        inGameUncapped: x.inGameUncapped,
        raw: x.raw,
        inMatch: x.inMatch,
        invert: false,
        highlightTier: tierForPlayerAttr(key),
      }
    }
    const x = other[key]!
    const inv = key === 'injury_proneness' || key === 'dirtiness'
    const highlightTier =
      key === 'determination'
        ? tierForPlayerAttr(key) ?? tierForStaffAttr('determination')
        : tierForPlayerAttr(key)
    return {
      key,
      label,
      inGame: x.inGame,
      inGameUncapped: x.inGameUncapped,
      raw: x.raw,
      inMatch: x.inMatch,
      invert: inv,
      highlightTier,
    }
  }

  const attrColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]] = [
    MAIN_ATTR_COLS[0].map(toCell),
    MAIN_ATTR_COLS[1].map(toCell),
    MAIN_ATTR_COLS[2].map(toCell),
  ]

  const feetMorale: ProfileFeetMorale = {
    left: {
      label: 'Left foot',
      ...otherAttrDisplay(p.left_foot),
      highlightTier: footMoraleHighlightTier('left_foot', rolesUsed),
    },
    right: {
      label: 'Right foot',
      ...otherAttrDisplay(p.right_foot),
      highlightTier: footMoraleHighlightTier('right_foot', rolesUsed),
    },
    morale: {
      label: 'Morale',
      ...otherAttrDisplay(p.morale),
      highlightTier: footMoraleHighlightTier('morale', rolesUsed),
    },
  }

  const hiddenPlayerCells: ProfileAttrCell[] = [...HIDDEN_PLAYER_KEYS]
    .sort((a, b) => humanizeAttrKey(a).localeCompare(humanizeAttrKey(b)))
    .map((key) => toCell(key))

  const hiddenStaffCells: ProfileAttrCell[] = Object.entries(mentalStaff)
    .map(([key, v]) => ({
      key,
      label: humanizeAttrKey(key),
      inGame: v.inGame,
      inGameUncapped: v.inGameUncapped,
      raw: v.raw,
      inMatch: v.inMatch,
      invert: false,
      highlightTier: tierForStaffAttr(key),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const hiddenSorted: ProfileAttrCell[] = [...hiddenPlayerCells, ...hiddenStaffCells]
    .filter((c) => c.key !== 'determination')
    .sort((a, b) => a.label.localeCompare(b.label))

  const hiddenColumns = splitIntoThreeColumns(hiddenSorted)

  const contract = row.contract
    ? {
        wage: row.contract.wage,
        clubId: row.contract.club_id,
        goalBonus: row.contract.goal_bonus,
        assistBonus: row.contract.assist_bonus,
        releaseFee: row.contract.release_fee,
        type: row.contract.contract_type,
        dateStarted: row.contract.date_started_iso,
        contractExpires: row.contract.contract_expires_iso,
        leavingOnBosman: row.contract.leaving_on_bosman > 0,
        minimumReleaseClause: row.contract.minimum_fee_rc > 0,
        nonPromotionClause: row.contract.non_promotion_rc > 0,
        nonPlayingClause: row.contract.non_playing_rc > 0,
        relegationClause: row.contract.relegation_rc > 0,
      }
    : null

  const nationDisplay =
    row.secondNation && row.secondNation.trim()
      ? `${row.nation} / ${row.secondNation}`
      : row.nation

  const cmScoutRoleSuitable = [0, 1, 2, 3, 4, 5, 6].map((i) => ratingPositionSuitable(i, p))

  return {
    name: row.name,
    nation: row.nation,
    secondNation: row.secondNation ?? '',
    nationDisplay,
    club: row.club,
    dobIso: s.dob_iso,
    euPassport: row.euPassport,
    positionLabel: formatNaturalPositions(p),
    highlightRolesLabel: formatHighlightRoles(rolesUsed),
    ca: p.current_ability,
    pa: p.potential_ability,
    cmScoutRatingBp: row.cmScoutRatingBp,
    cmScoutRolePercents: row.cmScoutRolePercents,
    cmScoutRoleSuitable,
    attrColumns,
    feetMorale,
    hiddenColumns,
    contract,
    seasonStats: buildProfileSeasonStats(row, clubNames, gameDateIso, dbContext),
  }
}
