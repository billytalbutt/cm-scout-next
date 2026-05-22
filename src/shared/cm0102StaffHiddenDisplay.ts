/**
 * Display semantics for staff "hidden" fields (`staff.dat` mentals + `nonplayer.dat` backroom bytes).
 *
 * CM01/02 rarely shows these on the staff profile. Community / CM0102Patcher notes:
 * - Mentals on `staff.dat` are 1–20 personality traits (like players).
 * - `coachingTechnique`, `formation`, `directness` are categorical (text in-game).
 * - `attacking`, `freeRoles`, `marking`, `offside`, `patience`, `pressing` are sbyte prefs;
 *   profile lines appear from ~15+ (we use 14, matching `cm0102StaffProfileText`).
 * - `business`, `interference`, `resources` are chairman-only (never on coach UI).
 * - Position fields (`goalKeeperPref` … `wingBackPref`) are int32; -1 = unset (not a rating of 1).
 */
import type { AttrDisplayBlock } from './cm0102AttributeDisplay'
import { otherAttrDisplay } from './cm0102AttributeDisplay'
import {
  coachingStyleLabel,
  preferredFormationLabel,
  PREFERENCE_THRESHOLD,
} from './cm0102StaffProfileText'

export { PREFERENCE_THRESHOLD as STAFF_TACTICAL_PREF_THRESHOLD }

/** `nonplayer.dat` int32 role suitability / preference (not shown on coach profile). */
export const STAFF_POSITION_PREF_KEYS = [
  'goalKeeperPref',
  'sweeperPref',
  'defenderPref',
  'defensiveMidfielderPref',
  'midfielderPref',
  'attackingMidfielderPref',
  'attackerPref',
  'wingBackPref',
] as const

export type StaffPositionPrefKey = (typeof STAFF_POSITION_PREF_KEYS)[number]

/** Tactical sbytes that only surface as profile lines when high enough. */
export const STAFF_TACTICAL_TRAIT_KEYS = [
  'attacking',
  'freeRoles',
  'marking',
  'offside',
  'patience',
  'pressing',
] as const

export type StaffTacticalTraitKey = (typeof STAFF_TACTICAL_TRAIT_KEYS)[number]

export const STAFF_CHAIRMAN_ONLY_KEYS = ['business', 'interference', 'resources'] as const

const TACTICAL_ACTIVE_PHRASE: Partial<Record<StaffTacticalTraitKey, string>> = {
  attacking: 'Favours attacking football',
  freeRoles: 'Encourages free roles',
  marking: 'Likes to deploy a man-marking system',
  offside: 'Likes to play the offside trap',
  patience: 'Favours patient build-up',
  pressing: 'Likes his players to close down the opposition',
}

/** Human label for position-pref int32 (player-style 0–20 suitability when set). */
export function staffPositionPrefLabel(raw: number): string {
  if (!Number.isFinite(raw) || raw < 0) return 'Not set'
  if (raw === 0) return 'No emphasis (0)'
  if (raw > 20) return `Unusual (${raw})`
  return `${raw}/20 suitability`
}

export function staffTacticalTraitLabel(key: StaffTacticalTraitKey, raw: number): string {
  const r = Number.isFinite(raw) ? raw : 0
  const active = r >= PREFERENCE_THRESHOLD
  const phrase = TACTICAL_ACTIVE_PHRASE[key]
  if (active && phrase) return phrase
  if (r <= 0) return 'Inactive'
  return `Inactive (${r}/20)`
}

export function staffChairmanTraitLabel(key: (typeof STAFF_CHAIRMAN_ONLY_KEYS)[number], raw: number): string {
  const r = Number.isFinite(raw) ? raw : 0
  const ig = r < 1 ? 1 : r > 20 ? 20 : r
  const names: Record<(typeof STAFF_CHAIRMAN_ONLY_KEYS)[number], string> = {
    business: 'Business',
    interference: 'Interference',
    resources: 'Resources',
  }
  return `${names[key]} ${ig}/20 (chairman only)`
}

/** Numeric value for staff browse min-filters (null = unset / not comparable). */
export function staffHiddenFilterValue(key: string, raw: number): number | null {
  if ((STAFF_POSITION_PREF_KEYS as readonly string[]).includes(key)) {
    if (!Number.isFinite(raw) || raw < 0) return null
    return raw
  }
  if (key === 'coachingTechnique' || key === 'formation') return Number.isFinite(raw) ? raw : null
  if ((STAFF_CHAIRMAN_ONLY_KEYS as readonly string[]).includes(key)) {
    return Number.isFinite(raw) ? raw : null
  }
  return Number.isFinite(raw) ? raw : null
}

export type StaffHiddenDisplay = AttrDisplayBlock & {
  /** When set, profile shows text instead of a 1–20 number (categorical / threshold / unset). */
  displayText?: string
}

/** Build profile cell display for one hidden staff / non-player field. */
export function staffHiddenAttrDisplay(key: string, raw: number): StaffHiddenDisplay {
  if (key === 'coachingTechnique') {
    const text = coachingStyleLabel(raw) ?? 'General'
    return {
      raw,
      inGame: 0,
      inGameUncapped: raw,
      inMatch: 0,
      displayText: text,
    }
  }
  if (key === 'formation') {
    const text = preferredFormationLabel(raw) ?? (Number.isFinite(raw) ? `Index ${raw}` : '—')
    return {
      raw,
      inGame: 0,
      inGameUncapped: raw,
      inMatch: 0,
      displayText: text,
    }
  }
  if ((STAFF_POSITION_PREF_KEYS as readonly string[]).includes(key)) {
    const text = staffPositionPrefLabel(raw)
    const suit = Number.isFinite(raw) && raw >= 0 && raw <= 20 ? raw : 0
    return {
      raw,
      inGame: suit,
      inGameUncapped: raw,
      inMatch: suit,
      displayText: text,
    }
  }
  if ((STAFF_TACTICAL_TRAIT_KEYS as readonly string[]).includes(key)) {
    const text = staffTacticalTraitLabel(key as StaffTacticalTraitKey, raw)
    const ig = raw < 1 ? 1 : raw > 20 ? 20 : raw
    return {
      raw,
      inGame: ig,
      inGameUncapped: raw,
      inMatch: ig,
      displayText: text,
    }
  }
  if ((STAFF_CHAIRMAN_ONLY_KEYS as readonly string[]).includes(key)) {
    const text = staffChairmanTraitLabel(key as (typeof STAFF_CHAIRMAN_ONLY_KEYS)[number], raw)
    const o = otherAttrDisplay(raw)
    return { ...o, displayText: text }
  }
  // staff.dat mentals — standard 1–20 personality bytes
  return otherAttrDisplay(raw)
}
