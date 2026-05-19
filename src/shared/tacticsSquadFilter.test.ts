import { describe, expect, it } from 'vitest'
import type { GridPlayerRow } from './gridTypes'
import {
  filterSquadRowsForPitchSlot,
  naturalPositionRoles,
  playerEligibleForLineupGroup,
} from './tacticsSquadFilter'
import type { PitchSlot } from './tacticsPitchSnap'

function row(partial: Partial<GridPlayerRow> & { staffIndex: number; name: string }): GridPlayerRow {
  return {
    staffId: partial.staffIndex,
    staffIndex: partial.staffIndex,
    name: partial.name,
    nation: '',
    club: 'Test FC',
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

const gkSlot: PitchSlot = { id: 'gk', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' }
const dcSlot: PitchSlot = { id: 'dc', role: 'DC', x: 0.5, y: 0.28, arrow: 'none' }
const stSlot: PitchSlot = { id: 'st', role: 'ST', x: 0.5, y: 0.84, arrow: 'none' }

describe('tacticsSquadFilter', () => {
  it('detects natural roles above suitability cut', () => {
    expect(naturalPositionRoles(row({ staffIndex: 1, name: 'Keeper', posGk: 20 }))).toEqual(['GK'])
    expect(
      naturalPositionRoles(row({ staffIndex: 2, name: 'CB', posD: 18, posDm: 10 })),
    ).toEqual(['D'])
  })

  it('filters squad by lineup group for pitch slot', () => {
    const squad = [
      row({ staffIndex: 1, name: 'GK', posGk: 20 }),
      row({ staffIndex: 2, name: 'CB', posD: 18 }),
      row({ staffIndex: 3, name: 'ST', posAtt: 19 }),
    ]
    expect(filterSquadRowsForPitchSlot(squad, gkSlot).map((r) => r.name)).toEqual(['GK'])
    expect(filterSquadRowsForPitchSlot(squad, dcSlot).map((r) => r.name)).toEqual(['CB'])
    expect(filterSquadRowsForPitchSlot(squad, stSlot).map((r) => r.name)).toEqual(['ST'])
  })

  it('allows dual naturals in multiple groups', () => {
    const dual = row({ staffIndex: 4, name: 'Box-to-box', posM: 16, posDm: 16 })
    expect(playerEligibleForLineupGroup(dual, 'midfield')).toBe(true)
    expect(playerEligibleForLineupGroup(dual, 'attack')).toBe(false)
  })
})
