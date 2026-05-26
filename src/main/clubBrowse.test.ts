import { describe, expect, it } from 'vitest'
import {
  buildClubStaffRows,
  buildClubSquadPlayerRows,
  isPlayerStaffJobRole,
} from './clubBrowse'
import type { ParsedDatabase, PlayerRecord, StaffRecord } from './database/types'

function minimalStaff(overrides: Partial<StaffRecord> & { job_for_club: number }): StaffRecord {
  return {
    id: 1,
    first_name_id: 1,
    second_name_id: 1,
    common_name_id: 0,
    first_nation_id: 1,
    second_nation_id: 0,
    dob_iso: '1980-01-01',
    year_of_birth: 1980,
    player_id: -1,
    non_player_id: 0,
    club_job_id: 100,
    job_for_club: overrides.job_for_club,
    determination: 15,
    ...overrides,
  } as StaffRecord
}

function minimalDb(staff: StaffRecord[], players: PlayerRecord[] = []): ParsedDatabase {
  return {
    staff,
    players,
    firstNames: ['', 'John'],
    secondNames: ['', 'Smith'],
    commonNames: [''],
    clubNames: new Map([[100, 'Test FC']]),
    nationNames: new Map([[1, 'England']]),
    nationEuEligible: new Map([[1, false]]),
    clubsById: new Map([
      [
        100,
        {
          id: 100,
          name: 'Test FC',
          nationId: 1,
          divisionCompId: 0,
          reputation: 8000,
          cash: 1_000_000,
          stadiumId: 0,
          attendance: 20_000,
          training: 15,
          tacticSelectedId: 0,
          tacticTrainingIds: [],
          teamSelectedStaffIds: [],
        },
      ],
    ]),
    contractsByStaffIndex: new Map(),
    nonPlayersByRowIndex: [],
  } as unknown as ParsedDatabase
}

describe('clubBrowse staff vs squad', () => {
  it('isPlayerStaffJobRole marks player job bytes', () => {
    expect(isPlayerStaffJobRole(11)).toBe(true)
    expect(isPlayerStaffJobRole(8)).toBe(false)
  })

  it('lists coaches in staff but not squad players', () => {
    const playerStaff = minimalStaff({ id: 10, job_for_club: 11, player_id: 0, club_job_id: 100 })
    const coach = minimalStaff({ id: 20, job_for_club: 8, player_id: -1, club_job_id: 100, non_player_id: 1 })
    const db = minimalDb([playerStaff, coach])
    db.players = [
      {
        current_ability: 150,
        potential_ability: 160,
      } as PlayerRecord,
    ]
    db.nonPlayersByRowIndex = [
      {
        id: 1,
        currentAbility: 180,
        potentialAbility: 200,
        coaching: 7,
        judgement: 7,
        motivating: 7,
      } as never,
    ]

    const squad = buildClubSquadPlayerRows(db, 100)
    const staffRows = buildClubStaffRows(db, 100)

    expect(squad).toHaveLength(1)
    expect(squad[0]!.name).toContain('John')
    expect(staffRows).toHaveLength(1)
    expect(staffRows[0]!.jobLabel).toBe('Coach')
  })
})
