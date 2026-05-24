import { describe, expect, it } from 'vitest'
import type { GridPlayerRow } from '../shared/gridTypes'
import { autoPickBestLineup } from '../shared/tacticsAutoPick'
import type { PitchSlot } from '../shared/tacticsPitchSnap'

function row(
  partial: Partial<GridPlayerRow> & { staffIndex: number; name: string; role7?: number[] },
): GridPlayerRow {
  return {
    staffId: partial.staffIndex,
    staffIndex: partial.staffIndex,
    name: partial.name,
    nation: '',
    club: partial.club ?? 'FC',
    ca: 100,
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

describe('world XI lineup', () => {
  it('picks global best per slot (same pool as pickWorldXiLineup uses after mapping)', () => {
    const slots: PitchSlot[] = [{ id: 'gk', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' }]
    const world = [
      row({ staffIndex: 1, name: 'Average', posGk: 18, role7: [75, 10, 10, 10, 10, 10, 10] }),
      row({ staffIndex: 2, name: 'Elite', posGk: 20, role7: [98, 10, 10, 10, 10, 10, 10] }),
    ]
    const picked = autoPickBestLineup(slots, world)
    expect(picked.gk?.name).toBe('Elite')
  })
})
