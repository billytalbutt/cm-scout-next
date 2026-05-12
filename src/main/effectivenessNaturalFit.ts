import type { PlayerRecord } from './database/types'
import { EFFECTIVENESS_ARCHETYPES } from '../shared/effectivenessEngine'
import {
  isAttackingMidfielder,
  isDefender,
  isDefensiveMidfielder,
  isForward,
  isGoalkeeper,
  isMidfielder,
  isStriker,
  isSweeper,
  isWingBack,
} from './cmScoutRating'

/**
 * Whether an effectiveness archetype should be scored for this player.
 * Uses the same natural-position threshold (>14) as CM Scout suitability so we do not
 * credit e.g. outfielders on the GK recipe or keepers on the ST recipe.
 */
export function archetypeNaturalFit(archetypeId: string, p: PlayerRecord): boolean {
  switch (archetypeId) {
    case 'gk':
      return isGoalkeeper(p)
    case 'dc':
      return isSweeper(p) || isDefender(p)
    case 'wb':
      return isWingBack(p)
    case 'dmc':
      return isDefensiveMidfielder(p)
    case 'mc':
      return isMidfielder(p)
    case 'amw':
      return isAttackingMidfielder(p) && (p.left_side > 14 || p.right_side > 14)
    case 'amc':
      return (
        isAttackingMidfielder(p) &&
        (p.centre_side > 14 || (p.left_side <= 14 && p.right_side <= 14))
      )
    case 'st':
      return isForward(p) || isStriker(p)
    default:
      return false
  }
}

/** Archetype ids that pass the natural-position gate (may be empty for odd regens). */
export function eligibleEffectivenessArchetypeIds(p: PlayerRecord): Set<string> {
  const ids = new Set<string>()
  for (const a of EFFECTIVENESS_ARCHETYPES) {
    if (archetypeNaturalFit(a.id, p)) ids.add(a.id)
  }
  return ids
}
