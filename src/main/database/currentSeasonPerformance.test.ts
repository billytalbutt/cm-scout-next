import { describe, expect, it } from 'vitest'
import {
  buildCurrentSeasonPerformance,
  pickCurrentSeasonStaffHistoryAtClub,
} from './currentSeasonPerformance'
import type { StaffHistoryRecord } from './staffHistory'

describe('pickCurrentSeasonStaffHistoryAtClub', () => {
  it('tries alternate club ids when contract and staff club differ', () => {
    const hist: StaffHistoryRecord[] = [
      { id: 1, staffId: 1, year: 2004, clubId: 999, onLoan: 0, apps: 10, goals: 2 },
    ]
    const { rows } = pickCurrentSeasonStaffHistoryAtClub(hist, 100, '2005-09-13', [], [999])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.apps).toBe(10)
  })

  it('uses season-start year when calendar year has no rows', () => {
    const hist: StaffHistoryRecord[] = [
      { id: 1, staffId: 152, year: 2004, clubId: 100, onLoan: 0, apps: 10, goals: 2 },
    ]
    const { rows, pick } = pickCurrentSeasonStaffHistoryAtClub(hist, 100, '2005-09-13', [])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.apps).toBe(10)
    expect(pick.highlightHistoryYear).toBe(2004)
  })
})

describe('buildCurrentSeasonPerformance', () => {
  it('returns apps and goals for current club season row', () => {
    const hist: StaffHistoryRecord[] = [
      { id: 1, staffId: 152, year: 2004, clubId: 100, onLoan: 0, apps: 10, goals: 2 },
    ]
    const perf = buildCurrentSeasonPerformance(hist, 100, 'Blackburn Rovers', '2005-09-13', [])
    expect(perf).not.toBeNull()
    expect(perf!.apps).toBe(10)
    expect(perf!.goals).toBe(2)
    expect(perf!.assists).toBeNull()
    expect(perf!.label).toContain('Blackburn')
  })
})
