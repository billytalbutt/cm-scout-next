import type { PlayerRecord } from '../main/database/types'

/** Natural-position threshold (same as profile / CM Scout suitability display). */
export const POSITION_NATURAL_MIN = 14

export type PositionRoleFilterId =
  | 'goalkeeper'
  | 'defender'
  | 'midfielder'
  | 'attacker'
  | 'sweeper'
  | 'defensive_midfielder'
  | 'attacking_midfielder'
  | 'wing_back'
  | 'free_role'

export type PositionSideFilterId = 'left_side' | 'centre_side' | 'right_side'

export type PositionFilterOption = {
  id: PositionRoleFilterId | PositionSideFilterId
  label: string
}

/** CM Scout–style role rows (main line + niche). */
export const POSITION_ROLE_FILTER_MAIN: readonly PositionFilterOption[] = [
  { id: 'goalkeeper', label: 'Goalkeeper' },
  { id: 'defender', label: 'Defender' },
  { id: 'midfielder', label: 'Midfielder' },
  { id: 'attacker', label: 'Attacker' },
]

export const POSITION_ROLE_FILTER_NICHE: readonly PositionFilterOption[] = [
  { id: 'sweeper', label: 'Sweeper' },
  { id: 'defensive_midfielder', label: 'Defensive Midfielder' },
  { id: 'attacking_midfielder', label: 'Attacking Midfielder' },
  { id: 'wing_back', label: 'Wingback' },
  { id: 'free_role', label: 'Free Role' },
]

export const POSITION_SIDE_FILTER_OPTIONS: readonly PositionFilterOption[] = [
  { id: 'left_side', label: 'Left side' },
  { id: 'centre_side', label: 'Central' },
  { id: 'right_side', label: 'Right side' },
]

const ROLE_FIELDS: Record<PositionRoleFilterId, keyof PlayerRecord> = {
  goalkeeper: 'goalkeeper',
  defender: 'defender',
  midfielder: 'midfielder',
  attacker: 'attacker',
  sweeper: 'sweeper',
  defensive_midfielder: 'defensive_midfielder',
  attacking_midfielder: 'attacking_midfielder',
  wing_back: 'wing_back',
  free_role: 'free_role',
}

function isNatural(p: PlayerRecord, key: keyof PlayerRecord): boolean {
  const v = p[key]
  return typeof v === 'number' && v > POSITION_NATURAL_MIN
}

/** Every selected role and side must be natural (AND). Empty selection = no position filter. */
export function passesPlayerPositionFilter(
  p: PlayerRecord,
  roles: readonly PositionRoleFilterId[],
  sides: readonly PositionSideFilterId[],
): boolean {
  if (!roles.length && !sides.length) return true
  for (const id of roles) {
    const field = ROLE_FIELDS[id]
    if (!isNatural(p, field)) return false
  }
  for (const id of sides) {
    if (!isNatural(p, id)) return false
  }
  return true
}

export function parsePositionRoleFilterIds(raw: unknown): PositionRoleFilterId[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set<string>([
    ...POSITION_ROLE_FILTER_MAIN.map((o) => o.id),
    ...POSITION_ROLE_FILTER_NICHE.map((o) => o.id),
  ])
  return raw.filter((x): x is PositionRoleFilterId => typeof x === 'string' && allowed.has(x))
}

export function parsePositionSideFilterIds(raw: unknown): PositionSideFilterId[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(POSITION_SIDE_FILTER_OPTIONS.map((o) => o.id))
  return raw.filter((x): x is PositionSideFilterId => typeof x === 'string' && allowed.has(x))
}
