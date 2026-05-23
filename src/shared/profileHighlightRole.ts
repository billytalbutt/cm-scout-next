import type { EffectivenessArchetypeRow } from './effectivenessEngine'

/** Effectiveness recipe id → CM Scout weight column index (GK…WB). */
const EFFECTIVENESS_TO_CM_SCOUT: Record<string, number> = {
  gk: 0,
  dc: 1,
  dmc: 2,
  mc: 3,
  amw: 4,
  amc: 4,
  st: 5,
  wb: 6,
}

export function cmScoutIndexFromEffectivenessArchetypeId(archetypeId: string): number | null {
  const idx = EFFECTIVENESS_TO_CM_SCOUT[archetypeId.toLowerCase()]
  return idx === undefined ? null : idx
}

/** Default attribute-highlight role: best Eff % natural recipe, else best suitable CM Scout %. */
export function defaultProfileHighlightRoleIdx(profile: {
  defaultHighlightRoleCmScoutIndex?: number
  effByArchetype?: readonly EffectivenessArchetypeRow[]
}): number {
  const rows = profile.effByArchetype
  if (rows?.length) {
    const winner = rows.find((r) => r.isWinner)
    const pick = winner ?? rows.reduce((a, b) => (b.percent > a.percent ? b : a))
    const idx = cmScoutIndexFromEffectivenessArchetypeId(pick.archetypeId)
    if (idx != null) return idx
  }
  return profile.defaultHighlightRoleCmScoutIndex ?? 0
}
