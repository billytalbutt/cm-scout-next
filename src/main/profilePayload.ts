import {
  listedForLoan,
  ratingPositionSuitable,
  transferListedByClub,
  transferListedByRequest,
} from './cmScoutRating'
import { contractTypeLabel } from '../shared/contractTypes'
import type { ClubCompRecord, StaffCompRecord } from './database/clubComp'
import type { CurrentSeasonPerformance } from './database/currentSeasonPerformance'
import type { PlayerCurrentSeasonIndexed } from './database/playerStatsCurrentSeason'
import { resolveStaffHistoryHighlightYear } from './database/seasonYear'
import {
  buildCa18Display,
  CA18_KEYS,
  otherAttrDisplay,
  type AttrDisplayBlock,
  type Ca18Key,
} from './database/attributes'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'
import { computeEffectivenessFull, computePlayerRiskFlags, EFFECTIVENESS_ARCHETYPES } from '../shared/effectivenessEngine'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'
import { formatNaturalPositions, humanizeAttrKey, splitIntoThreeColumns } from './profileLayout'
import { CM_SCOUT_ROLE_SHORT } from '../shared/cmScoutRoles'
import {
  computeHighlightSetsForArchetype,
  defaultArchetypeFromCmScoutIndex,
  footMoraleHighlightTier,
  pickBestCmScoutRoleIndex,
  roleFromEffectivenessArchetypeId,
  type HighlightSets,
  type PositionRoleId,
} from './positionHighlights'
import { cmScoutIndexFromEffectivenessArchetypeId } from '../shared/profileHighlightRole'
import { ENGINE_META_PROFILE_LABELS, type EngineMetaProfileId } from '../shared/engineMetaProfileCatalog'
import { computeFreeRoleHint, computeTacticalInstructionHints } from './playerTacticalHints'

/**
 * Main profile — CM0102 three-column stack (12 / 12 / 7). `free_kicks` is the on-disk “Set pieces” byte.
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
    'off_the_ball',
    'pace',
    'passing',
    'positioning',
    'reflexes',
  ],
  ['free_kicks', 'stamina', 'strength', 'tackling', 'teamwork', 'technique', 'work_rate'],
] as const

/** Hidden panel: CM second-screen style order (player + staff mentals), then split into three columns. */
const HIDDEN_DISPLAY_ORDER = [
  'adaptability',
  'ambition',
  'consistency',
  'corners',
  'dirtiness',
  'important_matches',
  'injury_proneness',
  'loyalty',
  'natural_fitness',
  'one_on_ones',
  'penalties',
  'pressure',
  'professionalism',
  'sportsmanship',
  'temperament',
  'throw_ins',
  'versatility',
] as const

const STAFF_ATTR_IN_PROFILE: Record<string, keyof StaffRecord> = {
  adaptability: 'adaptability',
  ambition: 'ambition',
  loyalty: 'loyalty',
  pressure: 'pressure',
  professionalism: 'professionalism',
  sportsmanship: 'sportsmanship',
  temperament: 'temperament',
}

const STAFF_ATTR_KEY_SET = new Set(Object.keys(STAFF_ATTR_IN_PROFILE))

function attrCellLabel(key: string): string {
  if (key === 'free_kicks') return 'Set pieces'
  return humanizeAttrKey(key)
}

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
  const sk = STAFF_ATTR_IN_PROFILE[key]
  if (sk != null) {
    other[key] = otherAttrDisplay(s[sk] as number)
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
  highlightEngine?: boolean
  /** Forum / community key attr — blue label on main or hidden panel (may overlap amber rings). */
  highlightRecipeAccent?: boolean
}

/** Serialized highlight pack per CM Scout role column (renderer applies on role click). */
export type ProfileHighlightPack = {
  archetypeId: string
  roleCmScoutIndex: number
  roleLabel: string
  playerPrimary: string[]
  playerSecondary: string[]
  playerEngineBreaker: string[]
  playerRecipeAccent: string[]
  staffPrimary: string[]
  staffSecondary: string[]
}

function archetypeHighlightLabel(archetypeId: string): string {
  const arch = EFFECTIVENESS_ARCHETYPES.find((a) => a.id === archetypeId)
  return arch?.label ?? archetypeId.toUpperCase()
}

