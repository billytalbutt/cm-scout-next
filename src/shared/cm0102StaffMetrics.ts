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
 * Reputation bytes on `nonplayer.dat` / player records (`UInt16`).
 * Very low values are empty slots, not real ratings.
 */
export function sanitizeStaffReputation(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  const n = Math.trunc(raw)
  if (n < 200 || n >= 65_500) return null
  return n
}

/**
 * CM shows staff reputation from **world** reputation on the linked `nonplayer.dat`
 * row. `currentReputation` is often inflated (especially for coaches) and must not
 * be used when world is unset — that mismatch caused thousands of false "Superb" rows.
 */
export function staffReputationRawFromNonPlayer(np: {
  worldReputation: number
}): number | null {
  return sanitizeStaffReputation(np.worldReputation)
}

/**
 * In-game manager/staff reputation wording (CM manual: Unproven → Superb).
 * Thresholds applied to **world** reputation (typical updated DB range ~400–10000).
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

export type StaffReputationDisplay = {
  raw: number | null
  label: string
}

export function staffReputationDisplay(raw: number | null | undefined): StaffReputationDisplay {
  const v = sanitizeStaffReputation(raw)
  return { raw: v, label: cm0102ReputationWord(v) }
}
