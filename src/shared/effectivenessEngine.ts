/**
 * Position-archetype “effectiveness” % (Eff %): weighted mix of **profile-scale** attributes (1–20
 * in-game for CA18, clamped for the rest), best archetype wins. Inputs come from
 * `effectivenessAttrGetter` so breakdown numbers match the profile, not raw `player.dat` bytes.
 *
 * **Natural gate:** Only archetypes the player is natural for (>14) are scored. If none match,
 * Eff % is **Unsure** — use CM Scout %.
 */

export type EffectivenessBrainKind = 'none' | 'defense' | 'assist'

export interface EffectivenessArchetype {
  id: string
  label: string
  primary: readonly string[]
  secondary: readonly string[]
  brain: EffectivenessBrainKind
}

/** Primary w=5, secondary w=1.5; 1.25× when displayed value ≥ 20; brain mult on DC/DMC/MC/AMC. */
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

export function effAttrLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function valPart(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  const capped = Math.max(0, Math.min(20, raw))
  const base = capped / 20
  return raw >= 20 ? base * GOD_MULT : base
}

export interface EffStatLine {
  key: string
  label: string
  slot: 'primary' | 'secondary'
  weight: number
  raw: number
  contribution: number
  godTier: boolean
}

export interface EffectivenessWinnerDetail {
  archetypeId: string
  archetypeLabel: string
  basePercent: number
  finalPercent: number
  brainMult?: { decisions: number; anticipation: number; factor: number }
  lines: EffStatLine[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function accumulateArchetype(
  a: EffectivenessArchetype,
  get: (name: string) => number,
): { rawFinal: number; detail: EffectivenessWinnerDetail } {
  const lines: EffStatLine[] = []
  let sum = 0
  let max = 0
  for (const k of a.primary) {
    const raw = get(k)
    const vp = valPart(raw)
    const c = W_PRIMARY * vp
    sum += c
    max += W_PRIMARY * GOD_MULT
    lines.push({
      key: k,
      label: effAttrLabel(k),
      slot: 'primary',
      weight: W_PRIMARY,
      raw,
      contribution: c,
      godTier: raw >= 20,
    })
  }
  for (const k of a.secondary) {
    const raw = get(k)
    const vp = valPart(raw)
    const c = W_SECONDARY * vp
    sum += c
    max += W_SECONDARY * GOD_MULT
    lines.push({
      key: k,
      label: effAttrLabel(k),
      slot: 'secondary',
      weight: W_SECONDARY,
      raw,
      contribution: c,
      godTier: raw >= 20,
    })
  }
  const basePct = max <= 0 ? 0 : (100 * sum) / max
  let brainMult: EffectivenessWinnerDetail['brainMult']
  let finalPct = basePct
  if (a.brain === 'defense' || a.brain === 'assist') {
    const decisions = Math.max(0, Math.min(20, get('decisions')))
    const anticipation = Math.max(0, Math.min(20, get('anticipation')))
    const factor = (decisions / 20) * (anticipation / 20)
    brainMult = { decisions, anticipation, factor: Math.round(factor * 10000) / 10000 }
    finalPct = basePct * factor
  }
  finalPct = Math.min(100, finalPct)
  const detail: EffectivenessWinnerDetail = {
    archetypeId: a.id,
    archetypeLabel: a.label,
    basePercent: round1(basePct),
    finalPercent: round1(finalPct),
    brainMult,
    lines,
  }
  return { rawFinal: finalPct, detail }
}

export type EffectivenessRunnerUp = {
  archetypeId: string
  archetypeLabel: string
  score: number
}

export type EffectivenessFullResult = {
  effPercent: number | null
  effArchetype: string
  effArchetypeId: string
  winnerDetail: EffectivenessWinnerDetail | null
  runnerUp: EffectivenessRunnerUp | null
  relaxedNaturalGate: boolean
}

export function playerAttrGetter(player: Record<string, number>): (name: string) => number {
  return (name: string) => {
    const v = player[name]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
}

export function computeEffectivenessFull(
  getAttr: (name: string) => number,
  naturalEligibleIds: ReadonlySet<string>,
): EffectivenessFullResult {
  let pool = EFFECTIVENESS_ARCHETYPES.filter((a) => naturalEligibleIds.has(a.id))
  if (pool.length === 0) {
    return {
      effPercent: null,
      effArchetype: 'Unsure',
      effArchetypeId: 'unsure',
      winnerDetail: null,
      runnerUp: null,
      relaxedNaturalGate: true,
    }
  }

  const scored: { a: EffectivenessArchetype; rawFinal: number; detail: EffectivenessWinnerDetail }[] = []
  for (const a of pool) {
    const { rawFinal, detail } = accumulateArchetype(a, getAttr)
    scored.push({ a, rawFinal, detail })
  }
  scored.sort((x, y) => {
    if (y.rawFinal !== x.rawFinal) return y.rawFinal - x.rawFinal
    return x.a.id.localeCompare(y.a.id)
  })
  const best = scored[0]!
  const second = scored[1]
  const runnerUp: EffectivenessRunnerUp | null =
    second && second.a.id !== best.a.id
      ? {
          archetypeId: second.a.id,
          archetypeLabel: second.a.label,
          score: round1(second.rawFinal),
        }
      : null

  const effPercent = best.rawFinal < 0 ? 0 : round1(best.rawFinal)
  return {
    effPercent,
    effArchetype: best.a.label,
    effArchetypeId: best.a.id,
    winnerDetail: { ...best.detail, finalPercent: effPercent },
    runnerUp,
    relaxedNaturalGate: false,
  }
}

export function computeBestEffectiveness(
  getAttr: (name: string) => number,
  naturalEligibleIds: ReadonlySet<string>,
): {
  effPercent: number | null
  effArchetype: string
  effArchetypeId: string
} {
  const f = computeEffectivenessFull(getAttr, naturalEligibleIds)
  return { effPercent: f.effPercent, effArchetype: f.effArchetype, effArchetypeId: f.effArchetypeId }
}
