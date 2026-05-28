/**
 * Position-archetype “effectiveness” % (Eff %): weighted **recipe** (primary / secondary) plus a small
 * **engine** block of hiddens / set-piece / staff mentals that scouting lore ties to on-pitch output.
 * Injury proneness and discipline (dirtiness/aggression) are **not** scored here — see `computePlayerRiskFlags`.
 * All inputs use `effectivenessAttrGetter` (uncapped engine display where profile brackets exceed 20).
 *
 * **Consistency (hidden):** CM0102 does not publish exact formulas; community discussion treats it as
 * “how reliably the player reaches their level” (e.g. champman0102.net hidden-attributes threads). We
 * model that as a **separate multiplier** on the winning archetype score (after brain, if any), so low
 * consistency clearly pulls Eff % down without mixing raw file bytes into the breakdown.
 *
 * **Natural gate:** Only archetypes natural for the player (>14) are scored; else **Unsure** — Eff % is always
 * among position‑appropriate recipes (MC vs DMC vs AMC, etc.), never a generic “all roles” blend.
 *
 * **Brain mult (DC only):** Centre-backs use a softened decisions+anticipation factor because those attrs are not
 * recipe secondaries. DMC includes them as secondaries already — no extra multiplier (avoids double-counting).
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

/** Primary ×5, secondary ×1.5, engine ×2 default; on-screen 20 = full recipe credit (1.25×); overflow uses
 *  diminishing returns; soft compression above ~86% keeps flat 100% rare. Brain mult on DC only. */
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
    ],
  },
  {
    id: 'dmc',
    label: 'DMC',
    primary: ['positioning', 'tackling', 'stamina'],
    secondary: ['anticipation', 'decisions', 'strength'],
    /** Mentals are already recipe secondaries — no extra multiplicative brain (was double-counting). */
    brain: 'none',
    engineExtras: [
      { key: 'teamwork', weight: 2 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 1.5 },
      { key: 'important_matches', weight: 1.5 },
    ],
  },
  {
    id: 'mc',
    label: 'MC',
    /** Forum-weighted “hub” CM: technique / decisions / teamwork first; passing/creativity supportive (Xavi-shaped ok). */
    primary: ['technique', 'decisions', 'teamwork'],
    secondary: ['passing', 'anticipation', 'stamina'],
    brain: 'none',
    engineExtras: [
      { key: 'creativity', weight: 1.5 },
      { key: 'off_the_ball', weight: 1.5 },
      { key: 'work_rate', weight: 1.5 },
      { key: 'corners', weight: 1.5 },
      { key: 'important_matches', weight: 0.75 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 0.75 },
      { key: 'influence', weight: 0.75 },
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
    ],
  },
  {
    id: 'amc',
    label: 'AMC',
    primary: ['technique', 'decisions', 'passing'],
    secondary: ['creativity', 'off_the_ball', 'anticipation'],
    brain: 'none',
    engineExtras: [
      { key: 'finishing', weight: 1 },
      { key: 'corners', weight: 1.5 },
      { key: 'important_matches', weight: 0.75 },
      { key: 'teamwork', weight: 1.5 },
      { key: 'influence', weight: 0.75 },
      { key: 'determination', weight: 2 },
      { key: 'professionalism', weight: 0.75 },
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
    ],
  },
] as const

/** Availability / discipline risks — shown in UI only; do not affect Eff %. */
export type PlayerRiskFlags = {
  injuryRisk: boolean
  disciplineRisk: boolean
  lowConsistency: boolean
}

const INJURY_RISK_THRESHOLD = 14
const DISCIPLINE_DIRTINESS_THRESHOLD = 14
const DISCIPLINE_AGGRESSION_THRESHOLD = 14
const LOW_CONSISTENCY_THRESHOLD = 8

export function computePlayerRiskFlags(getAttr: (name: string) => number): PlayerRiskFlags {
  const injury = Math.max(0, Math.min(20, getAttr('injury_proneness')))
  const dirtiness = Math.max(0, Math.min(20, getAttr('dirtiness')))
  const aggression = Math.max(0, Math.min(20, getAttr('aggression')))
  const consistency = Math.max(0, Math.min(20, getAttr('consistency')))
  return {
    injuryRisk: injury >= INJURY_RISK_THRESHOLD,
    disciplineRisk:
      dirtiness >= DISCIPLINE_DIRTINESS_THRESHOLD && aggression >= DISCIPLINE_AGGRESSION_THRESHOLD,
    lowConsistency: consistency > 0 && consistency <= LOW_CONSISTENCY_THRESHOLD,
  }
}

