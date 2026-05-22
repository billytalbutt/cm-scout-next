import { cm0102MoraleWord } from './cm0102Bands'

/** Empty / unused `nonplayer.dat` or reputation slots in saves. */
export const CM0102_INVALID_U16 = 65535

/** Backroom CA/PA — same scale as player ability on disk (typically 1–200). */
export function sanitizeStaffAbility(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  const n = Math.trunc(raw)
  if (n <= 0 || n === CM0102_INVALID_U16 || n > 250) return null
  return n
}

/**
 * Current/home/world reputation (`UInt16` on player & non-player records).
 * Values 0–1 are unused slots; 65535-class values are empty rows.
 */
export function sanitizeStaffReputation(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  const n = Math.trunc(raw)
  // 0–1 and 65535-class values are empty rows; single-digit reps are unused slots, not real ratings.
  if (n < 200 || n >= 65_500) return null
  return n
}

/**
 * In-game style reputation band (CM manual manager categories:
 * Unproven → Superb). Thresholds tuned for typical player/non-player
 * reputation range (~400–8000 on updated databases).
 */
export function cm0102ReputationWord(raw: number | null | undefined): string {
  const v = sanitizeStaffReputation(raw)
  if (v == null) return '—'
  if (v < 400) return 'Unproven'
  if (v < 1_200) return 'Very Poor'
  if (v < 2_500) return 'Poor'
  if (v < 4_000) return 'OK'
  if (v < 5_500) return 'Good'
  if (v < 7_000) return 'Very Good'
  return 'Superb'
}

/** Verbal band for coaching CA/PA using the same 1–20 morale-style scale as in-game attribute wording. */
export function cm0102CoachingAbilityWord(raw: number | null | undefined): string {
  const ca = sanitizeStaffAbility(raw)
  if (ca == null) return '—'
  const band = Math.min(20, Math.max(1, Math.round(ca / 10)))
  return cm0102MoraleWord(band)
}

export type StaffMetricDisplay = {
  raw: number | null
  label: string
}

export function staffReputationDisplay(raw: number | null | undefined): StaffMetricDisplay {
  const v = sanitizeStaffReputation(raw)
  return { raw: v, label: cm0102ReputationWord(v) }
}

export function staffCoachingAbilityDisplay(raw: number | null | undefined): StaffMetricDisplay {
  const v = sanitizeStaffAbility(raw)
  return { raw: v, label: cm0102CoachingAbilityWord(v) }
}
