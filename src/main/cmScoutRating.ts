/**
 * CM Scout–style weighted % (`WeightsSet_CMScout.txt`, same weights as CM Scout / CM Scout Intrinsic).
 *
 * Values fed into the weighted sum are **in-game displayed** 1–20 for CA18 (`inGameCa18` from intrinsic + CA) and
 * **clamped raw bytes** for the other 30 attributes. That matches what players see on attribute bars and what classic
 * CM Scout’s headline % tracks on the same roster. (An alternative pipeline normalizes CA18 “in-match” helpers across
 * the whole database first — that compresses elites and was producing ~70s where CM Scout shows high 80s / 90s.)
 *
 * **Grid “CM Scout %”** = **BP**: max per-role score among positions the player is **natural for** (≥15), same rule
 * as “best regard position”. Injury proneness & dirtiness are inverted (`IsLessBetter`).
 */
import { inGameCa18, inMatchValue } from './database/attributes'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'
import { CM_SCOUT_WEIGHTS } from './cmScoutWeights'

const N_ATTR = 48
const N_POS = 7

/** First 18 attrs are CA18 (DataService.Attributes). */
export const ATTR_CA18: boolean[] = [...Array(18).fill(true), ...Array(30).fill(false)]

/** Injury proneness (23) and dirtiness (38): higher intrinsic is worse → flip for filters/rating. */
export const ATTR_LESS_BETTER: boolean[] = (() => {
  const a = Array<boolean>(48).fill(false)
  a[23] = true
  a[38] = true
  return a
})()

/** Raw intrinsic / stored byte for each attribute index (CMScoutIntrinsic order). */
export function intrinsicRawAt(i: number, p: PlayerRecord, s: StaffRecord): number {
  switch (i) {
    case 0:
      return p.anticipation
    case 1:
      return p.creativity
    case 2:
      return p.crossing
    case 3:
      return p.decisions
    case 4:
      return p.dribbling
    case 5:
      return p.finishing
    case 6:
      return p.heading
    case 7:
      return p.long_shots
    case 8:
      return p.marking
    case 9:
      return p.off_the_ball
    case 10:
      return p.passing
    case 11:
      return p.penalties
    case 12:
      return p.positioning
    case 13:
      return p.tackling
    case 14:
      return p.throw_ins
    case 15:
      return p.handling
    case 16:
      return p.one_on_ones
    case 17:
      return p.reflexes
    case 18:
      return p.acceleration
    case 19:
      return p.agility
    case 20:
      return p.balance
    case 21:
      return p.corners
    case 22:
      return p.flair
    case 23:
      return p.injury_proneness
    case 24:
      return p.jumping
    case 25:
      return p.natural_fitness
    case 26:
      return p.pace
    case 27:
      return p.free_kicks
    case 28:
      return p.stamina
    case 29:
      return p.strength
    case 30:
      return p.technique
    case 31:
      return p.work_rate
    case 32:
      return s.adaptability
    case 33:
      return p.aggression
    case 34:
      return s.ambition
    case 35:
      return p.bravery
    case 36:
      return p.consistency
    case 37:
      return s.determination
    case 38:
      return p.dirtiness
    case 39:
      return p.important_matches
    case 40:
      return p.influence
    case 41:
      return s.loyalty
    case 42:
      return s.pressure
    case 43:
      return s.professionalism
    case 44:
      return s.sportsmanship
    case 45:
      return p.teamwork
    case 46:
      return s.temperament
    case 47:
      return p.versatility
    default:
      return 0
  }
}

/** Raw intrinsic bytes in CM Scout attribute order (48), for grid / tools. */
export function intrinsicRaw48(p: PlayerRecord, s: StaffRecord): number[] {
  const out = new Array<number>(48)
  for (let i = 0; i < 48; i++) out[i] = intrinsicRawAt(i, p, s)
  return out
}

export function isGoalkeeper(p: PlayerRecord): boolean {
  return p.goalkeeper > 14
}
export function isSweeper(p: PlayerRecord): boolean {
  return p.sweeper > 14
}
export function isDefender(p: PlayerRecord): boolean {
  return p.defender > 14
}
export function isDefensiveMidfielder(p: PlayerRecord): boolean {
  return p.defensive_midfielder > 14
}
export function isMidfielder(p: PlayerRecord): boolean {
  return p.midfielder > 14 && !isDefensiveMidfielder(p) && !isAttackingMidfielder(p)
}
export function isAttackingMidfielder(p: PlayerRecord): boolean {
  return (
    (p.attacking_midfielder > 14 || p.wing_back > 14) &&
    !isDefensiveMidfielder(p) &&
    (p.attacker <= 14 || p.midfielder > 14)
  )
}
export function isForward(p: PlayerRecord): boolean {
  return (
    p.attacker > 14 &&
    (p.attacking_midfielder > 14 || p.left_side > 14 || p.right_side > 14 || p.free_role > 14)
  )
}
export function isStriker(p: PlayerRecord): boolean {
  return p.attacker > 14 && !isForward(p)
}
export function isWingBack(p: PlayerRecord): boolean {
  return (
    (p.midfielder > 14 || p.attacking_midfielder > 14 || p.wing_back > 14) &&
    (p.left_side > 14 || p.right_side > 14)
  )
}

export function ratingPositionSuitable(posIndex: number, p: PlayerRecord): boolean {
  switch (posIndex) {
    case 0:
      return isGoalkeeper(p)
    case 1:
      return isSweeper(p) || isDefender(p)
    case 2:
      return isDefensiveMidfielder(p)
    case 3:
      return isMidfielder(p)
    case 4:
      return isAttackingMidfielder(p)
    case 5:
      return isForward(p) || isStriker(p)
    case 6:
      return isWingBack(p)
    default:
      return false
  }
}

