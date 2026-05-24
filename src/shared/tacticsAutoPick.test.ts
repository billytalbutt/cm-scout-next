import { describe, expect, it } from 'vitest'
import type { GridPlayerRow } from './gridTypes'
import { autoPickBestLineup, autoPickClubSquadLineup } from './tacticsAutoPick'
import type { PitchSlot } from './tacticsPitchSnap'

function row(
  partial: Partial<GridPlayerRow> & {
    staffIndex: number
    name: string
    role7?: number[]
  },
): GridPlayerRow {
  return {
    staffId: partial.staffIndex,
    staffIndex: partial.staffIndex,
    name: partial.name,
    nation: '',
    club: 'Test FC',
    ca: partial.ca ?? 100,
    pa: 120,
    wage: 0,
    value: 0,
    age: 25,
    staffHistCareerApps: 0,
    staffHistCareerGoals: 0,
    staffHistSeasonApps: 0,
    staffHistSeasonGoals: 0,
    curSeasonApps: 0,
    curSeasonGoals: 0,
    curSeasonAssists: null,
    curSeasonAvgRating: null,
    careerAppsTotal: 0,
    careerGoalsTotal: 0,
    ...partial,
  }
}

describe('autoPickClubSquadLineup', () => {
  it('assigns best role-rated player per slot without duplicates', () => {
    const slots: PitchSlot[] = [
      { id: 'gk', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
      { id: 'dc1', role: 'DC', x: 0.35, y: 0.28, arrow: 'none' },
      { id: 'dc2', role: 'DC', x: 0.65, y: 0.28, arrow: 'none' },
      { id: 'st', role: 'ST', x: 0.5, y: 0.84, arrow: 'none' },
    ]
    const squad = [
      row({ staffIndex: 1, name: 'Keeper', posGk: 20, role7: [95, 10, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 2, name: 'CB A', posD: 18, role7: [5, 88, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 3, name: 'CB B', posD: 18, role7: [5, 72, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 4, name: 'Striker', posAtt: 19, role7: [5, 10, 10, 10, 10, 90, 10] }),
      row({ staffIndex: 5, name: 'Winger', posAtt: 16, posWb: 15, role7: [5, 10, 10, 10, 10, 60, 10] }),
    ]
    const picked = autoPickClubSquadLineup(slots, squad)
    expect(picked.gk?.name).toBe('Keeper')
    expect(picked.dc1?.name).toBe('CB A')
    expect(picked.dc2?.name).toBe('CB B')
    expect(picked.st?.name).toBe('Striker')
    const indices = Object.values(picked).map((a) => a!.staffIndex)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('autoPickBestLineup picks global best per slot across all clubs', () => {
    const slots: PitchSlot[] = [
      { id: 'gk', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
      { id: 'st', role: 'ST', x: 0.5, y: 0.84, arrow: 'none' },
    ]
    const world = [
      row({ staffIndex: 1, name: 'Club A GK', club: 'A', posGk: 18, role7: [80, 10, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 2, name: 'World GK', club: 'B', posGk: 20, role7: [99, 10, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 3, name: 'Club A ST', club: 'A', posAtt: 19, role7: [5, 10, 10, 10, 10, 70, 10] }),
      row({ staffIndex: 4, name: 'World ST', club: 'C', posAtt: 20, role7: [5, 10, 10, 10, 10, 95, 10] }),
    ]
    const picked = autoPickBestLineup(slots, world)
    expect(picked.gk?.name).toBe('World GK')
    expect(picked.st?.name).toBe('World ST')
    expect(autoPickClubSquadLineup).toBe(autoPickBestLineup)
  })
})
