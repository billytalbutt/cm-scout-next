/**
 * Heuristic “engine meta” filters for CM 01/02 — **not** reverse‑engineered bytecode.
 *
 * Community lore: the match engine is harsh below ~17–18 on key stats; **19–20** are disproportionately strong
 * (often described as non‑linear vs 15–16). Edited / rare saves can store **raw bytes above 20** (e.g. 23–24 in
 * editors) for a few legends — those are treated here as **overflow** (`>= 21`) and satisfy the corresponding
 * “elite” tier without capping at 20.
 *
 * Thresholds read **on‑disk** `player.dat` / `staff.dat` bytes (same as the rest of this app).
 */
import type { UiPlayerRow } from './database/types'
import {
  isAttackingMidfielder,
  isDefensiveMidfielder,
  isForward,
  isGoalkeeper,
  isMidfielder,
  isStriker,
  isWingBack,
} from './cmScoutRating'

export type EngineSnifferId = 'assist_prospect' | 'striker_finisher'

/** Forum / editor lore: intrinsic-style values often shown as 21+ in third-party tools. */
const OVERFLOW = 21

/** Pass if elite floor met, or raw overflow (21+) which is stronger than a capped 20. */
function atLeast(v: number, min: number): boolean {
  return v >= OVERFLOW || v >= min
}

/**
 * “Assist monster” (strict): mental spine 18+, delivery 18+, legs / hidden 17+, dead-ball outlet; three of the five
 * brain/delivery stats at 19+ unless 21+ overflow (relaxed) or 22+ “super overflow” (short path). Excludes lone ST.
 */
export function matchesAssistProspect(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (isGoalkeeper(p)) return false
  if (isStriker(p)) return false

  const distributor =
    isMidfielder(p) ||
    isAttackingMidfielder(p) ||
    isWingBack(p) ||
    isForward(p) ||
    (isDefensiveMidfielder(p) && atLeast(p.passing, 18))
  if (!distributor) return false

  const brainDelivery = [p.decisions, p.anticipation, p.passing, p.technique, p.creativity]
  if (brainDelivery.some((v) => v >= 22)) {
    if (!atLeast(p.teamwork, 17)) return false
    if (!atLeast(p.decisions, 16) || !atLeast(p.anticipation, 16)) return false
    if (!atLeast(p.passing, 17) || !atLeast(p.technique, 17) || !atLeast(p.creativity, 15)) return false
    if (!atLeast(p.corners, 14) && !atLeast(p.free_kicks, 14)) return false
    if (!atLeast(p.stamina, 16) || !atLeast(p.agility, 16) || !atLeast(p.balance, 16)) return false
    if (!atLeast(p.consistency, 16) || !atLeast(p.important_matches, 16)) return false
    if (!atLeast(s.adaptability, 16)) return false
    return true
  }

  if (!atLeast(p.decisions, 18) || !atLeast(p.anticipation, 18) || !atLeast(p.teamwork, 18)) return false
  if (!atLeast(p.passing, 18) || !atLeast(p.technique, 18) || !atLeast(p.creativity, 17)) return false
  if (!atLeast(p.corners, 16) && !atLeast(p.free_kicks, 16)) return false
  if (!atLeast(p.stamina, 17) || !atLeast(p.agility, 17) || !atLeast(p.balance, 17)) return false
  if (!atLeast(p.consistency, 17) || !atLeast(p.important_matches, 17)) return false
  if (!atLeast(s.adaptability, 17)) return false

  const at19 = brainDelivery.filter((v) => v >= 19 || v >= OVERFLOW).length
  const anyOverflow = brainDelivery.some((v) => v >= OVERFLOW)
  if (anyOverflow) {
    if (!atLeast(p.decisions, 16) || !atLeast(p.anticipation, 16) || !atLeast(p.teamwork, 17)) return false
    if (!atLeast(p.passing, 17) || !atLeast(p.technique, 17) || !atLeast(p.creativity, 16)) return false
    if (at19 < 2) return false
  } else if (at19 < 3) return false

  return true
}

/**
 * Tsigalko‑lane finisher (strict): forward/ST only; core six all 18+ with five at 19+, unless any raw is 21+ (softer
 * floors + four at 19+) or any core is 22+ (“super overflow” — lenient floors, still striker-shaped).
 */
export function matchesStrikerFinisher(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (isGoalkeeper(p)) return false
  if (!isStriker(p) && !isForward(p)) return false

  const core = [p.pace, p.acceleration, p.finishing, p.off_the_ball, p.flair, p.technique] as const
  const maxCore = Math.max(...core)

  /** One or more “super” raw values (22+) — forum lore: these are the real engine outliers. */
  if (maxCore >= 22) {
    for (const v of core) {
      if (!atLeast(v, 16)) return false
    }
    if (!atLeast(p.balance, 17) || !atLeast(p.dribbling, 17)) return false
    if (!atLeast(p.consistency, 16) || !atLeast(p.important_matches, 16)) return false
    if (!atLeast(s.determination, 17)) return false
    return true
  }

  const anyCoreOverflow = core.some((v) => v >= OVERFLOW)

  if (anyCoreOverflow) {
    for (const v of core) {
      if (!atLeast(v, 17)) return false
    }
    const at19 = core.filter((v) => v >= 19 || v >= OVERFLOW).length
    if (at19 < 4) return false
  } else {
    for (const v of core) {
      if (!atLeast(v, 18)) return false
    }
    const at19 = core.filter((v) => v >= 19).length
    if (at19 < 5) return false
  }

  if (!atLeast(p.balance, 18) || !atLeast(p.dribbling, 18)) return false
  if (!atLeast(p.consistency, 17) || !atLeast(p.important_matches, 17)) return false
  if (!atLeast(s.determination, 18)) return false

  return true
}

export function matchesEngineSniffer(row: UiPlayerRow, id: EngineSnifferId): boolean {
  switch (id) {
    case 'assist_prospect':
      return matchesAssistProspect(row)
    case 'striker_finisher':
      return matchesStrikerFinisher(row)
    default:
      return true
  }
}