function norm1to20(v: number, minV: number, maxV: number): number {
  if (maxV <= minV) return Math.max(1, Math.min(20, Math.trunc(v)))
  let r = (20 * (v - minV)) / (maxV - minV) + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return Math.trunc(r)
}

export type Ca18Ranges = { intrMin: number[]; intrMax: number[]; matchMin: number[]; matchMax: number[] }

/** Build min/max over valid player rows for CA18 intrinsic and in-match raw (for normalization). */
export function buildCa18Ranges(rows: UiPlayerRow[]): Ca18Ranges {
  const intrMin = Array(18).fill(127)
  const intrMax = Array(18).fill(-128)
  const matchMin = Array(18).fill(127)
  const matchMax = Array(18).fill(-128)
  for (const row of rows) {
    const { player: p, staff: s } = row
    for (let j = 0; j < 18; j++) {
      const intr = intrinsicRawAt(j, p, s)
      if (intr < intrMin[j]) intrMin[j] = intr
      if (intr > intrMax[j]) intrMax[j] = intr
      const im = inMatchValue(p.current_ability, intr)
      if (im < matchMin[j]) matchMin[j] = im
      if (im > matchMax[j]) matchMax[j] = im
    }
  }
  return { intrMin, intrMax, matchMin, matchMax }
}

/** 48 × 1–20 for weighted CM Scout %: CA18 = on-screen display from CA + intrinsic; rest = clamped raw. */
export function scoutDisplayVector48(p: PlayerRecord, s: StaffRecord): number[] {
  const out: number[] = []
  let ca18j = 0
  for (let i = 0; i < N_ATTR; i++) {
    const intr = intrinsicRawAt(i, p, s)
    if (ATTR_CA18[i]) {
      out.push(inGameCa18(ca18j, p.current_ability, intr, p))
      ca18j++
    } else {
      let v = intr
      if (v < 1) v = 1
      else if (v > 20) v = 20
      out.push(v)
    }
  }
  return out
}

/** 48 in-match–normalized values (database-wide CA18 range map — kept for tooling / comparisons). */
export function inMatchNormalized48(p: PlayerRecord, s: StaffRecord, ranges: Ca18Ranges): number[] {
  const out: number[] = []
  const ca = p.current_ability
  let j = 0
  for (let i = 0; i < N_ATTR; i++) {
    const intr = intrinsicRawAt(i, p, s)
    if (ATTR_CA18[i]) {
      const inMatch = inMatchValue(ca, intr)
      const inNorm = norm1to20(inMatch, ranges.matchMin[j]!, ranges.matchMax[j]!)
      out.push(inNorm)
      j++
    } else {
      let v = intr
      if (v < 1) v = 1
      else if (v > 20) v = 20
      out.push(v)
    }
  }
  return out
}

function weightedRatingPercent(inNorm: number[], pos: number): number {
  let r = 0
  let n = 0
  for (let i = 0; i < N_ATTR; i++) {
    const w = CM_SCOUT_WEIGHTS[i]![pos] ?? 0
    if (!w) continue
    let v = inNorm[i]!
    if (ATTR_LESS_BETTER[i]) v = 21 - v
    r += (w * v) / 20
    n += w
  }
  if (!n) return 0
  return (100 * r) / n
}

/** Hypothetical CM Scout % in each weight column (all seven roles), same as Intrinsic per-column rating. */
export function cmScoutAllRolePercents(inNorm: number[]): number[] {
  const out: number[] = []
  for (let pos = 0; pos < N_POS; pos++) {
    out.push(Math.round(weightedRatingPercent(inNorm, pos) * 10) / 10)
  }
  return out
}

/** Best regard position: max rating among positions the player fits. */
export function cmScoutBpPercent(p: PlayerRecord, inNorm: number[]): number {
  let best = -1
  let anySuit = false
  for (let pos = 0; pos < N_POS; pos++) {
    if (!ratingPositionSuitable(pos, p)) continue
    anySuit = true
    const x = weightedRatingPercent(inNorm, pos)
    if (x > best) best = x
  }
  if (!anySuit) {
    for (let pos = 0; pos < N_POS; pos++) {
      const x = weightedRatingPercent(inNorm, pos)
      if (x > best) best = x
    }
  }
  return Math.round(best * 10) / 10
}

export function applyCmScoutRatings(rows: UiPlayerRow[]): void {
  const dataRows = rows.filter((r) => r.staffIndex >= 0)
  if (!dataRows.length) return
  for (const row of dataRows) {
    const norm = scoutDisplayVector48(row.player, row.staff)
    row.cmAttrNorm = norm
    row.cmScoutRolePercents = cmScoutAllRolePercents(norm)
    row.cmScoutRatingBp = cmScoutBpPercent(row.player, norm)
  }
}

/** For filters: compare attribute min (uses same flip as Intrinsic ShowPlayer). */
export function passesAttributeMins(inNorm: number[] | undefined, mins: (number | null | undefined)[]): boolean {
  if (!inNorm || !mins?.length) return true
  for (let i = 0; i < N_ATTR; i++) {
    const min = mins[i]
    if (min == null || min <= 0) continue
    let v = inNorm[i]!
    if (ATTR_LESS_BETTER[i]) v = 21 - v
    if (v < min) return false
  }
  return true
}

export function transferListedByClub(ts: number): boolean {
  return (ts & 1) === 1
}
export function transferListedByRequest(ts: number): boolean {
  return (ts & 8) === 8
}
export function listedForLoan(ts: number): boolean {
  return (ts & 2) === 2
}
