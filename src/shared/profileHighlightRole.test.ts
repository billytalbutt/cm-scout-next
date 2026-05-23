import { describe, expect, it } from 'vitest'
import { cmScoutIndexFromEffectivenessArchetypeId, defaultProfileHighlightRoleIdx } from './profileHighlightRole'

describe('profileHighlightRole', () => {
  it('maps effectiveness ids to CM Scout column indices', () => {
    expect(cmScoutIndexFromEffectivenessArchetypeId('dmc')).toBe(2)
    expect(cmScoutIndexFromEffectivenessArchetypeId('wb')).toBe(6)
    expect(cmScoutIndexFromEffectivenessArchetypeId('amc')).toBe(4)
  })

  it('defaults to eff winner when natural recipes exist', () => {
    expect(
      defaultProfileHighlightRoleIdx({
        defaultHighlightRoleCmScoutIndex: 6,
        effByArchetype: [
          { archetypeId: 'dmc', archetypeLabel: 'DMC', percent: 82, isWinner: true },
          { archetypeId: 'wb', archetypeLabel: 'WB', percent: 74, isWinner: false },
        ],
      }),
    ).toBe(2)
  })
})
