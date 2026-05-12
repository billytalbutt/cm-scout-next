import type { PlayerRecord } from './database/types'

/**
 * Key / secondary attributes per CM0102 position role for profile highlighting.
 * Sources: champman0102.net “Key Attributes for each Position” (Churky / community summaries),
 * attribute-pair threads (marking+positioning, passing+creativity, pace+acceleration),
 * and CM Scout Intrinsic GK weight ordering cited on the same forum (Handling, One-on-ones, Reflexes…).
 * Staff highlights follow editor mental descriptions + forum emphasis on determination / ambition.
 */

export type PositionRoleId = 'GK' | 'SW' | 'D' | 'WB' | 'DM' | 'M' | 'AM' | 'ST'

const ROLE_FIELD: Record<PositionRoleId, keyof PlayerRecord> = {
  GK: 'goalkeeper',
  SW: 'sweeper',
  D: 'defender',
  WB: 'wing_back',
  DM: 'defensive_midfielder',
  M: 'midfielder',
  AM: 'attacking_midfielder',
  ST: 'attacker',
}

const ROLE_ORDER: PositionRoleId[] = ['GK', 'SW', 'D', 'WB', 'DM', 'M', 'AM', 'ST']

const SUIT_CUT = 14

type Pack = {
  playerPrimary: readonly string[]
  playerSecondary: readonly string[]
  staffPrimary: readonly string[]
  staffSecondary: readonly string[]
}

const BY_ROLE: Record<PositionRoleId, Pack> = {
  GK: {
    playerPrimary: ['handling', 'reflexes', 'one_on_ones', 'positioning', 'anticipation', 'agility'],
    playerSecondary: ['jumping', 'bravery', 'marking', 'heading', 'throw_ins', 'decisions', 'teamwork'],
    staffPrimary: ['determination', 'professionalism', 'pressure', 'ambition'],
    staffSecondary: ['adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  SW: {
    playerPrimary: ['positioning', 'tackling', 'marking', 'anticipation', 'heading', 'passing', 'decisions'],
    playerSecondary: ['pace', 'stamina', 'bravery', 'creativity', 'teamwork', 'work_rate', 'jumping', 'strength'],
    staffPrimary: ['determination', 'ambition', 'professionalism'],
    staffSecondary: ['pressure', 'adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  D: {
    playerPrimary: ['positioning', 'tackling', 'marking', 'heading', 'anticipation', 'strength', 'jumping', 'pace'],
    playerSecondary: ['aggression', 'bravery', 'teamwork', 'decisions', 'work_rate', 'passing', 'acceleration'],
    staffPrimary: ['determination', 'professionalism', 'ambition'],
    staffSecondary: ['pressure', 'temperament', 'sportsmanship', 'loyalty', 'adaptability'],
  },
  WB: {
    playerPrimary: ['crossing', 'pace', 'stamina', 'tackling', 'positioning', 'off_the_ball', 'work_rate', 'acceleration'],
    playerSecondary: ['marking', 'passing', 'decisions', 'teamwork', 'agility', 'dribbling', 'anticipation', 'balance'],
    staffPrimary: ['determination', 'ambition', 'professionalism'],
    staffSecondary: ['pressure', 'adaptability', 'loyalty', 'sportsmanship', 'temperament'],
  },
  DM: {
    playerPrimary: ['tackling', 'positioning', 'marking', 'passing', 'decisions', 'work_rate', 'stamina', 'teamwork', 'heading'],
    playerSecondary: ['anticipation', 'strength', 'aggression', 'long_shots', 'creativity', 'bravery', 'jumping'],
    staffPrimary: ['determination', 'professionalism', 'ambition'],
    staffSecondary: ['pressure', 'temperament', 'loyalty', 'adaptability', 'sportsmanship'],
  },
  M: {
    playerPrimary: ['passing', 'decisions', 'technique', 'teamwork', 'work_rate', 'creativity', 'off_the_ball', 'tackling'],
    playerSecondary: ['stamina', 'anticipation', 'long_shots', 'flair', 'positioning', 'dribbling', 'pace', 'balance'],
    staffPrimary: ['determination', 'ambition', 'professionalism'],
    staffSecondary: ['pressure', 'loyalty', 'adaptability', 'sportsmanship', 'temperament'],
  },
  AM: {
    playerPrimary: ['creativity', 'technique', 'dribbling', 'passing', 'decisions', 'flair', 'off_the_ball', 'long_shots'],
    playerSecondary: ['finishing', 'teamwork', 'work_rate', 'stamina', 'tackling', 'anticipation', 'pace', 'acceleration'],
    staffPrimary: ['determination', 'ambition', 'professionalism'],
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
    staffPrimary: ['determination', 'ambition', 'professionalism'],
    staffSecondary: ['pressure', 'loyalty', 'temperament', 'adaptability', 'sportsmanship'],
  },
}

/** Forum: big games, consistency, decisions, teamwork, fitness stack */
const UNIVERSAL_PLAYER_SECONDARY = [
  'important_matches',
  'consistency',
  'decisions',
  'teamwork',
  'natural_fitness',
] as const

export type HighlightSets = {
  playerPrimary: Set<string>
  playerSecondary: Set<string>
  staffPrimary: Set<string>
  staffSecondary: Set<string>
  rolesUsed: PositionRoleId[]
}

function bestFallbackRole(p: PlayerRecord): PositionRoleId {
  const order: PositionRoleId[] = ['ST', 'AM', 'M', 'DM', 'WB', 'D', 'SW', 'GK']
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
  const staffPrimary = new Set<string>()
  const staffSecondary = new Set<string>()

  for (const r of roles) {
    const pack = BY_ROLE[r]
    for (const x of pack.playerPrimary) playerPrimary.add(x)
    for (const x of pack.playerSecondary) playerSecondary.add(x)
    for (const x of pack.staffPrimary) staffPrimary.add(x)
    for (const x of pack.staffSecondary) staffSecondary.add(x)
  }

  for (const u of UNIVERSAL_PLAYER_SECONDARY) {
    if (!playerPrimary.has(u)) playerSecondary.add(u)
  }

  for (const x of playerPrimary) playerSecondary.delete(x)
  for (const x of staffPrimary) staffSecondary.delete(x)

  return { playerPrimary, playerSecondary, staffPrimary, staffSecondary, rolesUsed: roles }
}

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
