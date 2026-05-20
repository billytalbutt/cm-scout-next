/**
 * Build grid attribute-minimum strings (48, CM Scout order) from a player's comparison vectors.
 * Mirrors {@link attrIndexPassesMin} in `cmScoutRating.ts`.
 */

/** Injury proneness (23) and dirtiness (38): higher intrinsic is worse → flipped for filters. */
const ATTR_LESS_BETTER = new Set([23, 38])

export function attrMinStringsFromComparisonVectors(
  inNorm: readonly number[],
  filter48: readonly number[],
): string[] {
  const out = Array.from({ length: 48 }, () => '')
  for (let i = 0; i < 48; i++) {
    const onScreen = inNorm[i]
    if (onScreen == null || !Number.isFinite(onScreen)) continue
    let minVal: number
    if (ATTR_LESS_BETTER.has(i)) {
      minVal = Math.ceil(21 - onScreen)
    } else {
      const hi = filter48[i] ?? onScreen
      minVal = onScreen >= 20 && hi > 20 ? Math.ceil(hi) : Math.ceil(onScreen)
    }
    if (minVal > 0) out[i] = String(Math.min(31, minVal))
  }
  return out
}
