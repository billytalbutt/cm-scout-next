import { describe, expect, it } from 'vitest'
import {
  aggregateStaffCompSeasonTotals,
  savePerformanceByPlayerDatIdFromStaffComp,
  type StaffCompHistoryRecord,
} from './staffCompHistory'
import type { PlayerRecord, StaffRecord } from './types'

describe('savePerformanceByPlayerDatIdFromStaffComp', () => {
  it('aggregates match-only rows per player.dat id', () => {
    const players: PlayerRecord[] = [{ id: 772 } as PlayerRecord]
    const staff: StaffRecord[] = [{ id: 10, player_id: 0 } as StaffRecord]
    const rows: StaffCompHistoryRecord[] = [
      {
        staffId: 10,
        competitionId: 1,
        apps: 29,
        goals: 2,
        assists: 4,
        averageRating: 7.1,
      },
    ]
    const byStaffId = new Map([[10, rows]])
    const names = new Map<number, string>([[1, 'Greek Super League']])
    const out = savePerformanceByPlayerDatIdFromStaffComp(byStaffId, staff, players, names)
    expect(out.get(772)).toMatchObject({
      apps: 29,
      goals: 2,
      assists: 4,
      averageRating: 7.1,
      layout: 'gridV0',
    })
  })

  it('excludes award competitions from totals', () => {
    const players: PlayerRecord[] = [{ id: 100 } as PlayerRecord]
    const staff: StaffRecord[] = [{ id: 5, player_id: 0 } as StaffRecord]
    const rows: StaffCompHistoryRecord[] = [
      {
        staffId: 5,
        competitionId: 1,
        apps: 10,
        goals: 1,
        assists: 1,
        averageRating: 7.0,
      },
      {
        staffId: 5,
        competitionId: 2,
        apps: 12,
        goals: 3,
        assists: 0,
        averageRating: 5.6,
      },
    ]
    const names = new Map<number, string>([
      [1, 'League'],
      [2, 'European Footballer of the Year'],
    ])
    const matchOnly = rows.filter((r) => r.competitionId === 1)
    expect(aggregateStaffCompSeasonTotals(matchOnly).apps).toBe(10)
    const out = savePerformanceByPlayerDatIdFromStaffComp(
      new Map([[5, rows]]),
      staff,
      players,
      names,
    )
    expect(out.get(100)?.apps).toBe(10)
  })
})