const W_PRIMARY = 5
const W_SECONDARY = 1.5
const GOD_MULT = 1.25
/**
 * Extra credit for bracketed engine display above on-screen 20.
 * Diminishing returns — one uncapped primary should help, not double the slot.
 */
const VAL_PART_OVERFLOW_CAP = 0.38
/** sqrt(excess) scale — higher = gentler overflow curve. */
const OVERFLOW_SQRT_SCALE = 28
/** Normalization assumes elite profiles may carry modest overflow (denominator headroom). */
const OVERFLOW_MAX_HEADROOM_RATIO = 0.55
/** Compress raw scores above this so 100% is reserved for true multi-stat engine elites. */
const EFF_SOFT_CAP_START = 86
const EFF_SOFT_CAP_STRETCH = 0.42
/** On-screen / engine “perfect” for recipe normalization — all-20s should land high-80s pre-compression. */
const RECIPE_PERFECT_DISPLAY = 20

/**
 * Heuristic “realizes their level” factor from consistency (1–20 display). Not from decompiled EXE;
 * tuned so C=1 still leaves ~88% of pre-consistency Eff, C=20 leaves 100%.
 */
export function consistencyReliabilityFactor(consistencyDisplay: number): number {
  const c = Math.max(1, Math.min(20, consistencyDisplay))
  return 0.88 + 0.006 * c
}

export function effAttrLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Base recipe contribution 0…GOD_MULT from on-screen display (capped at 20 for the bar). */
export function valPartBase(display: number): number {
  if (!Number.isFinite(display)) return 0
  const v = Math.max(0, Math.min(display, RECIPE_PERFECT_DISPLAY))
  const base = v / RECIPE_PERFECT_DISPLAY
  return v >= RECIPE_PERFECT_DISPLAY ? base * GOD_MULT : base
}

/** Bracketed elite bonus above 20 — diminishing; Tsigalko-tier still beats all-20s, one god stat does not. */
export function valPartOverflow(display: number): number {
  if (!Number.isFinite(display) || display <= RECIPE_PERFECT_DISPLAY) return 0
  const excess = display - RECIPE_PERFECT_DISPLAY
  const raw = (Math.sqrt(excess) / Math.sqrt(OVERFLOW_SQRT_SCALE)) * VAL_PART_OVERFLOW_CAP
  return Math.min(VAL_PART_OVERFLOW_CAP, raw)
}

/** Base + overflow (for tests and tooling). */
export function valPart(display: number): number {
  return valPartBase(display) + valPartOverflow(display)
}

function recipePerfectValPart(): number {
  return valPartBase(RECIPE_PERFECT_DISPLAY)
}

/** Per-slot normalization ceiling — includes partial overflow headroom. */
function recipeSlotMaxValPart(): number {
  return recipePerfectValPart() + VAL_PART_OVERFLOW_CAP * OVERFLOW_MAX_HEADROOM_RATIO
}

/**
 * Soft cap on displayed Eff % — raw recipe math can exceed 100 when overflow + synergy stack;
 * community expectation is almost nobody hits a flat 100 except multi-stat engine breakers.
 */
export function compressDisplayEff(raw: number): number {
  if (raw <= EFF_SOFT_CAP_START) return round1(Math.max(0, raw))
  return round1(EFF_SOFT_CAP_START + (raw - EFF_SOFT_CAP_START) * EFF_SOFT_CAP_STRETCH)
}

export interface EffStatLine {
  key: string
  label: string
  slot: 'primary' | 'secondary' | 'engine'
  weight: number
  /** Value from effectiveness getter (uncapped engine display where applicable). */
  raw: number
  contribution: number
  /** On-screen or engine display ≥ 20. */
  godTier: boolean
  /** Engine display above on-screen 20 (bracketed elites). */
  overflow: boolean
}

export type EffectivenessArchetypeRow = {
  archetypeId: string
  archetypeLabel: string
  /** After consistency multiplier — comparable across natural roles. */
  percent: number
  isWinner: boolean
}

