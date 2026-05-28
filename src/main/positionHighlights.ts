import type { PlayerRecord } from './database/types'
import { EFFECTIVENESS_ARCHETYPES } from '../shared/effectivenessEngine'

/**
 * Key / secondary attributes per CM0102 position role for profile highlighting.
 * Sources: champman0102.net “Key Attributes for each Position” (Churky / community summaries),
 * attribute-pair threads (marking+positioning, passing+creativity, pace+acceleration),
 * and CM Scout Intrinsic GK weight ordering cited on the same forum (Handling, One-on-ones, Reflexes…).
 * Staff highlights follow editor mental descriptions + forum emphasis on ambition / professionalism.
 */

export type PositionRoleId = 'GK' | 'SW' | 'D' | 'WB' | 'DM' | 'M' | 'AMC' | 'AMW' | 'ST'

const ROLE_FIELD: Record<PositionRoleId, keyof PlayerRecord> = {
  GK: 'goalkeeper',
  SW: 'sweeper',
  D: 'defender',
  WB: 'wing_back',
  DM: 'defensive_midfielder',
  M: 'midfielder',
  AMC: 'attacking_midfielder',
  AMW: 'attacking_midfielder',
  ST: 'attacker',
}

const ROLE_ORDER: PositionRoleId[] = ['GK', 'SW', 'D', 'WB', 'DM', 'M', 'AMC', 'AMW', 'ST']

const SUIT_CUT = 14

type Pack = {
  playerPrimary: readonly string[]
  playerSecondary: readonly string[]
  /** Forum “must-have” lore — shown as coloured labels when not a recipe primary. */
  playerForumBreaker: readonly string[]
  staffPrimary: readonly string[]
  staffSecondary: readonly string[]
}

/** Forum engine-breaker lore per role (may differ from Eff % recipe primaries). */
const FORUM_BREAKERS_BY_ROLE: Record<PositionRoleId, readonly string[]> = {
  GK: ['handling', 'reflexes', 'one_on_ones'],
  SW: ['positioning', 'anticipation', 'tackling'],
  D: ['marking', 'positioning', 'tackling'],
  WB: ['pace', 'acceleration', 'crossing'],
  DM: ['tackling', 'positioning', 'marking'],
  M: ['technique', 'decisions', 'teamwork'],
  AMC: ['technique', 'passing', 'off_the_ball'],
  AMW: ['pace', 'acceleration', 'dribbling'],
  ST: ['finishing', 'off_the_ball', 'pace', 'anticipation'],
}

/** @deprecated Use {@link FORUM_BREAKERS_BY_ROLE}. */
export const ENGINE_BREAKERS_BY_ROLE = FORUM_BREAKERS_BY_ROLE

