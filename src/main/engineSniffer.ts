/**
 * Heuristic “engine meta” filters for CM 01/02 — **not** reverse‑engineered bytecode.
 *
 * Community lore: the match engine is harsh below ~17–18 on key stats; **19–20** are disproportionately strong.
 * Raw bytes can exceed 20 in editors / rare saves — `atLeast` treats **21+** as elite overflow.
 *
 * Thresholds read **on‑disk** `player.dat` / `staff.dat` bytes (same as the rest of this app). Where noted, “hidden”
 * style fields include player **consistency** / **important matches** and staff **determination**, **professionalism**,
 * **pressure** (GK), **adaptability** (assist path) — not the full CM Scout Intrinsic / Eff engine matrix.
 * Tuned so real world‑class CMs / AMs (e.g. Xavi‑shaped profiles) can match **Assist prospect** without needing
 * every mental at 19; **Striker finisher** favours elite ST/FC including poacher shapes (pace/finishing spine, softer flair/dribbling).
 */
import type { UiPlayerRow } from './database/types'
import { ENGINE_META_PROFILE_IDS, type EngineMetaProfileId } from '../shared/engineMetaProfileCatalog'
import { matchesMetaProfile } from './engineMetaProfiles'
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

const BASE_ENGINE_SNIFFER_IDS = [
  'assist_prospect',
  'striker_finisher',
  'goalkeeper',
  'defender',
  'defensive_mid',
  'attacking_mid',
] as const

export type EngineSnifferId = (typeof BASE_ENGINE_SNIFFER_IDS)[number] | EngineMetaProfileId

export const ENGINE_SNIFFER_IDS: readonly EngineSnifferId[] = [
  ...BASE_ENGINE_SNIFFER_IDS,
  ...ENGINE_META_PROFILE_IDS,
]

/** Forum / editor lore: intrinsic-style values often shown as 21+ in third-party tools. */
const OVERFLOW = 21

/** Pass if elite floor met, or raw overflow (21+) which is stronger than a capped 20. */
function atLeast(v: number, min: number): boolean {
  return v >= OVERFLOW || v >= min
}

function countAtLeast(vals: readonly number[], floor: number): number {
  return vals.filter((v) => v >= OVERFLOW || v >= floor).length
}

/**
 * Assist / playmaker prospect: MC‑shaped distributors (not lone ST/GK), strong mentals + passing spine,
 * set‑piece outlet, legs and hiddens in a plausible “engine cares” band. Softer than the original 18/19 wall
 * so real 2001‑database elites match.
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
    (isDefensiveMidfielder(p) && atLeast(p.passing, 17))
  if (!distributor) return false

  const brainDelivery = [p.decisions, p.anticipation, p.passing, p.technique, p.creativity] as const

  /**
   * Technique + teamwork “hub” (e.g. Xavi): high assist output with passing/creativity merely strong, not 17+.
   * Community lore stresses decisions / anticipation / teamwork / technique for central distribution.
   */
  const techniqueTeamworkHub =
    atLeast(p.technique, 18) &&
    atLeast(p.teamwork, 18) &&
    atLeast(p.passing, 15) &&
    atLeast(p.creativity, 13) &&
    atLeast(p.decisions, 15) &&
    atLeast(p.anticipation, 15)
  if (techniqueTeamworkHub) {
    if (!atLeast(p.corners, 14) && !atLeast(p.free_kicks, 14)) return false
    if (!atLeast(p.stamina, 15) || !atLeast(p.balance, 15)) return false
    if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 13)) return false
    if (!atLeast(s.adaptability, 14)) return false
    return true
  }

  /** Still‑rare “monster” shortcut: any brain stat 22+ with coherent support. */
  if (brainDelivery.some((v) => v >= 22)) {
    if (!atLeast(p.teamwork, 16)) return false
    if (!atLeast(p.decisions, 15) || !atLeast(p.anticipation, 15)) return false
    if (!atLeast(p.passing, 16) || !atLeast(p.technique, 16) || !atLeast(p.creativity, 14)) return false
    if (!atLeast(p.corners, 13) && !atLeast(p.free_kicks, 13)) return false
    if (!atLeast(p.stamina, 15) || !atLeast(p.agility, 15) || !atLeast(p.balance, 15)) return false
    if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 15)) return false
    if (!atLeast(s.adaptability, 15)) return false
    return true
  }

  if (!atLeast(p.decisions, 16) || !atLeast(p.anticipation, 16) || !atLeast(p.teamwork, 17)) return false
  if (!atLeast(p.passing, 16) || !atLeast(p.technique, 17) || !atLeast(p.creativity, 14)) return false
  if (!atLeast(p.corners, 15) && !atLeast(p.free_kicks, 15)) return false
  if (!atLeast(p.stamina, 16) || !atLeast(p.agility, 16) || !atLeast(p.balance, 16)) return false
  if (!atLeast(p.consistency, 16) || !atLeast(p.important_matches, 16)) return false
  if (!atLeast(s.adaptability, 16)) return false

  const strongBrain = countAtLeast(brainDelivery, 18)
  const anyOverflow = brainDelivery.some((v) => v >= OVERFLOW)
  const needStrong = anyOverflow ? 2 : p.creativity >= 16 ? 3 : 2
  if (strongBrain < needStrong) return false

  return true
}