function serializeHighlightPack(archetypeId: string, roleCmScoutIndex: number, sets: HighlightSets): ProfileHighlightPack {
  return {
    archetypeId,
    roleCmScoutIndex,
    roleLabel: archetypeHighlightLabel(archetypeId),
    playerPrimary: [...sets.playerPrimary],
    playerSecondary: [...sets.playerSecondary],
    playerEngineBreaker: [...sets.playerEngineBreaker],
    playerRecipeAccent: [...sets.playerRecipeAccent],
    staffPrimary: [...sets.staffPrimary],
    staffSecondary: [...sets.staffSecondary],
  }
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
  staffCompsById?: Map<number, StaffCompRecord>
  clubDivisionCompIdByClubId: Map<number, number>
  /** Whether `staff_history.dat` was present and row-aligned in this index (per-player rows may still be empty). */
  staffHistoryParsed: boolean
  staffHistorySourcePath?: string
  /** Archive includes `player stats.dat` (not decoded yet — assists / rating / per-competition splits). */
  playerStatsDatPresent?: boolean
  /** Structured grid V0 per-competition rows keyed by `player.dat` id. */
  savePerformancePerCompByPlayerDatId?: Map<number, PlayerStatsPerCompetitionRow[]>
  /** Summary decode from `player stats.dat` (Senior club totals). */
  savePerformanceByPlayerDatId?: Map<number, PlayerSavePerformanceStats>
  /** Pre-built at load — never scan `player stats history.tmp` when opening a profile. */
  currentSeasonByPlayerDatId?: Map<number, PlayerCurrentSeasonIndexed>
}

/** `staff.club_job_id` and `contract.club_id` can differ on some saves. */
function employerClubIdsForRow(row: UiPlayerRow): number[] {
  const ids: number[] = []
  const add = (id: number) => {
    if (id > 0 && !ids.includes(id)) ids.push(id)
  }
  add(row.staff.club_job_id)
  if (row.contract?.club_id != null) add(row.contract.club_id)
  return ids
}

function formatSeasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** Senior club combined totals for profile (CM “Senior club” row — not scope sums). */
function seniorTotalsFromIndex(
  cm: PlayerCurrentSeasonIndexed,
  savePerf?: { apps: number | null; goals?: number | null; assists?: number | null; averageRating?: number | null } | null,
): {
  apps: number
  goals: number
  assists: number
  averageRating: number | null
} {
  if (cm.seniorApps > 0 || cm.seniorGoals > 0 || cm.seniorAssists > 0 || cm.seniorAvgRating != null) {
    return {
      apps: cm.seniorApps,
      goals: cm.seniorGoals,
      assists: cm.seniorAssists,
      averageRating: cm.seniorAvgRating ?? savePerf?.averageRating ?? null,
    }
  }
  if (savePerf?.apps != null && (savePerf.apps > 0 || (savePerf.goals ?? 0) > 0 || (savePerf.assists ?? 0) > 0)) {
    return {
      apps: savePerf.apps,
      goals: savePerf.goals ?? 0,
      assists: savePerf.assists ?? 0,
      averageRating: savePerf.averageRating ?? null,
    }
  }
  return { apps: 0, goals: 0, assists: 0, averageRating: savePerf?.averageRating ?? null }
}

