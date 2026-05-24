import { describe, expect, it } from 'vitest'
import type { ContractRecord, ParsedDatabase, StaffRecord } from './database/types'
import { findHumanManagedClubId, humanClubIdFromManagerDatBuffer } from './clubEditorSave'

function staff(partial: Partial<StaffRecord> & Pick<StaffRecord, 'id' | 'club_job_id' | 'job_for_club'>): StaffRecord {
  return {
    first_name_id: 0,
    second_name_id: 0,
    common_name_id: 0,
    dob_iso: null,
    year_of_birth: 1980,
    first_nation_id: 0,
    second_nation_id: 0,
    int_apps: 0,
    int_goals: 0,
    player_id: -1,
    wage: 0,
    value: 0,
    adaptability: 10,
    ambition: 10,
    determination: 10,
    loyalty: 10,
    pressure: 10,
    professionalism: 10,
    sportsmanship: 10,
    temperament: 10,
    playing_squad: 0,
    classification: 0,
    club_valuation: 0,
    staff_preferences_id: 0,
    non_player_id: -1,
    squad_selected_for: 0,
    ...partial,
  }
}

function miniDb(
  staffRows: StaffRecord[],
  contracts?: Map<number, ContractRecord>,
): ParsedDatabase {
  return {
    staff: staffRows,
    contractsByStaffIndex: contracts ?? new Map(),
  } as ParsedDatabase
}

describe('findHumanManagedClubId', () => {
  it('reads human_manager.dat club_job_id at TStaff+53', () => {
    const hm = Buffer.alloc(110)
    hm.writeInt32LE(5001, 0)
    hm.writeInt32LE(1165, 53)
    const rows = [staff({ id: 5001, club_job_id: 999, job_for_club: 8 })]
    expect(humanClubIdFromManagerDatBuffer(hm, rows)).toBe(999)
    expect(humanClubIdFromManagerDatBuffer(hm, [])).toBe(1165)
  })

  it('uses contract manager_job_rc for Manager role', () => {
    const db = miniDb(
      [
        staff({ id: 1, club_job_id: 200, job_for_club: 5, player_id: -1 }),
        staff({ id: 2, club_job_id: 300, job_for_club: 5, player_id: -1 }),
      ],
      new Map([
        [
          0,
          {
            staffIndex: 0,
            club_id: 200,
            manager_job_rc: 1,
          } as ContractRecord,
        ],
      ]),
    )
    expect(findHumanManagedClubId(db)).toBe(200)
  })

  it('detects Player / Manager without requiring wrong first AI manager', () => {
    const db = miniDb([
      staff({ id: 1, club_job_id: 50, job_for_club: 5, player_id: -1 }),
      staff({ id: 2, club_job_id: 1165, job_for_club: 12, player_id: 10 }),
    ])
    expect(findHumanManagedClubId(db)).toBe(1165)
  })
})
