import { computeBestEffectiveness, playerAttrGetter } from '../shared/effectivenessEngine'
import type { UiPlayerRow } from './database/types'

/** Raw-attribute effectiveness % + winning archetype label (see `effectivenessEngine.ts`). */
export function applyEffectivenessRatings(rows: UiPlayerRow[]): void {
  for (const row of rows) {
    if (row.staffIndex < 0) continue
    const get = playerAttrGetter(row.player as Record<string, number>)
    const { effPercent, effArchetype } = computeBestEffectiveness(get)
    row.effPercent = effPercent
    row.effArchetype = effArchetype
  }
}
