/**
 * “DNA” meta-profiles — **heuristic** shapes that often outperform a naive read of the same bars.
 * Used for grid filter + profile chips; not decompiled EXE logic.
 */
import type { UiPlayerRow } from './database/types'
import {
  ENGINE_META_PROFILE_IDS,
  type EngineMetaProfileId,
} from '../shared/engineMetaProfileCatalog'
import {
  isAttackingMidfielder,
  isDefender,
  isDefensiveMidfielder,
  isForward,
  isGoalkeeper,
  isStriker,
  isSweeper,
  isWingBack,
} from './cmScoutRating'

export { ENGINE_META_PROFILE_IDS, type EngineMetaProfileId } from '../shared/engineMetaProfileCatalog'

const OVERFLOW = 21

function atLeast(v: number, min: number): boolean {
  return v >= OVERFLOW || v >= min
}

/** Central midfield lane: `midfielder` natural on centre, not DMC/GK/ST/WB. */
function naturalMcHub(p: ReturnType<typeof rowPlayer>): boolean {
  if (isGoalkeeper(p) || isStriker(p)) return false
  if (isWingBack(p) || isDefensiveMidfielder(p)) return false
  return p.midfielder > 14 && p.centre_side > 14
}

function rowPlayer(row: UiPlayerRow) {
  return row.player
}

/** Xavi-shaped: mentals + technique lead; passing/creativity “good” not necessarily 18+. */
export function matchesMetaMcRegulator(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!naturalMcHub(p)) return false

  if (!atLeast(p.technique, 16) || !atLeast(p.teamwork, 16)) return false
  if (!atLeast(p.decisions, 16) || !atLeast(p.anticipation, 16)) return false
  if (p.passing > 17 && p.creativity > 16) return false
  if (!atLeast(p.passing, 14) || !atLeast(p.creativity, 12)) return false
  if (!atLeast(p.stamina, 15) || !atLeast(p.balance, 14)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

/** Classic high-touch MC: passing + creativity + legs (forum “assist king” lane). */
export function matchesMetaMcVolume(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!naturalMcHub(p)) return false

  if (!atLeast(p.passing, 17) || !atLeast(p.creativity, 16)) return false
  if (!atLeast(p.stamina, 16) || !atLeast(p.work_rate, 15)) return false
  if (!atLeast(p.decisions, 15) || !atLeast(p.technique, 16)) return false
  if (!atLeast(s.determination, 15)) return false
  return true
}

export function matchesMetaDmcAnchor(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isDefensiveMidfielder(p)) return false
  if (!atLeast(p.tackling, 17) || !atLeast(p.marking, 16)) return false
  if (!atLeast(p.aggression, 15) || !atLeast(p.work_rate, 16)) return false
  if (!atLeast(p.stamina, 16) || !atLeast(p.strength, 15)) return false
  if (!atLeast(p.positioning, 16)) return false
  if (!atLeast(s.determination, 15)) return false
  return true
}

