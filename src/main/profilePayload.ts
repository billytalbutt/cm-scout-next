import {
  listedForLoan,
  ratingPositionSuitable,
  transferListedByClub,
  transferListedByRequest,
} from './cmScoutRating'
import type { ClubCompRecord } from './database/clubComp'
import {
  currentSeasonPerformanceFromRows,
  currentSeasonPerformanceFromSave,
  pickCurrentSeasonStaffHistoryAtClub,
} from './database/currentSeasonPerformance'
import type { StaffHistoryRecord } from './database/staffHistory'
import {
  buildCa18Display,
  CA18_KEYS,
  otherAttrDisplay,
  type AttrDisplayBlock,
  type Ca18Key,
} from './database/attributes'
import type {
  PlayerRecord,
  PlayerSavePerformanceStats,
  PlayerStatsPerCompetitionRow,
  StaffRecord,
  UiPlayerRow,
} from './database/types'
import { computeEffectivenessFull } from '../shared/effectivenessEngine'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'
import { formatNaturalPositions, humanizeAttrKey, splitIntoThreeColumns } from './profileLayout'
import { computeHighlightSets, footMoraleHighlightTier, formatHighlightRoles } from './positionHighlights'
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
  /** Whether `staff_history.dat` was present and row-aligned in this index (per-player rows may still be empty). */
  staffHistoryParsed: boolean
  staffHistorySourcePath?: string
  /** Archive includes `player stats.dat` (not decoded yet — assists / rating / per-competition splits). */
  playerStatsDatPresent?: boolean
  /** Structured grid V0 per-competition rows keyed by `player.dat` id. */
  savePerformancePerCompByPlayerDatId?: Map<number, PlayerStatsPerCompetitionRow[]>
  /** Summary decode from `player stats.dat` (Senior club totals). */
  savePerformanceByPlayerDatId?: Map<number, PlayerSavePerformanceStats>
}