/**
 * Finisher lane: ST / FC — **pace, burst, finishing, movement, technique** as the spine. Flair / dribbling are
 * soft floors so poacher‑shaped elites (e.g. Tsigalko‑style profiles with modest flair) still match.
 */
export function matchesStrikerFinisher(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (isGoalkeeper(p)) return false
  if (!isStriker(p) && !isForward(p)) return false

  const core = [p.pace, p.acceleration, p.finishing, p.off_the_ball, p.technique] as const
  const maxCore = Math.max(...core)

  if (maxCore >= 22) {
    for (const v of core) {
      if (!atLeast(v, 15)) return false
    }
    if (!atLeast(p.balance, 15)) return false
    if (!atLeast(p.consistency, 14) || !atLeast(p.important_matches, 14)) return false
    if (!atLeast(s.determination, 15)) return false
    return true
  }

  const anyCoreOverflow = core.some((v) => v >= OVERFLOW)

  if (anyCoreOverflow) {
    for (const v of core) {
      if (!atLeast(v, 15)) return false
    }
    if (countAtLeast(core, 18) < 2) return false
  } else {
    for (const v of core) {
      if (!atLeast(v, 16)) return false
    }
    if (countAtLeast(core, 18) < 3) return false
  }

  if (!atLeast(p.balance, 15) || !atLeast(p.dribbling, 14)) return false
  if (!atLeast(p.flair, 14)) return false
  if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 15)) return false
  if (!atLeast(s.determination, 16)) return false

  return true
}

/** Shot‑stopper / sweeper‑keeper shape — natural GK only. */
export function matchesGoalkeeperMeta(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (!isGoalkeeper(p)) return false
  if (!atLeast(p.handling, 16) || !atLeast(p.reflexes, 16) || !atLeast(p.one_on_ones, 15)) return false
  if (!atLeast(p.positioning, 15) || !atLeast(p.anticipation, 15) || !atLeast(p.decisions, 15)) return false
  if (!atLeast(p.agility, 14) || !atLeast(p.jumping, 14)) return false
  if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 14)) return false
  if (!atLeast(s.determination, 15) || !atLeast(s.professionalism, 14) || !atLeast(s.pressure, 13)) return false
  return true
}

/** Centre‑back / libero (Nesta‑style): defensive natural, marking + tackling + anticipation spine. */
export function matchesDefenderNesta(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (isGoalkeeper(p)) return false
  if (!(isDefender(p) || isSweeper(p))) return false
  if (isStriker(p) || isForward(p)) return false

  if (!atLeast(p.marking, 16) || !atLeast(p.tackling, 16) || !atLeast(p.positioning, 16)) return false
  if (!atLeast(p.anticipation, 16) || !atLeast(p.bravery, 15) || !atLeast(p.heading, 15)) return false
  if (!atLeast(p.strength, 15) || !atLeast(p.jumping, 15) || !atLeast(p.pace, 14)) return false
  if (!atLeast(p.balance, 15)) return false
  if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 14)) return false
  if (!atLeast(s.determination, 15) || !atLeast(s.professionalism, 14)) return false
  return true
}

/** Holding / destroyer DM — natural DMC, legs + distribution floor. */
export function matchesDefensiveMid(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (!isDefensiveMidfielder(p)) return false

  if (!atLeast(p.tackling, 16) || !atLeast(p.positioning, 16)) return false
  if (!atLeast(p.marking, 15) || !atLeast(p.work_rate, 16) || !atLeast(p.stamina, 16)) return false
  if (!atLeast(p.passing, 15) || !atLeast(p.decisions, 16) || !atLeast(p.anticipation, 15)) return false
  if (!atLeast(p.teamwork, 16) || !atLeast(p.aggression, 14)) return false
  if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 14)) return false
  if (!atLeast(s.determination, 15) || !atLeast(s.professionalism, 14)) return false
  return true
}

/** Central / wide AM creator — natural AMC bucket, not lone ST. */
export function matchesAttackingMid(row: UiPlayerRow): boolean {
  const p = row.player
  const s = row.staff
  if (!isAttackingMidfielder(p)) return false
  if (isStriker(p)) return false

  if (!atLeast(p.creativity, 16) || !atLeast(p.technique, 16) || !atLeast(p.passing, 16)) return false
  if (!atLeast(p.decisions, 16) || !atLeast(p.anticipation, 15)) return false
  if (!atLeast(p.off_the_ball, 15) || !atLeast(p.flair, 15)) return false
  if (!atLeast(p.stamina, 15) || !atLeast(p.balance, 15)) return false
  if (!atLeast(p.consistency, 15) || !atLeast(p.important_matches, 14)) return false
  if (!atLeast(s.determination, 15) || !atLeast(s.professionalism, 14)) return false
  return true
}

export function matchesEngineSniffer(row: UiPlayerRow, id: EngineSnifferId): boolean {
  switch (id) {
    case 'assist_prospect':
      return matchesAssistProspect(row)
    case 'striker_finisher':
      return matchesStrikerFinisher(row)
    case 'goalkeeper':
      return matchesGoalkeeperMeta(row)
    case 'defender':
      return matchesDefenderNesta(row)
    case 'defensive_mid':
      return matchesDefensiveMid(row)
    case 'attacking_mid':
      return matchesAttackingMid(row)
    default:
      if ((ENGINE_META_PROFILE_IDS as readonly string[]).includes(id as string)) {
        return matchesMetaProfile(row, id as EngineMetaProfileId)
      }
      return false
  }
}
