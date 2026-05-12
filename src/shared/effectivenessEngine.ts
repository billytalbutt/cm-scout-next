/**
 * Position-archetype “effectiveness” % (Eff %): engine-style weighted mix of raw intrinsic
 * attributes (1–20), best archetype wins (e.g. a DM may peak as DC). Independent of CM Scout
 * in-match normalization — complements `cmScoutRating.ts`, does not replace it.
 *
 * Each archetype also scores **`engineExtras`**: mentals and hidden-style fields (consistency,
 * important matches, staff determination/professionalism, etc.) on lighter weights so Eff % tracks
 * engine-relevant character, not only the on-ball recipe lines. CM Scout % stays separate
 * (`cmScoutRating.ts`).
 *
 * **Natural gate (main process):** Only archetypes the player is natural for (>14 on matching lines,
 * same idea as CM Scout) are scored, so e.g. outfielders are not rated on GK. If no line matches any
 * recipe (data oddities), Eff % shows **Unsure** (no numeric score) — use CM Scout % for that row.
 */

export type EffectivenessBrainKind = 'none' | 'defense' | 'assist'

/** Optional weighted engine-profile stats (player + staff fields); `invert` for lower-is-better. */
export type EffectivenessEngineExtra = {
  key: string
  weight: number
  invert?: boolean
}

export interface EffectivenessArchetype {
  /** Stable id for tests / logging */
  id: string
  /** Shown in brackets next to Eff % */
  label: string
  primary: readonly string[]
  secondary: readonly string[]
  brain: EffectivenessBrainKind
  /** Mentals / hiddens that still move the needle for this role in the match engine */
  engineExtras?: readonly EffectivenessEngineExtra[]
}

/** Primary w=5, secondary w=1.5; 1.25× on each stat when raw ≥ 20; brain mult where noted. */
export const EFFECTIVENESS_ARCHETYPES: readonly EffectivenessArchetype[] = [
  {
    id: 'gk',
    label: 'GK',
    primary: ['reflexes', 'agility'],
    secondary: ['handling', 'positioning', 'bravery'],
    brain: 'none',
    engineExtras: [
      { key: 'consistency', weight: 2 },
      { key: 'important_matches', weight: 1.5 },
      { key: 'professionalism', weight: 2 },
      { key: 'temperament', weight: 1.5 },
      { key: 'one_on_ones', weight: 1.5 },
    ],
  },
  {
    id: 'dc',
    label: 'DC',
    primary: ['positioning', 'tackling', 'pace'],
    secondary: ['strength', 'heading', 'jumping'],
    brain: 'defense',
    engineExtras: [
      { key: 'consistency', weight: 2 },
      { key: 'bravery', weight: 1 },
      { key: 'teamwork', weight: 1.5 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'aggression', weight: 1 },
    ],
  },
  {
    id: 'wb',
    label: 'WB',
    primary: ['pace', 'acceleration', 'tackling'],
    secondary: ['positioning', 'stamina', 'crossing'],
    brain: 'none',
    engineExtras: [
      { key: 'determination', weight: 2 },
      { key: 'consistency', weight: 1.5 },
      { key: 'natural_fitness', weight: 1.5 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'work_rate', weight: 1 },
    ],
  },
  {
    id: 'dmc',
    label: 'DMC',
    primary: ['positioning', 'tackling', 'stamina'],
    secondary: ['anticipation', 'decisions', 'strength'],
    brain: 'defense',
    engineExtras: [
      { key: 'consistency', weight: 2 },
      { key: 'teamwork', weight: 1.5 },
      { key: 'work_rate', weight: 1.5 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'aggression', weight: 1 },
    ],
  },
  {
    id: 'mc',
    label: 'MC',
    primary: ['passing', 'creativity', 'stamina'],
    secondary: ['off_the_ball', 'work_rate', 'technique'],
    brain: 'assist',
    engineExtras: [
      { key: 'teamwork', weight: 2 },
      { key: 'consistency', weight: 2 },
      { key: 'influence', weight: 1 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'important_matches', weight: 1 },
    ],
  },
  {
    id: 'amw',
    label: 'AM',
    primary: ['pace', 'acceleration', 'dribbling'],
    secondary: ['crossing', 'off_the_ball', 'flair'],
    brain: 'none',
    engineExtras: [
      { key: 'consistency', weight: 1.5 },
      { key: 'important_matches', weight: 1.5 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'bravery', weight: 1 },
    ],
  },
  {
    id: 'amc',
    label: 'AMC',
    primary: ['creativity', 'off_the_ball', 'passing'],
    secondary: ['decisions', 'anticipation', 'finishing'],
    brain: 'assist',
    engineExtras: [
      { key: 'teamwork', weight: 1.5 },
      { key: 'consistency', weight: 2 },
      { key: 'influence', weight: 1 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'flair', weight: 1 },
    ],
  },
  {
    id: 'st',
    label: 'ST',
    primary: ['pace', 'acceleration', 'finishing', 'off_the_ball'],
    secondary: ['agility', 'jumping', 'strength'],
    brain: 'none',
    engineExtras: [
      { key: 'consistency', weight: 2.5 },
      { key: 'important_matches', weight: 2 },
      { key: 'determination', weight: 2.5 },
      { key: 'professionalism', weight: 2 },
      { key: 'teamwork', weight: 1.5 },
      { key: 'technique', weight: 2 },
      { key: 'injury_proneness', weight: 1.5, invert: true },
    ],
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
  slot: 'primary' | 'secondary' | 'engine'
  weight: number
  raw: number
  contribution: number
  godTier: boolean
}

export interface EffectivenessWinnerDetail {
  archetypeId: string
  archetypeLabel: string
  /** Weighted % before Decisions×Anticipation (when brain applies). */
  basePercent: number
  /** Final % after brain and cap at 100. */
  finalPercent: number
  brainMult?: { decisions: number; anticipation: number; factor: number }
  lines: EffStatLine[]
  /** Mentals / staff hiddens / inverted “less is better” fields in the engine profile */
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
    engineLines,
  }
  return { rawFinal: finalPct, detail }
}

export type EffectivenessRunnerUp = {
  archetypeId: string
  archetypeLabel: string
  score: number
}

export type EffectivenessFullResult = {
  /** Null when no natural line matched any recipe — UI should show “Unsure”, not a raw %. */
  effPercent: number | null
  effArchetype: string
  effArchetypeId: string
  winnerDetail: EffectivenessWinnerDetail | null
  runnerUp: EffectivenessRunnerUp | null
  /** True when naturals matched none of the eight recipes (effPercent is null). */
  relaxedNaturalGate: boolean
}

export function playerAttrGetter(player: Record<string, number>): (name: string) => number {
  return (name: string) => {
    const v = player[name]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
}

/** Full effectiveness result including explainable winner breakdown and runner-up archetype. */
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
