import type { PlayerRecord, StaffRecord } from './database/types'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'

export type EliteEngineBadgeKind = 'finisher' | 'playmaker' | 'defender'

export type EliteEngineBadge = {
  kind: EliteEngineBadgeKind
  /** Short label for the star tooltip title */
  title: string
  /** One or two sentences: why they match the benchmark */
  detail: string
}

/** Tsigalko-style benchmark (demo fixture + community lore): at most two stats one point short, none two below. */
const FINISHER_TEMPLATE: Record<string, number> = {
  pace: 19,
  acceleration: 19,
  finishing: 20,
  off_the_ball: 19,
  agility: 16,
  jumping: 17,
  strength: 16,
  consistency: 17,
  technique: 19,
  important_matches: 17,
  determination: 18,
  professionalism: 17,
  flair: 19,
}

/** Nesta-style DC benchmark (illustrative high bar — tune against your saves). */
const DEFENDER_TEMPLATE: Record<string, number> = {
  positioning: 19,
  tackling: 19,
  pace: 17,
  heading: 18,
  jumping: 17,
  strength: 17,
  anticipation: 18,
  decisions: 17,
  consistency: 17,
  bravery: 17,
  determination: 19,
  teamwork: 16,
}

function matchesTemplate(get: (k: string) => number, tmpl: Record<string, number>, maxShort: number): boolean {
  let short = 0
  for (const [k, t] of Object.entries(tmpl)) {
    const v = get(k)
    if (v < t - 1) return false
    if (v < t) short++
  }
  return short <= maxShort
}

function mcRecipeKeys(): string[] {
  return ['passing', 'creativity', 'stamina', 'off_the_ball', 'work_rate', 'technique']
}

function amcRecipeKeys(): string[] {
  return ['creativity', 'off_the_ball', 'passing', 'decisions', 'anticipation', 'finishing']
}

function playmakerBench(get: (k: string) => number, winnerId: string): boolean {
  const keys = winnerId === 'mc' ? mcRecipeKeys() : winnerId === 'amc' ? amcRecipeKeys() : []
  if (!keys.length) return false
  let at14 = 0
  for (const k of keys) {
    const v = get(k)
    if (v < 14) return false
    if (v < 15) at14++
  }
  if (at14 > 3) return false
  if (get('decisions') < 15 || get('anticipation') < 15) return false
  if (get('determination') < 15 || get('consistency') < 14) return false
  if (get('teamwork') < 14 || get('professionalism') < 14) return false
  return true
}

/**
 * Extremely tight “engine god” row marker — only when the winning Eff archetype matches the template family.
 */
export function evaluateEliteEngineBadge(
  p: PlayerRecord,
  s: StaffRecord,
  winnerArchetypeId: string,
  effPercent: number | null,
): EliteEngineBadge | null {
  if (effPercent == null || winnerArchetypeId === 'unsure') return null
  const get = effectivenessAttrGetter(p, s)

  if (winnerArchetypeId === 'st') {
    if (!matchesTemplate(get, FINISHER_TEMPLATE, 2)) return null
    return {
      kind: 'finisher',
      title: 'Engine-tier finisher',
      detail:
        'Matches the Tsigalko-style benchmark: elite pace/finishing/off-the-ball, secondaries in range, and mentals/hiddens (consistency, important matches, determination, professionalism, flair) within at most two single-point dips vs the template.',
    }
  }

  if (winnerArchetypeId === 'dc') {
    if (!matchesTemplate(get, DEFENDER_TEMPLATE, 2)) return null
    return {
      kind: 'defender',
      title: 'Engine-tier defender',
      detail:
        'Matches the Nesta-style DC benchmark: dominant positioning/tackling with pace and aerial strength in range, plus mental/hidden support (anticipation, decisions, consistency, bravery, determination, teamwork) within at most two single-point dips.',
    }
  }

  if (winnerArchetypeId === 'mc' || winnerArchetypeId === 'amc') {
    if (!playmakerBench(get, winnerArchetypeId)) return null
    return {
      kind: 'playmaker',
      title: 'Engine-tier playmaker',
      detail:
        'Xavi-style check: every recipe stat for the winning MC/AMC role is 14+ with at most three at 14, decisions and anticipation 15+, determination 15+, consistency 14+, teamwork and professionalism 14+.',
    }
  }

  return null
}
