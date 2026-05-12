/**
 * Position-archetype “effectiveness” % (Eff %): weighted **recipe** (primary / secondary) plus a small
 * **engine** block of hiddens / set-piece / staff mentals that scouting lore ties to match output.
 * All inputs use `effectivenessAttrGetter` (same 1–20 scale as the profile).
 *
 * **Consistency (hidden):** CM0102 does not publish exact formulas; community discussion treats it as
 * “how reliably the player reaches their level” (e.g. champman0102.net hidden-attributes threads). We
 * model that as a **separate multiplier** on the winning archetype score (after brain, if any), so low
 * consistency clearly pulls Eff % down without mixing raw file bytes into the breakdown.
 *
 * **Natural gate:** Only archetypes natural for the player (>14) are scored; else **Unsure**.
 *
 * @see https://champman0102.net/viewtopic.php?t=3350 — hidden attributes (community reference)
 */

export type EffectivenessBrainKind = 'none' | 'defense' | 'assist'

export type EffectivenessEngineExtra = {
  key: string
  weight: number
  /** Lower raw = better (e.g. injury proneness) — still uses profile-clamped 1–20, then inverted for scoring */
  invert?: boolean
}

export interface EffectivenessArchetype {
  id: string
  label: string
  primary: readonly string[]
  secondary: readonly string[]
  brain: EffectivenessBrainKind
  /** Hiddens / staff / set-pieces — vetted per role; weights are modest vs recipe */
  engineExtras?: readonly EffectivenessEngineExtra[]
}

/** Primary ×5, secondary ×1.5, engine ×2 default; 1.25× when value ≥ 20; brain mult on DC/DMC/MC/AMC. */
export const EFFECTIVENESS_ARCHETYPES: readonly EffectivenessArchetype[] = [
  {
    id: 'gk',
    label: 'GK',
    primary: ['reflexes', 'agility'],
    secondary: ['handling', 'positioning', 'bravery'],
    brain: 'none',
    engineExtras: [
      { key: 'important_matches', weight: 2 },
      { key: 'natural_fitness', weight: 1.5 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 2 },
      { key: 'temperament', weight: 1 },
    ],
  },
  {
    id: 'dc',
    label: 'DC',
    primary: ['positioning', 'tackling', 'pace'],
    secondary: ['strength', 'heading', 'jumping'],
    brain: 'defense',
    engineExtras: [
      { key: 'teamwork', weight: 1.5 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'important_matches', weight: 1.5 },
      { key: 'natural_fitness', weight: 1.5 },
      { key: 'injury_proneness', weight: 1.5, invert: true },
    ],
  },
  {
    id: 'wb',
    label: 'WB',
    primary: ['pace', 'acceleration', 'tackling'],
    secondary: ['positioning', 'stamina', 'crossing'],
    brain: 'none',
    engineExtras: [
      { key: 'natural_fitness', weight: 2 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'important_matches', weight: 1.5 },
      { key: 'injury_proneness', weight: 1, invert: true },
    ],
  },
  {
    id: 'dmc',
    label: 'DMC',
    primary: ['positioning', 'tackling', 'stamina'],
    secondary: ['anticipation', 'decisions', 'strength'],
    brain: 'defense',
    engineExtras: [
      { key: 'teamwork', weight: 2 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'aggression', weight: 1 },
      { key: 'important_matches', weight: 1.5 },
      { key: 'injury_proneness', weight: 1.5, invert: true },
    ],
  },
  {
    id: 'mc',
    label: 'MC',
    primary: ['passing', 'creativity', 'stamina'],
    secondary: ['off_the_ball', 'work_rate', 'technique'],
    brain: 'assist',
    engineExtras: [
      { key: 'corners', weight: 2 },
      { key: 'important_matches', weight: 2 },
      { key: 'teamwork', weight: 2 },
      { key: 'influence', weight: 1 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'injury_proneness', weight: 1, invert: true },
    ],
  },
  {
    id: 'amw',
    label: 'AM',
    primary: ['pace', 'acceleration', 'dribbling'],
    secondary: ['crossing', 'off_the_ball', 'flair'],
    brain: 'none',
    engineExtras: [
      { key: 'corners', weight: 2 },
      { key: 'important_matches', weight: 2 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'natural_fitness', weight: 1.5 },
      { key: 'technique', weight: 1.5 },
      { key: 'injury_proneness', weight: 1, invert: true },
    ],
  },
  {
    id: 'amc',
    label: 'AMC',
    primary: ['creativity', 'off_the_ball', 'passing'],
    secondary: ['decisions', 'anticipation', 'finishing'],
    brain: 'assist',
    engineExtras: [
      { key: 'corners', weight: 2 },
      { key: 'important_matches', weight: 2 },
      { key: 'teamwork', weight: 2 },
      { key: 'influence', weight: 1 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'injury_proneness', weight: 1, invert: true },
    ],
  },
  {
    id: 'st',
    label: 'ST',
    primary: ['pace', 'acceleration', 'finishing', 'off_the_ball'],
    secondary: ['agility', 'jumping', 'strength'],
    brain: 'none',
    engineExtras: [
      { key: 'important_matches', weight: 2 },
      { key: 'teamwork', weight: 2 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'technique', weight: 2 },
      { key: 'injury_proneness', weight: 2, invert: true },
    ],
  },
] as const

