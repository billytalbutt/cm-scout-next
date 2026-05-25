import { describe, expect, it } from 'vitest'
import { filterUiPlayerRows, type GetRowsFilter } from './gridRowFilter'
import type { InjurySummary } from './database/injuryHistory'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'

function row(staffId: number): UiPlayerRow {
  return {
    staffId,
    staffIndex: 0,
    name: `Player ${staffId}`,
    nation: 'England',
    secondNation: '',
    club: 'Test FC',
    ca: 150,
    pa: 180,
    wage: 1000,
    value: 500_000,
    age: 25,
    euPassport: false,
    player: { id: staffId } as PlayerRecord,
    staff: { id: staffId, club_job_id: 1 } as StaffRecord,
  }
}

describe('filterUiPlayerRows injuredOnly', () => {
  it('keeps only staff with active injury type id', () => {
    const injuryByStaffId = new Map<number, InjurySummary>([
      [10, { typeId: 3, label: 'Injury #3' }],
      [20, { typeId: 0, label: 'None' }],
    ])
    const f: GetRowsFilter = { injuredOnly: true }
    const out = filterUiPlayerRows([row(10), row(20), row(30)], f, {
      gameDateIso: null,
      injuryByStaffId,
    })
    expect(out.map((r) => r.staffId)).toEqual([10])
  })
})