function buildProfileSeasonStats(
  row: UiPlayerRow,
  clubNames: Map<number, string>,
  gameDateIso: string | null,
  ctx: ProfileDbContext,
) {
  const clubIds = employerClubIdsForRow(row)
  const employerClubId = clubIds[0] ?? row.staff.club_job_id
  const clubLabel =
    clubNames.get(employerClubId)?.trim() ||
    clubNames.get(row.staff.club_job_id)?.trim() ||
    row.club.trim() ||
    `Club #${employerClubId}`

  const yearPick = resolveStaffHistoryHighlightYear(gameDateIso, ctx.nationSeasonUpdateDaySamples)
  const seasonStart = yearPick.highlightHistoryYear ?? yearPick.saveCalendarYear
  const cmHistorySeasonLabel = seasonStart != null ? formatSeasonLabel(seasonStart) : null

  const indexedSeason = row.cmSeason ?? ctx.currentSeasonByPlayerDatId?.get(row.player.id) ?? null
  const savePerf =
    row.savePerformance ?? ctx.savePerformanceByPlayerDatId?.get(row.player.id) ?? null
  const playerStatsDatPresent = ctx.playerStatsDatPresent === true

  let currentSeasonPerformance: CurrentSeasonPerformance | null = null
  if (seasonStart != null) {
    if (indexedSeason?.available || savePerf?.apps != null) {
      const totals = seniorTotalsFromIndex(indexedSeason ?? {
        scopes: [],
        seniorApps: 0,
        seniorGoals: 0,
        seniorAssists: 0,
        seniorAvgRating: null,
        leagueApps: 0,
        leagueGoals: 0,
        leagueAssists: 0,
        cupApps: 0,
        cupGoals: 0,
        cupAssists: 0,
        continentalApps: 0,
        continentalGoals: 0,
        continentalAssists: 0,
        internationalApps: 0,
        internationalGoals: 0,
        internationalAssists: 0,
        byCompetition: [],
        available: false,
      }, savePerf)
      currentSeasonPerformance = {
        label: clubLabel,
        apps: totals.apps,
        goals: totals.goals,
        assists: totals.assists,
        averageRating: totals.averageRating,
        historyYear: seasonStart,
        clubId: employerClubId,
        source: 'player_stats_dat',
      }
    } else {
      currentSeasonPerformance = {
        label: clubLabel,
        apps: 0,
        goals: 0,
        assists: null,
        averageRating: null,
        historyYear: seasonStart,
        clubId: employerClubId,
        source: 'player_stats_dat',
      }
    }
  }

  const savePerformanceHint = !playerStatsDatPresent
    ? 'This save has no player stats blocks — reload an uncompressed save that includes `player stats.dat` and `player stats history.tmp`.'
    : !indexedSeason?.available && savePerf?.apps == null
      ? 'No current-season stats were decoded for this player in this save.'
      : undefined

  return {
    internationalCaps: { apps: row.staff.int_apps, goals: row.staff.int_goals },
    saveCalendarYear: yearPick.saveCalendarYear,
    highlightHistoryYear: yearPick.highlightHistoryYear,
    currentYearResolution: yearPick.resolution,
    boundaryDayOfYearUsed: yearPick.boundaryDayOfYearUsed,
    currentSeasonRows: [],
    currentSeasonTotals: {
      apps: currentSeasonPerformance?.apps ?? 0,
      goals: currentSeasonPerformance?.goals ?? 0,
    },
    currentSeasonPerformance,
    careerTotals: { apps: row.careerAppsTotal, goals: row.careerGoalsTotal },
    careerAssists: null as number | null,
    careerAvgRating: null as number | null,
    allSeasons: [],
    inferredDomesticLeague: null,
    staffHistoryParsed: ctx.staffHistoryParsed,
    staffHistorySourcePath: ctx.staffHistorySourcePath,
    playerStatsDatPresent,
    savePerformanceHint,
    perCompetitionRows: [],
    perCompetitionTotals: null,
    perCompetitionStatsInSave: false,
    saveFilePerformance: null,
    cmHistoryScopes: [],
    cmHistoryAvailable: false,
    cmHistorySeasonLabel,
    cmCompetitionRows: [],
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
  for (const k of HIDDEN_DISPLAY_ORDER) putProfileAttrIntoOther(k, p, s, ca18, other)

  const cmScoutRoleSuitable = [0, 1, 2, 3, 4, 5, 6].map((i) => ratingPositionSuitable(i, p))
  const rolePercents = row.cmScoutRolePercents ?? []
  const effGet = effectivenessAttrGetter(p, s)
  const effFull = computeEffectivenessFull(effGet, eligibleEffectivenessArchetypeIds(p))
  const riskFlags = computePlayerRiskFlags(effGet)

  let defaultHighlightRoleCmScoutIndex = pickBestCmScoutRoleIndex(rolePercents, cmScoutRoleSuitable)
  let defaultHighlightArchetypeId = defaultArchetypeFromCmScoutIndex(defaultHighlightRoleCmScoutIndex)
  if (effFull.effArchetypeId && effFull.effArchetypeId !== 'unsure') {
    defaultHighlightArchetypeId = effFull.effArchetypeId
    const fromEff = cmScoutIndexFromEffectivenessArchetypeId(effFull.effArchetypeId)
    if (fromEff != null) defaultHighlightRoleCmScoutIndex = fromEff
  }
  const highlightPacksByArchetypeId: Record<string, ProfileHighlightPack> = {}
  for (const a of EFFECTIVENESS_ARCHETYPES) {
    highlightPacksByArchetypeId[a.id] = serializeHighlightPack(
      a.id,
      cmScoutIndexFromEffectivenessArchetypeId(a.id) ?? defaultHighlightRoleCmScoutIndex,
      computeHighlightSetsForArchetype(a.id),
    )
  }
  const highlightPacksByCmScoutIndex = [0, 1, 2, 3, 4, 5, 6].map((idx) => {
    const archetypeId = defaultArchetypeFromCmScoutIndex(idx)
    return highlightPacksByArchetypeId[archetypeId]!
  })
  const hl = computeHighlightSetsForArchetype(defaultHighlightArchetypeId)
  const rolesUsed: PositionRoleId[] = [roleFromEffectivenessArchetypeId(defaultHighlightArchetypeId)]

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
    const label = attrCellLabel(key)
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
        highlightEngine: hl.playerEngineBreaker.has(key),
        highlightRecipeAccent: hl.playerRecipeAccent.has(key),
      }
    }
    const x = other[key]!
    const inv = key === 'injury_proneness' || key === 'dirtiness'
    const highlightTier = STAFF_ATTR_KEY_SET.has(key)
      ? tierForStaffAttr(key)
      : key === 'determination'
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
      highlightEngine: hl.playerEngineBreaker.has(key),
      highlightRecipeAccent: hl.playerRecipeAccent.has(key),
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

  const hiddenKeysSplit = splitIntoThreeColumns([...HIDDEN_DISPLAY_ORDER])
  const hiddenColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]] = [
    hiddenKeysSplit[0].map(toCell),
    hiddenKeysSplit[1].map(toCell),
    hiddenKeysSplit[2].map(toCell),
  ]

  const contract = row.contract
    ? {
        wage: row.contract.wage,
        clubId: row.contract.club_id,
        goalBonus: row.contract.goal_bonus,
        assistBonus: row.contract.assist_bonus,
        releaseFee: row.contract.release_fee,
        type: row.contract.contract_type,
        typeLabel: contractTypeLabel(row.contract.contract_type),
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

  const c = row.contract
  const transferStatus = c?.transfer_status ?? 0
  const arrangedClubId = c != null && c.transfer_arranged_for > 0 ? c.transfer_arranged_for : null
  const arrangedClubLabel =
    arrangedClubId != null
      ? (() => {
          const nm = clubNames.get(arrangedClubId)?.trim()
          return nm && nm.length > 0 ? nm : `Club #${arrangedClubId}`
        })()
      : null

  const engineMetaProfiles =
    row.engineMetaProfileIds?.map((id) => ({
      id,
      label: ENGINE_META_PROFILE_LABELS[id as EngineMetaProfileId] ?? id,
    })) ?? []

  const freeRoleHint = computeFreeRoleHint(p, s)
  const tacticalInstructionHints = computeTacticalInstructionHints(p, s)
  return {
    name: row.name,
    nation: row.nation,
    secondNation: row.secondNation ?? '',
    nationDisplay,
    club: row.club,
    age: row.age,
    dobIso: s.dob_iso,
    euPassport: row.euPassport,
    positionLabel: formatNaturalPositions(p),
    highlightRolesLabel: archetypeHighlightLabel(defaultHighlightArchetypeId),
    defaultHighlightRoleCmScoutIndex,
    defaultHighlightArchetypeId,
    highlightPacksByArchetypeId,
    highlightPacksByCmScoutIndex,
    reputation: {
      home: p.home_reputation,
      current: p.current_reputation,
      world: p.world_reputation,
    },
    ca: p.current_ability,
    pa: p.potential_ability,
    cmScoutRatingBp: row.cmScoutRatingBp,
    effPercent: effFull.effPercent,
    effArchetype: effFull.effArchetype,
    effArchetypeId: effFull.effArchetypeId,
    injuryRisk: riskFlags.injuryRisk,
    disciplineRisk: riskFlags.disciplineRisk,
    lowConsistencyRisk: riskFlags.lowConsistency,
    effByArchetype: effFull.byArchetype,
    effWinnerDetail: effFull.winnerDetail ?? undefined,
    effRunnerUp: effFull.runnerUp,
    effRelaxedNaturalGate: effFull.relaxedNaturalGate,
    eliteEngineBadgeKind: row.eliteEngineBadgeKind,
    eliteEngineBadgeTitle: row.eliteEngineBadgeTitle,
    eliteEngineBadgeDetail: row.eliteEngineBadgeDetail,
    engineMetaProfiles,
    freeRoleHint,
    tacticalInstructionHints,
    effRatingDisclaimer: effFull.relaxedNaturalGate
      ? undefined
      : 'Eff % = recipe + vetted engine hiddens using uncapped engine display where the profile shows values above 20 (bracketed), then brain mult where applicable, optional small profile-synergy when attribute relationships fit (e.g. hub CM), then consistency reliability (community heuristic, not decompiled). CM Scout % uses the full WeightsSet — different measure.',
    cmScoutRolePercents: row.cmScoutRolePercents,
    cmScoutRoleSuitable,
    transfer: {
      value: row.value,
      listedByClub: transferListedByClub(transferStatus),
      listedByRequest: transferListedByRequest(transferStatus),
      listedForLoan: listedForLoan(transferStatus),
      futureTransferToClubId: arrangedClubId,
      futureTransferToClubName: arrangedClubLabel,
    },
    attrColumns,
    feetMorale,
    hiddenColumns,
    contract,
    seasonStats: buildProfileSeasonStats(row, clubNames, gameDateIso, dbContext),
    regen: row.isRegenLikely
      ? {
          isLikely: true,
          ofName: row.regenOfName,
          ofStaffIndex: row.regenOfStaffIndex,
          source: row.regenDetectionSource ?? null,
        }
      : undefined,
  }
}