const W_PRIMARY = 5
const W_SECONDARY = 1.5
const GOD_MULT = 1.25

/**
 * Heuristic “realizes their level” factor from consistency (1–20 display). Not from decompiled EXE;
 * tuned so C=1 still leaves ~73% of pre-consistency Eff, C=20 leaves 100%.
 */
export function consistencyReliabilityFactor(consistencyDisplay: number): number {
  const c = Math.max(1, Math.min(20, consistencyDisplay))
  return 0.72 + 0.014 * c
}

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
  slot: 'primary' | 'secondary' | 'engine'
  weight: number
  raw: number
  contribution: number
  godTier: boolean
}

export interface EffectivenessWinnerDetail {
  archetypeId: string
  archetypeLabel: string
  /** Recipe + engine, % of max, before brain mult */
  basePercent: number
  /** After brain (if any), before consistency reliability */
  preConsistencyPercent: number
  brainMult?: { decisions: number; anticipation: number; factor: number }
  /** Final % after consistency multiplier */
  finalPercent: number
  consistencyReliability?: { consistency: number; factor: number }
  lines: EffStatLine[]
  engineLines: EffStatLine[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function accumulateArchetype(
  a: EffectivenessArchetype,
  get: (name: string) => number,
): { rawFinal: number; detail: EffectivenessWinnerDetail } {
  const lines: EffStatLine[] = []
  const engineLines: EffStatLine[] = []
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
  for (const ex of a.engineExtras ?? []) {
    const sourceRaw = get(ex.key)
    let effectiveRaw = sourceRaw
    if (ex.invert) {
      const c0 = Math.max(1, Math.min(20, sourceRaw))
      effectiveRaw = 21 - c0
    }
    const w = ex.weight
    const vp = valPart(effectiveRaw)
    const c = w * vp
    sum += c
    max += w * GOD_MULT
    engineLines.push({
      key: ex.key,
      label: effAttrLabel(ex.key),
      slot: 'engine',
      weight: w,
      raw: sourceRaw,
      contribution: c,
      godTier: effectiveRaw >= 20,
    })
  }
  const basePct = max <= 0 ? 0 : (100 * sum) / max
  let brainMult: EffectivenessWinnerDetail['brainMult']
  let afterBrain = basePct
  if (a.brain === 'defense' || a.brain === 'assist') {
    const decisions = Math.max(0, Math.min(20, get('decisions')))
    const anticipation = Math.max(0, Math.min(20, get('anticipation')))
    const factor = (decisions / 20) * (anticipation / 20)
    brainMult = { decisions, anticipation, factor: Math.round(factor * 10000) / 10000 }
    afterBrain = basePct * factor
  }
  afterBrain = Math.min(100, afterBrain)
  const detail: EffectivenessWinnerDetail = {
    archetypeId: a.id,
    archetypeLabel: a.label,
    basePercent: round1(basePct),
    preConsistencyPercent: round1(afterBrain),
    finalPercent: round1(afterBrain),
    brainMult,
    lines,
    engineLines,
  }
  return { rawFinal: afterBrain, detail }
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

  const preC = best.rawFinal
  const c = Math.max(1, Math.min(20, getAttr('consistency')))
  const rel = consistencyReliabilityFactor(c)
  const effPercent = preC < 0 ? 0 : round1(Math.min(100, preC * rel))

  const runnerUp: EffectivenessRunnerUp | null =
    second && second.a.id !== best.a.id
      ? {
          archetypeId: second.a.id,
          archetypeLabel: second.a.label,
          score: round1(second.rawFinal * rel),
        }
      : null

  const winnerDetail: EffectivenessWinnerDetail = {
    ...best.detail,
    preConsistencyPercent: round1(preC),
    consistencyReliability: { consistency: round1(c), factor: Math.round(rel * 1000) / 1000 },
    finalPercent: effPercent,
  }

  return {
    effPercent,
    effArchetype: best.a.label,
    effArchetypeId: best.a.id,
    winnerDetail,
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
