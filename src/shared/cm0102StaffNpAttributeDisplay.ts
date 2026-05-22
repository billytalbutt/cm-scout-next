/**
 * In-game 1–20 display for `nonplayer.dat` sbyte attributes (staff coaching profile).
 * Stored bytes are “intrinsic” values; the game scales them with backroom CA (`CurrentAbility`),
 * same family of formulas as player CA18 cosmetic attrs (CM Scout / CM0102Patcher Scouter).
 */
import {
  highConvert,
  highConvertUncapped,
  type AttrDisplayBlock,
} from './cm0102AttributeDisplay'

export type StaffNpAttrKey =
  | 'attacking'
  | 'business'
  | 'coaching'
  | 'coachingGks'
  | 'coachingTechnique'
  | 'directness'
  | 'discipline'
  | 'freeRoles'
  | 'interference'
  | 'judgement'
  | 'judgingPotential'
  | 'manHandling'
  | 'marking'
  | 'motivating'
  | 'offside'
  | 'patience'
  | 'physiotherapy'
  | 'pressing'
  | 'resources'
  | 'tactics'
  | 'youngsters'

/** How a non-player attribute byte is turned into the on-screen 1–20 value. */
export type StaffNpConvertMode =
  | 'raw'
  | 'high'
  | 'highRounded'
  | 'highRoundedMinusOne'
  | 'caDiv25'
  | 'caDiv35Trunc'
  | 'caDiv35Rounded'

const MODE_BY_KEY: Record<StaffNpAttrKey, StaffNpConvertMode> = {
  attacking: 'raw',
  business: 'raw',
  coaching: 'highRounded',
  coachingGks: 'highRounded',
  coachingTechnique: 'raw',
  directness: 'raw',
  discipline: 'raw',
  freeRoles: 'raw',
  interference: 'raw',
  judgement: 'highRounded',
  judgingPotential: 'highRounded',
  manHandling: 'raw',
  marking: 'raw',
  motivating: 'highRounded',
  offside: 'raw',
  patience: 'raw',
  physiotherapy: 'highRounded',
  pressing: 'raw',
  resources: 'raw',
  tactics: 'highRounded',
  youngsters: 'raw',
}

/** When `resources` is high it is shown as man-management; otherwise scale `manHandling` with CA. */
export const STAFF_MAN_MANAGEMENT_RESOURCES_RAW_THRESHOLD = 14

function clamp20(v: number): number {
  if (v < 1) return 1
  if (v > 20) return 20
  return v
}

function staffNpQuadraticConvert(
  currentAbility: number,
  intrinsic: number,
  caDivisor: number,
  round: boolean,
): number {
  const ca = Number.isFinite(currentAbility) ? currentAbility : 0
  const i = Number.isFinite(intrinsic) ? intrinsic : 0
  const d = i / 10 + ca / caDivisor + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return round ? Math.round(r) : Math.trunc(r)
}

/** Quadratic cosmetic convert with a custom CA divisor (tactical knowledge). */
export function staffNpCaDivConvert(
  currentAbility: number,
  intrinsic: number,
  caDivisor: number,
): number {
  return staffNpQuadraticConvert(currentAbility, intrinsic, caDivisor, false)
}

function staffNpHighRounded(currentAbility: number, intrinsic: number, minusOne: boolean): number {
  let v = highConvert(currentAbility, intrinsic)
  if (minusOne && v > 1) v -= 1
  return clamp20(v)
}

/** In-game man management (Pomaski-style high `resources` byte, else CA-scaled `manHandling`). */
export function staffManManagementInGame(
  currentAbility: number,
  manHandling: number,
  resources: number,
): number {
  const res = Number.isFinite(resources) ? resources : 0
  if (res >= STAFF_MAN_MANAGEMENT_RESOURCES_RAW_THRESHOLD) return clamp20(res)
  return staffNpHighRounded(currentAbility, manHandling, false)
}

/** Elite coaches with very low tactics byte keep ca÷35 trunc (Pomaski raw 1 @ CA 182 → 13 in-game). */
export const STAFF_TACTICS_CA35_ELITE_CA_MIN = 175

/** CM only uses the ca÷35 / ca÷20 low-intrinsic paths for 0–3 on disk (not negative sentinels). */
function staffTacticsLowIntrinsic(raw: number): boolean {
  return Number.isFinite(raw) && raw >= 0 && raw <= 3
}

