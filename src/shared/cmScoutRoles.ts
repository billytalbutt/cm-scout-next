/**
 * CM Scout Intrinsic `WeightsSet_CMScout.txt` column order (48 attrs × 7 roles).
 * Indices 0–6 must stay aligned with `CM_SCOUT_WEIGHTS` columns — do not reorder without re-matrixing weights.
 * Same naming as the community DataService position buckets.
 */
export const CM_SCOUT_ROLE_SHORT = ['GK', 'D', 'DM', 'M', 'AM', 'A', 'WB'] as const

/**
 * Profile “CM Scout % by role” column order: GK → D → WB → DM → M → AM → Attacker (matches common positional ladder).
 * Values are **weight column indices** into `CM_SCOUT_ROLE_SHORT` / `cmScoutRolePercents`.
 */
export const CM_SCOUT_ROLE_PROFILE_UI_ORDER = [0, 1, 6, 2, 3, 4, 5] as const
