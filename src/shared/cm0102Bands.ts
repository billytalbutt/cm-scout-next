/**
 * CM 01/02–style verbal bands for on-screen 1–20 values (feet / morale use the same numeric scale in data).
 * Morale bands align with common in-game wording (Superb, Very Good, … Very Poor).
 * Feet use strength-style labels (Very Strong … Very Weak).
 */

function clamp20(n: number): number {
  if (n < 1) return 1
  if (n > 20) return 20
  return Math.round(n)
}

/** Morale / squad happiness-style wording (higher = better). */
export function cm0102MoraleWord(inGame: number): string {
  const v = clamp20(inGame)
  if (v >= 18) return 'Superb'
  if (v >= 15) return 'Very Good'
  if (v >= 12) return 'Good'
  if (v >= 9) return 'Okay'
  if (v >= 6) return 'Poor'
  if (v >= 4) return 'Low'
  return 'Very Poor'
}

/** Preferred foot strength (higher = stronger with that foot). */
export function cm0102FootWord(inGame: number): string {
  const v = clamp20(inGame)
  if (v >= 17) return 'Very Strong'
  if (v >= 14) return 'Strong'
  if (v >= 11) return 'Fair'
  if (v >= 8) return 'Weak'
  return 'Very Weak'
}
