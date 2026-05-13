/**
 * Field order for the attribute editor UI (mirrors `profilePayload.ts` main / hidden panels).
 * Kept in shared so the renderer can import without pulling main-process modules.
 */

export const EDITOR_MAIN_ATTR_COLS: readonly [readonly string[], readonly string[], readonly string[]] = [
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

export const EDITOR_HIDDEN_ORDER = [
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

/** Natural position / side / free-role bytes in `player.dat` row order. */
export const EDITOR_POSITION_KEYS = [
  'goalkeeper',
  'sweeper',
  'defender',
  'defensive_midfielder',
  'midfielder',
  'attacking_midfielder',
  'attacker',
  'wing_back',
  'right_side',
  'left_side',
  'centre_side',
  'free_role',
] as const

export function editorAttrLabel(key: string): string {
  if (key === 'free_kicks') return 'Set pieces'
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
