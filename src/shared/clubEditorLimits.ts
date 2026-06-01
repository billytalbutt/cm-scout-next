/**
 * CM0102-style limits for club / stadium editor fields.
 * Cash is a plain signed int32 in pounds; negatives are valid (club in debt).
 * Capped at ±£2bn (vanilla overflow without EnsureCashDoesNotResetToZero patch).
 * Training 1–20 matches in-game facilities rating.
 */
export type ClubEditorLimit = { min: number; max: number }

export const CLUB_EDITOR_LIMITS: Record<string, ClubEditorLimit> = {
  cash: { min: -2_000_000_000, max: 2_000_000_000 },
  attendance: { min: 0, max: 200_000 },
  min_attendance: { min: 0, max: 200_000 },
  max_attendance: { min: 0, max: 200_000 },
  training: { min: 1, max: 20 },
  reputation: { min: 0, max: 65_535 },
  stadium_capacity: { min: 0, max: 200_000 },
  stadium_seating: { min: 0, max: 200_000 },
  stadium_expansion: { min: 0, max: 200_000 },
  stadium_nearby_id: { min: 0, max: 2_147_483_647 },
}

export function clampClubEditorValue(key: string, value: number): number {
  const lim = CLUB_EDITOR_LIMITS[key]
  let v = Math.trunc(value)
  if (!Number.isFinite(v)) return lim?.min ?? 0
  if (lim) {
    if (v < lim.min) v = lim.min
    if (v > lim.max) v = lim.max
  }
  return v
}

export function clubEditorLimitHint(key: string): string | undefined {
  const lim = CLUB_EDITOR_LIMITS[key]
  if (!lim) return undefined
  return `${lim.min.toLocaleString()}–${lim.max.toLocaleString()}`
}
