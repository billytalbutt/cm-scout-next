import { describe, expect, it } from 'vitest'
import type { ParsedDatabase, StaffRecord } from './database/types'
import { filterStaffGridRows } from './staffBrowse'

function minimalDb(staff: StaffRecord[]): ParsedDatabase {
  return {
    staff,
    players: [{ current_reputation: 50 } as ParsedDatabase['players'][0]],
    clubNames: new Map([[1, 'Test FC']]),
    nationNames: new Map([[1, 'England']]),
    firstNames: ['', 'John'],
    secondNames: ['', 'Smith'],
    commonNames: [''],
    nonPlayersById: undefined,
    contractsByStaffIndex: new Map(),
    gameDateIso: '2001-08-01',
    nationEuEligible: new Map(),
  } as ParsedDatabase
}

function staffRow(overrides: Partial<StaffRecord> & { job_for_club: number; player_id: number }): StaffRecord {
  return {
    id: 1,
    first_name_id: 1,
    second_name_id: 1,
    common_name_id: 0,
    dob_iso: '1980-01-01',
    year_of_birth: 1980,
    first_nation_id: 1,
    second_nation_id: 0,
    int_apps: 0,
    int_goals: 0,
    club_job_id: 1,
    job_for_club: overrides.job_for_club,
    player_id: overrides.player_id,
    wage: 0,
    value: 0,
    adaptability: 10,
    ambition: 10,
    determination: 15,
    loyalty: 10,
    pressure: 10,
    professionalism: 10,
    sportsmanship: 10,
    temperament: 10,
    playing_squad: 0,
    classification: 0,
    club_valuation: 0,
    staff_preferences_id: 0,
    non_player_id: 0,
    squad_selected_for: 0,
    ...overrides,
  }
}

describe('filterStaffGridRows', () => {
  it('shows player-role staff when a specific job is selected even if includePlayers is false', () => {
    const db = minimalDb([
      staffRow({ id: 10, job_for_club: 11, player_id: 0 }),
      staffRow({ id: 11, job_for_club: 5, player_id: 0 }),
    ])
    const rows = filterStaffGridRows(db, {
      q: '',
      nation: '',
      club: '',
      jobForClub: 11,
      includePlayers: false,
    })
    expect(rows.map((r) => r.staffId)).toEqual([10])
  })

  it('still hides playable staff on any role when includePlayers is false', () => {
    const db = minimalDb([
      staffRow({ id: 10, job_for_club: 11, player_id: 0 }),
      staffRow({ id: 11, job_for_club: 9, player_id: -1 }),
    ])
    const rows = filterStaffGridRows(db, {
      q: '',
      nation: '',
      club: '',
      includePlayers: false,
    })
    expect(rows.map((r) => r.staffId)).toEqual([11])
  })
})