/** Quadratic base before CM’s typical +5 tactical-knowledge display offset. */
function staffTacticsBase(currentAbility: number, intrinsic: number): number {
  const raw = Number.isFinite(intrinsic) ? intrinsic : 0
  const ca = Number.isFinite(currentAbility) ? currentAbility : 0
  if (staffTacticsLowIntrinsic(raw) && ca >= STAFF_TACTICS_CA35_ELITE_CA_MIN) {
    return staffNpQuadraticConvert(ca, raw, 35, false)
  }
  if (staffTacticsLowIntrinsic(raw)) {
    return staffNpQuadraticConvert(ca, raw, 20, true)
  }
  return staffNpQuadraticConvert(ca, raw, 25, true)
}

/**
 * Tactical knowledge on the staff profile.
 * Validated on Pomaski (CA 182, raw 1 → 13) and Malkin (CA 186, raw 5 → 17): mid/high intrinsics
 * use ca÷25; when that base is still under 15, CM shows +5 more. Elite 0–3 @ high CA uses ca÷35.
 */
export function staffTacticsInGame(currentAbility: number, intrinsic: number): number {
  const raw = Number.isFinite(intrinsic) ? intrinsic : 0
  const ca = Number.isFinite(currentAbility) ? currentAbility : 0
  const base = staffTacticsBase(ca, raw)
  if (staffTacticsLowIntrinsic(raw) && ca >= STAFF_TACTICS_CA35_ELITE_CA_MIN && base >= 12) {
    return base
  }
  if (base >= 15) return base
  return clamp20(base + 5)
}

export function staffNpConvertMode(key: string): StaffNpConvertMode {
  return MODE_BY_KEY[key as StaffNpAttrKey] ?? 'raw'
}

/** On-screen value for one non-player coaching attribute. */
export function staffNpAttrInGame(
  key: string,
  intrinsic: number,
  currentAbility: number,
  extra?: { manHandling?: number; resources?: number },
): number {
  if (key === 'manHandling' && extra?.manHandling != null && extra?.resources != null) {
    return staffManManagementInGame(currentAbility, extra.manHandling, extra.resources)
  }
  if (key === 'tactics') {
    return staffTacticsInGame(currentAbility, intrinsic)
  }
  const mode = staffNpConvertMode(key)
  const ca = Number.isFinite(currentAbility) ? currentAbility : 0
  const raw = Number.isFinite(intrinsic) ? intrinsic : 0
  switch (mode) {
    case 'high':
      return highConvert(ca, raw)
    case 'highRounded':
      return staffNpHighRounded(ca, raw, false)
    case 'highRoundedMinusOne':
      return staffNpHighRounded(ca, raw, true)
    case 'caDiv25':
      return staffNpQuadraticConvert(ca, raw, 25, false)
    case 'caDiv35Trunc':
      return staffNpQuadraticConvert(ca, raw, 35, false)
    case 'caDiv35Rounded':
      return staffNpQuadraticConvert(ca, raw, 35, true)
    default:
      return clamp20(raw)
  }
}

export function staffNpAttrDisplay(
  key: string,
  intrinsic: number,
  currentAbility: number,
  extra?: { manHandling?: number; resources?: number },
): AttrDisplayBlock {
  const raw = Number.isFinite(intrinsic) ? intrinsic : 0
  const inGame = staffNpAttrInGame(key, raw, currentAbility, extra)
  const mode = staffNpConvertMode(key)
  let inGameUncapped = raw
  if (key === 'manHandling' && extra?.manHandling != null && extra?.resources != null) {
    inGameUncapped = staffManManagementInGame(currentAbility, extra.manHandling, extra.resources)
  } else if (key === 'tactics') {
    inGameUncapped = staffTacticsInGame(currentAbility, raw)
  } else if (mode === 'high' || mode === 'highRounded' || mode === 'highRoundedMinusOne') {
    const unc = highConvertUncapped(currentAbility, raw)
    inGameUncapped =
      mode === 'highRoundedMinusOne' && unc > 1 ? unc - 1 : mode === 'highRounded' ? Math.round(unc) : unc
  } else if (mode === 'caDiv25' || mode === 'caDiv35Trunc' || mode === 'caDiv35Rounded') {
    inGameUncapped = staffNpQuadraticConvert(
      currentAbility,
      raw,
      mode === 'caDiv25' ? 25 : 35,
      mode === 'caDiv35Rounded',
    )
  }
  return {
    raw,
    inGame,
    inGameUncapped,
    inMatch: inGame,
  }
}
