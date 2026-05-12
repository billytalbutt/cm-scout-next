import { computeBestEffectiveness, playerAttrGetter } from '../shared/effectivenessEngine'
import type { UiPlayerRow } from './database/types'
import { eligibleEffectivenessArchetypeIds } from './effectivenessNaturalFit'

/** Raw-attribute effectiveness % + winning archetype label (natural-position–gated; see `effectivenessEngine.ts`). */
export function applyEffectivenessRatings(rows: UiPlayerRow[]): void {
  for (const row of rows) {
    if (row.staffIndex < 0) continue
    const get = playerAttrGetter(row.player as Record<string, number>)
    const ids = eligibleEffectivenessArchetypeIds(row.player)
    const { effPercent, effArchetype } = computeBestEffectiveness(get, ids)
    row.effPercent = effPercent
    row.effArchetype = effArchetype
  }
}
