import type { PlayerRecord, StaffRecord } from './database/types'
import { isSweeper } from './cmScoutRating'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'

export type EliteEngineBadgeKind =
  | 'finisher'
  | 'playmaker'
  | 'defender'
  | 'sweeper'
  | 'anchor_dm'
  | 'wing_back'
  | 'goalkeeper'
  | 'wide_attacker'

export type EliteEngineBadge = {
  kind: EliteEngineBadgeKind
  /** Short label for the star tooltip title */
  title: string
  /** One or two sentences: why they match the benchmark */
  detail: string
}

/** Community “elite finisher” benchmark: at most two stats one point short, none two below. */
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

/** Nesta-style DC benchmark (out-and-out centre-back). */
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

/** Libero-style sweeper (wins DC recipe but natural sweeper line): reading + distribution floor. */
const SWEEPER_TEMPLATE: Record<string, number> = {
  positioning: 19,
  tackling: 19,
  anticipation: 19,
  decisions: 18,
  pace: 16,
  heading: 17,
  jumping: 17,
  strength: 17,
  marking: 16,
  passing: 16,
  creativity: 14,
  consistency: 18,
  bravery: 16,
  determination: 19,
  teamwork: 17,
  professionalism: 16,
}

/** Destroyer anchor DM — wins the ball, covers ground, leads by example. */
const ANCHOR_DM_TEMPLATE: Record<string, number> = {
  positioning: 19,
  tackling: 19,
  stamina: 19,
  anticipation: 18,
  decisions: 18,
  strength: 18,
  work_rate: 18,
  aggression: 14,
  consistency: 17,
  bravery: 16,
  determination: 19,
  teamwork: 17,
  professionalism: 17,
}

/** Overlapping / elite wing-back: two-way legs, cross, and defensive bite. */
const WING_BACK_TEMPLATE: Record<string, number> = {
  pace: 18,
  acceleration: 18,
  tackling: 18,
  positioning: 17,
  stamina: 18,
  crossing: 17,
  work_rate: 18,
  determination: 18,
  natural_fitness: 17,
  consistency: 17,
  agility: 16,
  professionalism: 16,
  teamwork: 16,
}

/** Goalkeeper who owns the box and big moments — reflexes first, mentals locked in. */
const GOALKEEPER_TEMPLATE: Record<string, number> = {
  reflexes: 19,
  agility: 17,
  handling: 18,
  positioning: 18,
  bravery: 17,
  one_on_ones: 17,
  anticipation: 17,
  decisions: 16,
  consistency: 17,
  determination: 18,
  professionalism: 17,
  important_matches: 15,
}

/** Wide outlet / line-breaker on the flank: pace, dribble, service, engine. */
const WIDE_ATTACKER_TEMPLATE: Record<string, number> = {
  pace: 19,
  acceleration: 19,
  dribbling: 18,
  crossing: 17,
  off_the_ball: 18,
  flair: 18,
  technique: 18,
  stamina: 17,
  decisions: 16,
  anticipation: 16,
  determination: 17,
  consistency: 16,
  important_matches: 15,
  work_rate: 16,
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
        'Matches the elite finisher benchmark: pace/finishing/off-the-ball, secondaries in range, and mentals/hiddens (consistency, important matches, determination, professionalism, flair) within at most two single-point dips vs the template.',
    }
  }

  if (winnerArchetypeId === 'dc') {
    if (isSweeper(p)) {
      if (!matchesTemplate(get, SWEEPER_TEMPLATE, 2)) return null
      return {
        kind: 'sweeper',
        title: 'Engine-tier sweeper',
        detail:
          'Libero-style bar: positioning/tackling with elite anticipation/decisions, enough passing/creativity to step out, aerials and marking in range, plus determination/consistency/professionalism — at most two single-point dips vs the template (natural sweeper, DC recipe).',
      }
    }
    if (!matchesTemplate(get, DEFENDER_TEMPLATE, 2)) return null
    return {
      kind: 'defender',
      title: 'Engine-tier defender',
      detail:
        'Matches the Nesta-style DC benchmark: dominant positioning/tackling with pace and aerial strength in range, plus mental/hidden support (anticipation, decisions, consistency, bravery, determination, teamwork) within at most two single-point dips.',
    }
  }

  if (winnerArchetypeId === 'dmc') {
    if (!matchesTemplate(get, ANCHOR_DM_TEMPLATE, 2)) return null
    return {
      kind: 'anchor_dm',
      title: 'Engine-tier anchor DM',
      detail:
        'Anchor destroyer check: elite positioning/tackling/stamina with anticipation/decisions/strength, high work rate and leadership mentals — aggression floor reflects “nasty but controlled”; at most two single-point dips.',
    }
  }

  if (winnerArchetypeId === 'wb') {
    if (!matchesTemplate(get, WING_BACK_TEMPLATE, 2)) return null
    return {
      kind: 'wing_back',
      title: 'Engine-tier wing back',
      detail:
        'Two-way fullback bar: pace/acceleration/tackling with crossing and engine (stamina, work rate, natural fitness), consistency and professionalism in range — at most two single-point dips vs the template.',
    }
  }

  if (winnerArchetypeId === 'gk') {
    if (!matchesTemplate(get, GOALKEEPER_TEMPLATE, 2)) return null
    return {
      kind: 'goalkeeper',
      title: 'Engine-tier goalkeeper',
      detail:
        'Shot-stopper + organiser bar: reflexes/agility with handling/positioning/bravery and one-on-ones, anticipation/decisions, consistency/determination/professionalism — at most two single-point dips.',
    }
  }

  if (winnerArchetypeId === 'amw') {
    if (!matchesTemplate(get, WIDE_ATTACKER_TEMPLATE, 2)) return null
    return {
      kind: 'wide_attacker',
      title: 'Engine-tier wide attacker',
      detail:
        'Flank game-breaker bar: pace/acceleration/dribbling with crossing/off-the-ball/flair/technique, stamina and work rate, decisions/anticipation floor, consistency and professionalism — at most two single-point dips.',
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
