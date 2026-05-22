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
export type StaffNpConvertMode = 'raw' | 'high' | 'highMinusOne' | 'caDiv25' | 'caDiv35'

const MODE_BY_KEY: Record<StaffNpAttrKey, StaffNpConvertMode> = {
  attacking: 'raw',
  business: 'raw',
  coaching: 'high',
  coachingGks: 'highMinusOne',
  coachingTechnique: 'high',
  directness: 'raw',
  discipline: 'raw',
  freeRoles: 'raw',
  interference: 'raw',
  judgement: 'high',
  judgingPotential: 'high',
  manHandling: 'caDiv25',
  marking: 'raw',
  motivating: 'high',
  offside: 'raw',
  patience: 'raw',
  physiotherapy: 'high',
  pressing: 'raw',
  resources: 'raw',
  tactics: 'caDiv35',
  youngsters: 'raw',
}

function clamp20(v: number): number {
  if (v < 1) return 1
  if (v > 20) return 20
  return v
}

/** Quadratic cosmetic convert with a custom CA divisor (man management / tactics). */
export function staffNpCaDivConvert(
  currentAbility: number,
  intrinsic: number,
  caDivisor: number,
): number {
  const ca = Number.isFinite(currentAbility) ? currentAbility : 0
  const i = Number.isFinite(intrinsic) ? intrinsic : 0
  const d = i / 10 + ca / caDivisor + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return Math.trunc(r)
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
    case 'highMinusOne':
      return clamp20(highConvert(ca, raw) - 1)
    case 'caDiv25':
      return staffNpCaDivConvert(ca, raw, 25)
    case 'caDiv35':
      return staffNpCaDivConvert(ca, raw, 35)
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
  if (mode === 'high' || mode === 'highMinusOne') {
    const unc = highConvertUncapped(currentAbility, raw)
    inGameUncapped = mode === 'highMinusOne' ? unc - 1 : unc
  } else if (mode === 'caDiv25' || mode === 'caDiv35') {
    inGameUncapped = staffNpCaDivConvert(currentAbility, raw, mode === 'caDiv25' ? 25 : 35)
  }
  return {
    raw,
    inGame,
    inGameUncapped,
    inMatch: inGame,
  }
}