export interface EffectivenessWinnerDetail {
  archetypeId: string
  archetypeLabel: string
  /** Recipe + engine, % of max, before brain mult */
  basePercent: number
  /** After brain (if any), before consistency reliability */
  preConsistencyPercent: number
  brainMult?: { decisions: number; anticipation: number; factor: number }
  /**
   * After recipe + brain mult (if any), **before** {@link synergyBoost}.
   * Set only when synergy &gt; 0 so the UI can show an intermediate step.
   */
  preSynergyPercent?: number
  /**
   * Small **profile synergy** bump when attribute *relationships* match a community story
   * (e.g. MC hub: strong mentals + technique with “good” not elite passing). Capped; shown in profile.
   */
  synergyBoost?: number
  /** Final % after consistency multiplier */
  finalPercent: number
  consistencyReliability?: { consistency: number; factor: number }
  lines: EffStatLine[]
  engineLines: EffStatLine[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function clamp20(get: (name: string) => number, key: string): number {
  const v = get(key)
  return Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : 0
}

/**
 * Bounded synergy on top of recipe+brain (0–100 scale before consistency mult).
 */
export function archetypeSynergyPercent(archetypeId: string, get: (name: string) => number): number {
  switch (archetypeId) {
    case 'mc': {
      const d = clamp20(get, 'decisions')
      const a = clamp20(get, 'anticipation')
      const t = clamp20(get, 'teamwork')
      const pass = clamp20(get, 'passing')
      const tech = clamp20(get, 'technique')
      const brainAvg = (d + a + t) / 60
      if (brainAvg < 0.8) return 0
      if (pass > 17.5) return 0
      if (pass < 13 || tech < 15) return 0
      const passGap = clamp01((17 - pass) / 4)
      const brainExcess = clamp01((brainAvg - 0.8) / 0.1)
      return round1(Math.min(4.5, 4.2 * passGap * brainExcess * (tech >= 16 ? 1 : 0.85)))
    }
    case 'amc': {
      const dec = clamp20(get, 'decisions')
      const ant = clamp20(get, 'anticipation')
      const pass = clamp20(get, 'passing')
      const tech = clamp20(get, 'technique')
      const cre = clamp20(get, 'creativity')
      if (cre >= 17) return 0
      if (pass < 15 || tech < 15) return 0
      const brain = (dec + ant) / 40
      if (brain < 0.8) return 0
      const creGap = clamp01((16 - cre) / 5)
      const brainEx = clamp01((brain - 0.78) / 0.12)
      return round1(Math.min(4, 3.5 * creGap * brainEx))
    }
    case 'st': {
      const fin = clamp20(get, 'finishing')
      const otb = clamp20(get, 'off_the_ball')
      const pac = clamp20(get, 'pace')
      const acc = clamp20(get, 'acceleration')
      if (fin < 15 || otb < 15) return 0
      if (pac >= 16 && acc >= 16) return 0
      const move = (fin + otb) / 40
      if (move < 0.78) return 0
      const paceSoft = clamp01((17 - Math.max(pac, acc)) / 5)
      return round1(Math.min(3.5, 3 * paceSoft * clamp01((move - 0.75) / 0.15)))
    }
    case 'dmc': {
      const pass = clamp20(get, 'passing')
      const ant = clamp20(get, 'anticipation')
      const dec = clamp20(get, 'decisions')
      const tac = clamp20(get, 'tackling')
      if (pass < 15 || ant < 15 || dec < 15) return 0
      if (tac >= 17) return 0
      const mid = (pass + ant + dec) / 60
      return round1(Math.min(3.5, 3 * clamp01((mid - 0.75) / 0.12) * clamp01((16.5 - tac) / 4)))
    }
    case 'dc': {
      const pass = clamp20(get, 'passing')
      const ant = clamp20(get, 'anticipation')
      const dec = clamp20(get, 'decisions')
      const tech = clamp20(get, 'technique')
      if (pass < 13 || ant < 16) return 0
      const dist = (pass + tech + dec) / 60
      if (dist < 0.75) return 0
      return round1(Math.min(3.5, 2.8 * clamp01((dist - 0.72) / 0.15) * clamp01((ant - 15) / 5)))
    }
    default:
      return 0
  }
}

function recipeIncludesBrainMentals(a: EffectivenessArchetype): boolean {
  const keys = new Set([...a.primary, ...a.secondary])
  return keys.has('decisions') && keys.has('anticipation')
}

/**
 * DC/SW brain gate — decisions + anticipation for reading danger.
 * Uses average (not product) so 15–16 mentals on an otherwise elite profile are not halved.
 */
export function defenseBrainFactor(decisions: number, anticipation: number): number {
  const d = Math.max(0, Math.min(20, decisions)) / 20
  const a = Math.max(0, Math.min(20, anticipation)) / 20
  const avg = (d + a) / 2
  return 0.35 + 0.65 * avg
}

/**
 * Defensive wide roles need tackling floor — uncapped positioning cannot carry the whole recipe.
 */
function rolePrimaryFloorFactor(archetypeId: string, get: (name: string) => number): number {
  if (archetypeId === 'dmc' || archetypeId === 'dc' || archetypeId === 'wb') {
    const tac = clamp20(get, 'tackling')
    if (tac >= 15) return 1
    return 0.78 + 0.22 * (tac / 15)
  }
  return 1
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
    const vp = valPartBase(raw) + valPartOverflow(raw)
    const c = W_PRIMARY * vp
    sum += c
    max += W_PRIMARY * recipeSlotMaxValPart()
    lines.push({
      key: k,
      label: effAttrLabel(k),
      slot: 'primary',
      weight: W_PRIMARY,
      raw,
      contribution: c,
      godTier: raw >= 20,
      overflow: raw > 20,
    })
  }
  for (const k of a.secondary) {
    const raw = get(k)
    const vp = valPartBase(raw) + valPartOverflow(raw)
    const c = W_SECONDARY * vp
    sum += c
    max += W_SECONDARY * recipeSlotMaxValPart()
    lines.push({
      key: k,
      label: effAttrLabel(k),
      slot: 'secondary',
      weight: W_SECONDARY,
      raw,
      contribution: c,
      godTier: raw >= 20,
      overflow: raw > 20,
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
    const vp = valPartBase(effectiveRaw) + valPartOverflow(effectiveRaw)
    const c = w * vp
    sum += c
    max += w * recipeSlotMaxValPart()
    engineLines.push({
      key: ex.key,
      label: effAttrLabel(ex.key),
      slot: 'engine',
      weight: w,
      raw: sourceRaw,
      contribution: c,
      godTier: effectiveRaw >= 20,
      overflow: effectiveRaw > 20,
    })
  }
  const basePct = max <= 0 ? 0 : (100 * sum) / max
  const floorFactor = rolePrimaryFloorFactor(a.id, get)
  let brainMult: EffectivenessWinnerDetail['brainMult']
  let afterBrain = basePct * floorFactor
  if (
    (a.brain === 'defense' || a.brain === 'assist') &&
    !recipeIncludesBrainMentals(a)
  ) {
    const decisions = Math.max(0, Math.min(20, get('decisions')))
    const anticipation = Math.max(0, Math.min(20, get('anticipation')))
    const factor = defenseBrainFactor(decisions, anticipation)
    brainMult = { decisions, anticipation, factor: Math.round(factor * 10000) / 10000 }
    afterBrain = basePct * floorFactor * factor
  }
  afterBrain = Math.min(100, afterBrain)
  const preSynValue = afterBrain
  const syn = archetypeSynergyPercent(a.id, get)
  afterBrain = Math.min(100, afterBrain + syn)
  const detail: EffectivenessWinnerDetail = {
    archetypeId: a.id,
    archetypeLabel: a.label,
    basePercent: round1(basePct),
    preSynergyPercent: syn > 0 ? round1(preSynValue) : undefined,
    preConsistencyPercent: round1(afterBrain),
    finalPercent: round1(afterBrain),
    brainMult,
    synergyBoost: syn > 0 ? round1(syn) : undefined,
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
  /** Every natural-gated archetype scored with the same getter + consistency mult. */
  byArchetype: EffectivenessArchetypeRow[]
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
      byArchetype: [],
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
  const effPercent = preC < 0 ? 0 : compressDisplayEff(preC * rel)

  const byArchetype: EffectivenessArchetypeRow[] = scored.map((s, i) => ({
    archetypeId: s.a.id,
    archetypeLabel: s.a.label,
    percent: compressDisplayEff(Math.max(0, s.rawFinal * rel)),
    isWinner: i === 0,
  }))

  const runnerUp: EffectivenessRunnerUp | null =
    second && second.a.id !== best.a.id
      ? {
          archetypeId: second.a.id,
          archetypeLabel: second.a.label,
          score: byArchetype[1]?.percent ?? round1(second.rawFinal * rel),
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
    byArchetype,
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