function calendarYearFromGameIso(iso: string | null): number | null {
  if (!iso || iso.length < 4) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
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

function historyToSeasonRow(h: StaffHistoryRecord, clubNames: Map<number, string>) {
  const name = clubNames.get(h.clubId)?.trim()
  return {
    year: h.year,
    club: name && name.length > 0 ? name : h.clubId < 0 ? '—' : `#${h.clubId}`,
    onLoan: h.onLoan !== 0,
    apps: h.apps,
    goals: h.goals,
    assists: null as number | null,
    averageRating: null as number | null,
    tackles: null as number | null,
    passes: null as number | null,
    headers: null as number | null,
  }
}

function buildProfileSeasonStats(
  row: UiPlayerRow,
  clubNames: Map<number, string>,
  gameDateIso: string | null,
  ctx: ProfileDbContext,
) {
  const hist = row.staffHistory ?? []
  const clubIds = employerClubIdsForRow(row)
  const employerClubId = clubIds[0] ?? row.staff.club_job_id
  const alternateClubIds = clubIds.slice(1)
  const clubLabel =
    clubNames.get(employerClubId)?.trim() ||
    clubNames.get(row.staff.club_job_id)?.trim() ||
    `Club #${employerClubId}`

  const { rows: currentHist, pick: seasonPick } = pickCurrentSeasonStaffHistoryAtClub(
    hist,
    employerClubId,
    gameDateIso,
    ctx.nationSeasonUpdateDaySamples,
    alternateClubIds,
  )
  const saveCalendarYear = seasonPick.saveCalendarYear ?? calendarYearFromGameIso(gameDateIso)
  const highlightHistoryYear = seasonPick.highlightHistoryYear

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
  let cApps = 0
  let cGoals = 0
  for (const h of currentHist) {
    cApps += h.apps
    cGoals += h.goals
  }

  let currentSeasonPerformance = currentSeasonPerformanceFromRows(
    currentHist,
    employerClubId,
    clubLabel,
    alternateClubIds,
  )
  const currentAtEmployerClub =
    currentHist.length > 0 && currentHist.some((h) => clubIds.includes(h.clubId))

  const savePerf = ctx.savePerformanceByPlayerDatId?.get(row.player.id) ?? null
  const seasonYearForSave =
    highlightHistoryYear ?? saveCalendarYear ?? new Date().getFullYear()
  const fromSave =
    savePerf != null
      ? currentSeasonPerformanceFromSave(savePerf, clubLabel, employerClubId, seasonYearForSave)
      : null
  if (fromSave) {
    const saveHasAssists = fromSave.assists != null
    const preferSave =
      !currentSeasonPerformance ||
      !hist.length ||
      !currentAtEmployerClub ||
      saveHasAssists
    if (preferSave) currentSeasonPerformance = fromSave
  }
  const divCompId = ctx.clubDivisionCompIdByClubId.get(employerClubId)
  let inferredDomesticLeague: { competitionId: number; name: string } | null = null
  if (divCompId != null && divCompId !== 0 && ctx.clubCompsById) {
    const comp = ctx.clubCompsById.get(divCompId)
    const label = (comp?.name ?? '').trim() || (comp?.shortName ?? '').trim()
    if (label) inferredDomesticLeague = { competitionId: divCompId, name: label }
  }

  const playerStatsDatPresent = ctx.playerStatsDatPresent === true

  const savePerformanceHint = fromSave
    ? 'Current-season apps, goals, and assists from `player stats.dat` in this save (CM Senior club style). Average rating is not mapped yet.'
    : !ctx.staffHistoryParsed
      ? 'No staff_history.dat found. Load a .sav from your CM Game folder (e.g. …/Game/Game/) so Data/staff_history.dat is found, or ensure this save includes `player stats.dat`.'
      : !hist.length
        ? 'No career rows for this staff id in staff_history.dat and no summary row in `player stats.dat` for this player.'
        : currentSeasonPerformance && currentAtEmployerClub
          ? 'Apps and goals from staff history (league + cups combined). Assists and average rating are not in staff_history.dat.'
          : currentSeasonPerformance
            ? 'Best matching season-year from career history; no live save summary was decoded for this player.'
            : 'Career rows exist but none match the resolved current season year — check highlighted rows in the table below.'

  return {
    internationalCaps: { apps: row.staff.int_apps, goals: row.staff.int_goals },
    saveCalendarYear,
    highlightHistoryYear,
    currentYearResolution: seasonPick.resolution,
    boundaryDayOfYearUsed: seasonPick.boundaryDayOfYearUsed,
    currentSeasonRows: currentHist.map(toRow).sort((a, b) => a.club.localeCompare(b.club)),
    currentSeasonTotals: { apps: cApps, goals: cGoals },
    currentSeasonPerformance,
    careerTotals: { apps: careerApps, goals: careerGoals },
    allSeasons,
    inferredDomesticLeague,
    staffHistoryParsed: ctx.staffHistoryParsed,
    staffHistorySourcePath: ctx.staffHistorySourcePath,
    playerStatsDatPresent,
    savePerformanceHint,
    /** Wrong until player stats.dat layout is verified — do not surface in UI. */
    perCompetitionRows: ctx.savePerformancePerCompByPlayerDatId?.get(row.player.id) ?? [],
    perCompetitionStatsInSave: (ctx.savePerformancePerCompByPlayerDatId?.get(row.player.id)?.length ?? 0) > 0,
    saveFilePerformance: savePerf
      ? {
          apps: savePerf.apps,
          goals: savePerf.goals,
          assists: savePerf.assists,
          averageRating: savePerf.averageRating ?? null,
        }
      : null,
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

  const effFull = computeEffectivenessFull(
    effectivenessAttrGetter(p, s),
    eligibleEffectivenessArchetypeIds(p),
  )

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
    highlightRolesLabel: formatHighlightRoles(rolesUsed),
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
      : 'Eff % = recipe + vetted engine hiddens (profile 1–20), then brain mult where applicable, optional small profile-synergy when attribute relationships fit (e.g. hub CM), then consistency reliability (community heuristic, not decompiled). CM Scout % uses the full WeightsSet — different measure.',
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
  }
}
