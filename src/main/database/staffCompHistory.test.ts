import { describe, expect, it } from 'vitest'
import { aggregateStaffCompSeasonTotals } from './staffCompHistory'
import type { StaffCompHistoryRecord } from './staffCompHistory'

describe('aggregateStaffCompSeasonTotals', () => {
  it('sums apps/goals/assists and weighted average rating', () => {
    const rows: StaffCompHistoryRecord[] = [
      { staffId: 1, competitionId: 10, apps: 10, goals: 2, assists: 1, averageRating: 7.5 },
      { staffId: 1, competitionId: 20, apps: 5, goals: 0, assists: 2, averageRating: 8.0 },
    ]
    const t = aggregateStaffCompSeasonTotals(rows)
    expect(t.apps).toBe(15)
    expect(t.goals).toBe(2)
    expect(t.assists).toBe(3)
    expect(t.averageRating).toBeCloseTo((10 * 7.5 + 5 * 8) / 15, 2)
  })

  it('returns null average when no rated appearances', () => {
    const rows: StaffCompHistoryRecord[] = [
      { staffId: 1, competitionId: 10, apps: 3, goals: 0, assists: 0, averageRating: null },
    ]
    expect(aggregateStaffCompSeasonTotals(rows).averageRating).toBeNull()
  })
})
