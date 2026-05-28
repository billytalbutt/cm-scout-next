import { computeEffectivenessFull, computePlayerRiskFlags } from '../shared/effectivenessEngine'
import type { UiPlayerRow } from './database/types'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'
import { effectivenessAttrGetter } from './effectivenessAttrGetter'
import { evaluateEliteEngineBadge } from './eliteEngineBadge'

/** Raw-attribute effectiveness % + winning archetype (natural-position–gated; see `effectivenessEngine.ts`). */
export function applyEffectivenessRatings(rows: UiPlayerRow[]): void {
  for (const row of rows) {
    if (row.staffIndex < 0) continue
    const get = effectivenessAttrGetter(row.player, row.staff)
    const ids = eligibleEffectivenessArchetypeIds(row.player)
    const full = computeEffectivenessFull(get, ids)
    row.effPercent = full.effPercent
    row.effArchetype = full.effArchetype
    row.effArchetypeId = full.effArchetypeId
    const risks = computePlayerRiskFlags(get)
    row.injuryRisk = risks.injuryRisk
    row.disciplineRisk = risks.disciplineRisk
    row.lowConsistencyRisk = risks.lowConsistency
    const badge = evaluateEliteEngineBadge(row.player, row.staff, full.effArchetypeId, full.effPercent)
    if (badge) {
      row.eliteEngineBadgeKind = badge.kind
      row.eliteEngineBadgeTitle = badge.title
      row.eliteEngineBadgeDetail = badge.detail
    } else {
      row.eliteEngineBadgeKind = undefined
      row.eliteEngineBadgeTitle = undefined
      row.eliteEngineBadgeDetail = undefined
    }
  }
}