export function matchesMetaDmcRegista(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isDefensiveMidfielder(p)) return false
  if (!atLeast(p.passing, 16) || !atLeast(p.anticipation, 16) || !atLeast(p.decisions, 16)) return false
  if (p.tackling >= 17 && p.marking >= 17) return false
  if (!atLeast(p.creativity, 10)) return false
  if (!atLeast(p.stamina, 15) || !atLeast(p.teamwork, 15)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

/** Nesta still wins; reader DC: positioning/anticipation first, tackling “only” good. */
export function matchesMetaDcReader(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (isGoalkeeper(p) || isStriker(p) || isForward(p)) return false
  if (!(isDefender(p) || isSweeper(p))) return false

  if (!atLeast(p.anticipation, 17) || !atLeast(p.positioning, 17)) return false
  if (!atLeast(p.decisions, 15)) return false
  if (p.tackling >= 17 && p.marking >= 17) return false
  if (!atLeast(p.tackling, 14) || !atLeast(p.marking, 14)) return false
  if (!atLeast(p.pace, 13)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

export function matchesMetaDcLiberoPasser(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  if (isGoalkeeper(p) || isStriker(p) || isForward(p)) return false
  if (!(isDefender(p) || isSweeper(p))) return false

  if (!atLeast(p.passing, 15) || !atLeast(p.technique, 15) || !atLeast(p.decisions, 15)) return false
  if (!atLeast(p.anticipation, 16)) return false
  if (!atLeast(p.positioning, 15)) return false
  return true
}

export function matchesMetaStPoacher(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isStriker(p) && !isForward(p)) return false
  if (!atLeast(p.finishing, 16) || !atLeast(p.off_the_ball, 16) || !atLeast(p.anticipation, 15)) return false
  if (p.pace >= 17 && p.acceleration >= 17) return false
  if (!atLeast(p.technique, 14) || !atLeast(p.balance, 14)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

export function matchesMetaStTarget(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  if (!isStriker(p) && !isForward(p)) return false
  if (!atLeast(p.heading, 16) || !atLeast(p.strength, 16) || !atLeast(p.jumping, 15)) return false
  if (!atLeast(p.finishing, 14) || !atLeast(p.balance, 14)) return false
  if (!atLeast(p.anticipation, 14)) return false
  return true
}

export function matchesMetaWbMotor(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isWingBack(p)) return false
  if (!atLeast(p.stamina, 17) || !atLeast(p.natural_fitness, 14)) return false
  if (!atLeast(p.pace, 15) || !atLeast(p.work_rate, 16)) return false
  if (!atLeast(p.tackling, 14) || !atLeast(p.crossing, 14)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

/** AML/R or WB with carry threat — run-with-ball lane. */
export function matchesMetaWideCarrier(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  if (isGoalkeeper(p) || isStriker(p)) return false
  if (isWingBack(p)) {
    // wing-back wide carrier
  } else if (isAttackingMidfielder(p)) {
    if (p.left_side <= 14 && p.right_side <= 14) return false
  } else {
    return false
  }

  if (!atLeast(p.dribbling, 16) || !atLeast(p.acceleration, 15) || !atLeast(p.pace, 15)) return false
  if (!atLeast(p.technique, 15) || !atLeast(p.balance, 14)) return false
  if (!atLeast(p.flair, 14)) return false
  return true
}

/** AMC who lives on late runs — OTB/anticipation over raw creativity. */
export function matchesMetaAmcShadow(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isAttackingMidfielder(p) || isStriker(p)) return false
  if (p.centre_side <= 14) return false
  if (p.left_side > 14 || p.right_side > 14) return false

  if (!atLeast(p.off_the_ball, 17) || !atLeast(p.anticipation, 16)) return false
  if (p.creativity >= 17) return false
  if (!atLeast(p.finishing, 14) || !atLeast(p.stamina, 15)) return false
  if (!atLeast(p.decisions, 15) || !atLeast(p.technique, 15)) return false
  if (!atLeast(s.determination, 14)) return false
  return true
}

export function matchesMetaGkCommanding(row: UiPlayerRow): boolean {
  const p = rowPlayer(row)
  const s = row.staff
  if (!isGoalkeeper(p)) return false
  if (!atLeast(p.anticipation, 16) || !atLeast(p.decisions, 16) || !atLeast(p.positioning, 16)) return false
  if (!atLeast(p.handling, 15) || !atLeast(p.reflexes, 15)) return false
  if (!atLeast(p.one_on_ones, 14)) return false
  if (!atLeast(s.determination, 15) || !atLeast(s.pressure, 14)) return false
  return true
}

export function matchesMetaProfile(row: UiPlayerRow, id: EngineMetaProfileId): boolean {
  switch (id) {
    case 'meta_mc_regulator':
      return matchesMetaMcRegulator(row)
    case 'meta_mc_volume':
      return matchesMetaMcVolume(row)
    case 'meta_dmc_anchor':
      return matchesMetaDmcAnchor(row)
    case 'meta_dmc_regista':
      return matchesMetaDmcRegista(row)
    case 'meta_dc_reader':
      return matchesMetaDcReader(row)
    case 'meta_dc_libero_passer':
      return matchesMetaDcLiberoPasser(row)
    case 'meta_st_poacher':
      return matchesMetaStPoacher(row)
    case 'meta_st_target':
      return matchesMetaStTarget(row)
    case 'meta_wb_motor':
      return matchesMetaWbMotor(row)
    case 'meta_wide_carrier':
      return matchesMetaWideCarrier(row)
    case 'meta_amc_shadow':
      return matchesMetaAmcShadow(row)
    case 'meta_gk_commanding':
      return matchesMetaGkCommanding(row)
    default:
      return false
  }
}

export function collectMetaProfileIds(row: UiPlayerRow): EngineMetaProfileId[] {
  const out: EngineMetaProfileId[] = []
  for (const id of ENGINE_META_PROFILE_IDS) {
    if (matchesMetaProfile(row, id)) out.push(id)
  }
  return out
}

export function applyEngineMetaProfiles(rows: readonly UiPlayerRow[]): void {
  for (const row of rows) {
    if (row.staffIndex < 0) continue
    const ids = collectMetaProfileIds(row)
    row.engineMetaProfileIds = ids.length > 0 ? ids : undefined
  }
}
