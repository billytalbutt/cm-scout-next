/**
 * Position-archetype “effectiveness” % (Eff %): engine-style weighted mix of raw intrinsic
 * attributes (1–20), best archetype wins (e.g. a DM may peak as DC). Independent of CM Scout
 * in-match normalization — complements `cmScoutRating.ts`, does not replace it.
 */

export type EffectivenessBrainKind = 'none' | 'defense' | 'assist'

export interface EffectivenessArchetype {
  /** Stable id for tests / logging */
  id: string
  /** Shown in brackets next to Eff % */
  label: string
  primary: readonly string[]
  secondary: readonly string[]
  brain: EffectivenessBrainKind
}

/** Primary w=5, secondary w=1.5; 1.25× on each stat when raw ≥ 20; brain mult where noted. */
export const EFFECTIVENESS_ARCHETYPES: readonly EffectivenessArchetype[] = [
  {
    id: 'gk',
    label: 'GK',
    primary: ['reflexes', 'agility'],
    secondary: ['handling', 'positioning', 'bravery'],
    brain: 'none',
  },
  {
    id: 'dc',
    label: 'DC',
    primary: ['positioning', 'tackling', 'pace'],
    secondary: ['strength', 'heading', 'jumping'],
    brain: 'defense',
  },
  {
    id: 'wb',
    label: 'WB',
    primary: ['pace', 'acceleration', 'tackling'],
    secondary: ['positioning', 'stamina', 'crossing'],
    brain: 'none',
  },
  {
    id: 'dmc',
    label: 'DMC',
    primary: ['positioning', 'tackling', 'stamina'],
    secondary: ['anticipation', 'decisions', 'strength'],
    brain: 'defense',
  },
  {
    id: 'mc',
    label: 'MC',
    primary: ['passing', 'creativity', 'stamina'],
    secondary: ['off_the_ball', 'work_rate', 'technique'],
    brain: 'assist',
  },
  {
    id: 'amw',
    label: 'AM',
    primary: ['pace', 'acceleration', 'dribbling'],
    secondary: ['crossing', 'off_the_ball', 'flair'],
    brain: 'none',
  },
  {
    id: 'amc',
    label: 'AMC',
    primary: ['creativity', 'off_the_ball', 'passing'],
    secondary: ['decisions', 'anticipation', 'finishing'],
    brain: 'assist',
  },
  {
    id: 'st',
    label: 'ST',
    primary: ['pace', 'acceleration', 'finishing', 'off_the_ball'],
    secondary: ['agility', 'jumping', 'strength'],
    brain: 'none',
  },
] as const

const W_PRIMARY = 5
const W_SECONDARY = 1.5
const GOD_MULT = 1.25

function valPart(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  const capped = Math.max(0, Math.min(20, raw))
  const base = capped / 20
  return raw >= 20 ? base * GOD_MULT : base
}

function archetypeScore(a: EffectivenessArchetype, get: (name: string) => number): number {
  let sum = 0
  let max = 0
  for (const k of a.primary) {
    sum += W_PRIMARY * valPart(get(k))
    max += W_PRIMARY * GOD_MULT
  }
  for (const k of a.secondary) {
    sum += W_SECONDARY * valPart(get(k))
    max += W_SECONDARY * GOD_MULT
  }
  if (max <= 0) return 0
  let pct = (100 * sum) / max
  if (a.brain === 'defense' || a.brain === 'assist') {
    const d = Math.max(0, Math.min(20, get('decisions'))) / 20
    const an = Math.max(0, Math.min(20, get('anticipation'))) / 20
    pct *= d * an
  }
  return Math.min(100, pct)
}

export function playerAttrGetter(player: Record<string, number>): (name: string) => number {
  return (name: string) => {
    const v = player[name]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
}

export function computeBestEffectiveness(getAttr: (name: string) => number): {
  effPercent: number
  effArchetype: string
} {
  let best = -1
  let bestLabel = ''
  for (const a of EFFECTIVENESS_ARCHETYPES) {
    const s = archetypeScore(a, getAttr)
    if (s > best) {
      best = s
      bestLabel = a.label
    }
  }
  const effPercent = best < 0 ? 0 : Math.round(best * 10) / 10
  return { effPercent, effArchetype: bestLabel }
}
