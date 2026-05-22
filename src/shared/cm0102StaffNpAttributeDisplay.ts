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
  | 'caDiv35Rounded'

const MODE_BY_KEY: Record<StaffNpAttrKey, StaffNpConvertMode> = {
  attacking: 'raw',
  business: 'raw',
  coaching: 'highRounded',
  coachingGks: 'highRoundedMinusOne',
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
  tactics: 'caDiv35Rounded',
  youngsters: 'raw',
}

/** In-game “Man management” uses `resources`, not the `manHandling` coaching byte. */
export const STAFF_MAN_MANAGEMENT_NP_FIELD = 'resources' as const

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

export function staffNpConvertMode(key: string): StaffNpConvertMode {
  return MODE_BY_KEY[key as StaffNpAttrKey] ?? 'raw'
}

/** On-screen value for one non-player coaching attribute. */
export function staffNpAttrInGame(
  key: string,
  intrinsic: number,
  currentAbility: number,
): number {
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
): AttrDisplayBlock {
  const raw = Number.isFinite(intrinsic) ? intrinsic : 0
  const inGame = staffNpAttrInGame(key, raw, currentAbility)
  const mode = staffNpConvertMode(key)
  let inGameUncapped = raw
  if (mode === 'high' || mode === 'highRounded' || mode === 'highRoundedMinusOne') {
    const unc = highConvertUncapped(currentAbility, raw)
    inGameUncapped =
      mode === 'highRoundedMinusOne' && unc > 1 ? unc - 1 : mode === 'highRounded' ? Math.round(unc) : unc
  } else if (mode === 'caDiv25' || mode === 'caDiv35Rounded') {
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