const BY_ROLE: Record<PositionRoleId, Pack> = {
  GK: {
    playerPrimary: ['handling', 'reflexes', 'one_on_ones', 'positioning', 'anticipation', 'agility'],
    playerSecondary: ['jumping', 'bravery', 'marking', 'heading', 'throw_ins', 'decisions', 'teamwork'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.GK,
    staffPrimary: ['professionalism', 'pressure', 'ambition'],
    staffSecondary: ['adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  SW: {
    playerPrimary: ['positioning', 'tackling', 'marking', 'anticipation', 'heading', 'passing', 'decisions'],
    playerSecondary: ['pace', 'stamina', 'bravery', 'creativity', 'teamwork', 'work_rate', 'jumping', 'strength'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.SW,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  D: {
    playerPrimary: ['positioning', 'tackling', 'marking', 'heading', 'anticipation', 'strength', 'jumping', 'pace'],
    playerSecondary: ['aggression', 'bravery', 'teamwork', 'decisions', 'work_rate', 'passing', 'acceleration'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.D,
    staffPrimary: ['professionalism', 'ambition'],
    staffSecondary: ['pressure', 'temperament', 'sportsmanship', 'loyalty', 'adaptability'],
  },
  WB: {
    playerPrimary: ['crossing', 'pace', 'stamina', 'tackling', 'positioning', 'off_the_ball', 'work_rate', 'acceleration'],
    playerSecondary: ['marking', 'passing', 'decisions', 'teamwork', 'agility', 'dribbling', 'anticipation', 'balance'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.WB,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  DM: {
    playerPrimary: ['tackling', 'positioning', 'marking', 'passing', 'decisions', 'work_rate', 'stamina', 'teamwork', 'heading'],
    playerSecondary: ['anticipation', 'strength', 'aggression', 'long_shots', 'creativity', 'bravery', 'jumping'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.DM,
    staffPrimary: ['professionalism', 'ambition'],
    staffSecondary: ['pressure', 'temperament', 'loyalty', 'adaptability', 'sportsmanship'],
  },
  M: {
    playerPrimary: ['technique', 'decisions', 'teamwork', 'passing', 'anticipation', 'stamina', 'work_rate', 'creativity'],
    playerSecondary: ['off_the_ball', 'long_shots', 'flair', 'positioning', 'dribbling', 'pace', 'balance', 'tackling'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.M,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'loyalty', 'adaptability', 'sportsmanship', 'temperament'],
  },
  AMC: {
    playerPrimary: ['technique', 'decisions', 'passing', 'creativity', 'off_the_ball', 'anticipation', 'flair'],
    playerSecondary: ['dribbling', 'finishing', 'teamwork', 'work_rate', 'stamina', 'long_shots', 'pace', 'acceleration', 'balance'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.AMC,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'temperament', 'loyalty', 'adaptability', 'sportsmanship'],
  },
  AMW: {
    playerPrimary: ['pace', 'acceleration', 'dribbling', 'crossing', 'off_the_ball', 'flair', 'technique'],
    playerSecondary: ['creativity', 'passing', 'decisions', 'stamina', 'work_rate', 'finishing', 'anticipation', 'balance'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.AMW,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'temperament', 'loyalty', 'adaptability', 'sportsmanship'],
  },
  ST: {
    playerPrimary: [
      'finishing',
      'off_the_ball',
      'pace',
      'acceleration',
      'anticipation',
      'technique',
      'dribbling',
      'flair',
      'heading',
    ],
    playerSecondary: ['long_shots', 'creativity', 'balance', 'jumping', 'strength', 'work_rate', 'decisions', 'teamwork'],
    playerForumBreaker: FORUM_BREAKERS_BY_ROLE.ST,
    staffPrimary: ['ambition', 'professionalism'],
    staffSecondary: ['pressure', 'loyalty', 'temperament', 'adaptability', 'sportsmanship'],
  },
}

/** Forum: big games, consistency, decisions, teamwork, fitness stack; determination is a visible player attr in CM. */
const UNIVERSAL_PLAYER_SECONDARY = [
  'important_matches',
  'consistency',
  'decisions',
  'teamwork',
  'natural_fitness',
  'determination',
] as const

/**
 * Hidden-panel bankers for every player — Eff % engine block + champman0102 hidden-attribute threads.
 */
export const UNIVERSAL_HIDDEN_ENGINE_BREAKERS = [
  'important_matches',
  'consistency',
  'natural_fitness',
  'injury_proneness',
] as const

/** Staff mentals in the hidden panel that gate long-term output (forum + Eff % engine extras). */
export const UNIVERSAL_STAFF_HIDDEN_ENGINE_BREAKERS = ['professionalism', 'pressure'] as const

export type HighlightSets = {
  playerPrimary: Set<string>
  playerSecondary: Set<string>
  /** Amber ring — Eff % recipe primaries (×5 weight). */
  playerEngineBreaker: Set<string>
  /** Coloured label — forum lore attrs not already a recipe primary. */
  playerRecipeAccent: Set<string>
  staffPrimary: Set<string>
  staffSecondary: Set<string>
  rolesUsed: PositionRoleId[]
}

const ARCHETYPE_TO_ROLE: Record<string, PositionRoleId> = {
  gk: 'GK',
  dc: 'D',
  wb: 'WB',
  dmc: 'DM',
  mc: 'M',
  amc: 'AMC',
  amw: 'AMW',
  st: 'ST',
}

const ROLE_TO_DEFAULT_ARCHETYPE: Record<PositionRoleId, string> = {
  GK: 'gk',
  SW: 'dc',
  D: 'dc',
  WB: 'wb',
  DM: 'dmc',
  M: 'mc',
  AMC: 'amc',
  AMW: 'amw',
  ST: 'st',
}

export function roleFromEffectivenessArchetypeId(archetypeId: string): PositionRoleId {
  return ARCHETYPE_TO_ROLE[archetypeId.toLowerCase()] ?? 'M'
}

function mergeRolePack(role: PositionRoleId): Omit<HighlightSets, 'playerEngineBreaker' | 'playerRecipeAccent'> {
  const pack = BY_ROLE[role]
  const playerPrimary = new Set<string>(pack.playerPrimary)
  const playerSecondary = new Set<string>(pack.playerSecondary)
  const staffPrimary = new Set<string>(pack.staffPrimary)
  const staffSecondary = new Set<string>(pack.staffSecondary)

  for (const u of UNIVERSAL_PLAYER_SECONDARY) {
    if (!playerPrimary.has(u)) playerSecondary.add(u)
  }
  for (const x of playerPrimary) playerSecondary.delete(x)
  for (const x of staffPrimary) staffSecondary.delete(x)

  return { playerPrimary, playerSecondary, staffPrimary, staffSecondary, rolesUsed: [role] }
}

function applyRecipeHighlightLogic(role: PositionRoleId, archetypeId: string): HighlightSets {
  const base = mergeRolePack(role)
  const arch = EFFECTIVENESS_ARCHETYPES.find((a) => a.id === archetypeId)
  const forumBreakers = BY_ROLE[role].playerForumBreaker

  const playerEngineBreaker = new Set<string>()
  for (const k of arch?.primary ?? forumBreakers) playerEngineBreaker.add(k)
  for (const x of UNIVERSAL_HIDDEN_ENGINE_BREAKERS) playerEngineBreaker.add(x)
  for (const x of UNIVERSAL_STAFF_HIDDEN_ENGINE_BREAKERS) playerEngineBreaker.add(x)

  const playerRecipeAccent = new Set<string>()
  for (const k of forumBreakers) {
    if (!playerEngineBreaker.has(k)) playerRecipeAccent.add(k)
  }

  return { ...base, playerEngineBreaker, playerRecipeAccent }
}

/** Highlights aligned to a specific Eff % recipe (rings = primaries, accent labels = forum lore). */
export function computeHighlightSetsForArchetype(archetypeId: string): HighlightSets {
  const role = roleFromEffectivenessArchetypeId(archetypeId)
  return applyRecipeHighlightLogic(role, archetypeId)
}

function bestFallbackRole(p: PlayerRecord): PositionRoleId {
  const order: PositionRoleId[] = ['ST', 'AMC', 'AMW', 'M', 'DM', 'WB', 'D', 'SW', 'GK']
  let best: PositionRoleId = 'M'
  let bestV = -1
  for (const id of order) {
    const v = p[ROLE_FIELD[id]] as number
    if (v > bestV) {
      bestV = v
      best = id
    }
  }
  return best
}

export function naturalRolesForHighlight(p: PlayerRecord): PositionRoleId[] {
  const raw: PositionRoleId[] = []
  for (const id of ROLE_ORDER) {
    if ((p[ROLE_FIELD[id]] as number) > SUIT_CUT) raw.push(id)
  }
  if (raw.length) return raw
  return [bestFallbackRole(p)]
}

function mergePacks(roles: PositionRoleId[]): HighlightSets {
  const playerPrimary = new Set<string>()
  const playerSecondary = new Set<string>()
  const playerEngineBreaker = new Set<string>()
  const playerRecipeAccent = new Set<string>()
  const staffPrimary = new Set<string>()
  const staffSecondary = new Set<string>()

  for (const r of roles) {
    const sets = computeHighlightSetsForArchetype(ROLE_TO_DEFAULT_ARCHETYPE[r])
    for (const x of sets.playerPrimary) playerPrimary.add(x)
    for (const x of sets.playerSecondary) playerSecondary.add(x)
    for (const x of sets.playerEngineBreaker) playerEngineBreaker.add(x)
    for (const x of sets.playerRecipeAccent) playerRecipeAccent.add(x)
    for (const x of sets.staffPrimary) staffPrimary.add(x)
    for (const x of sets.staffSecondary) staffSecondary.add(x)
  }

  return {
    playerPrimary,
    playerSecondary,
    playerEngineBreaker,
    playerRecipeAccent,
    staffPrimary,
    staffSecondary,
    rolesUsed: roles,
  }
}

/** CM Scout `WeightsSet` column index → profile highlight role (8-field ladder uses ST for “A”). */
const CM_SCOUT_INDEX_TO_ROLE: Record<number, PositionRoleId> = {
  0: 'GK',
  1: 'D',
  2: 'DM',
  3: 'M',
  4: 'AMC',
  5: 'ST',
  6: 'WB',
}

/** CM Scout role column → default Eff archetype id for highlight packs. */
export const CM_SCOUT_INDEX_TO_ARCHETYPE: Record<number, string> = {
  0: 'gk',
  1: 'dc',
  2: 'dmc',
  3: 'mc',
  4: 'amc',
  5: 'st',
  6: 'wb',
}

export function positionRoleFromCmScoutIndex(index: number): PositionRoleId {
  return CM_SCOUT_INDEX_TO_ROLE[index] ?? 'M'
}

export function defaultArchetypeFromCmScoutIndex(index: number): string {
  return CM_SCOUT_INDEX_TO_ARCHETYPE[index] ?? 'mc'
}

/** Highlights for a single role only (not merged across all natural positions). */
export function computeHighlightSetsForRole(role: PositionRoleId): HighlightSets {
  return computeHighlightSetsForArchetype(ROLE_TO_DEFAULT_ARCHETYPE[role])
}

/**
 * Role column for attribute rings: best CM Scout % among suitable roles, else best overall.
 * Aligns with grid BP (suitable naturals first).
 */
export function pickBestCmScoutRoleIndex(
  percents: readonly number[],
  suitable?: readonly boolean[],
): number {
  let bestIdx = 0
  let bestVal = -1
  const consider = (i: number) => {
    const v = percents[i]
    if (v == null || !Number.isFinite(v)) return
    if (v > bestVal) {
      bestVal = v
      bestIdx = i
    }
  }
  let anySuit = false
  if (suitable && suitable.length === percents.length) {
    for (let i = 0; i < percents.length; i++) {
      if (suitable[i]) {
        anySuit = true
        consider(i)
      }
    }
  }
  if (!anySuit) {
    for (let i = 0; i < percents.length; i++) consider(i)
  }
  return bestIdx
}

/** @deprecated Prefer {@link computeHighlightSetsForArchetype} for profiles. */
export function computeHighlightSets(p: PlayerRecord): HighlightSets {
  return mergePacks(naturalRolesForHighlight(p))
}

export function footMoraleHighlightTier(
  key: 'left_foot' | 'right_foot' | 'morale',
  roles: PositionRoleId[],
): 'primary' | 'secondary' | undefined {
  if (key === 'morale') return 'secondary'
  const onlyGk = roles.length === 1 && roles[0] === 'GK'
  if (onlyGk) return undefined
  if (key === 'left_foot' || key === 'right_foot') return 'secondary'
  return undefined
}

export function formatHighlightRoles(roles: PositionRoleId[]): string {
  return roles.join(', ')
}
