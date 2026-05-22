import { describe, expect, it } from 'vitest'
import type { NonPlayerRecord, ParsedDatabase, StaffRecord } from './database/types'
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
    nonPlayersByRowIndex: undefined,
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

  it('filters by reputation and coaching PA bounds', () => {
    const npLow: NonPlayerRecord = {
      id: 1,
      currentAbility: 10,
      potentialAbility: 12,
      homeReputation: 100,
      currentReputation: 500,
      worldReputation: 400,
      attacking: 10,
      business: 10,
      coaching: 10,
      coachingGks: 10,
      coachingTechnique: 10,
      directness: 10,
      discipline: 10,
      freeRoles: 10,
      interference: 10,
      judgement: 10,
      judgingPotential: 10,
      manHandling: 10,
      marking: 10,
      motivating: 10,
      offside: 10,
      patience: 10,
      physiotherapy: 10,
      pressing: 10,
      resources: 10,
      tactics: 10,
      youngsters: 10,
      goalKeeperPref: 0,
      sweeperPref: 0,
      defenderPref: 0,
      defensiveMidfielderPref: 0,
      midfielderPref: 0,
      attackingMidfielderPref: 0,
      attackerPref: 0,
      wingBackPref: 0,
      formation: 0,
    }
    const npHigh: NonPlayerRecord = {
      ...npLow,
      id: 2,
      currentReputation: 9000,
      worldReputation: 9000,
      potentialAbility: 18,
    }
    const db = minimalDb([
      staffRow({ id: 20, job_for_club: 8, player_id: -1, non_player_id: 1 }),
      staffRow({ id: 21, job_for_club: 8, player_id: -1, non_player_id: 2 }),
    ])
    db.nonPlayersByRowIndex = [npLow, npLow, npHigh]

    const base = { q: '', nation: '', club: '', includePlayers: false }
    expect(
      filterStaffGridRows(db, { ...base, reputationMin: 1000, reputationMax: 8000 }).map((r) => r.staffId),
    ).toEqual([])
    expect(
      filterStaffGridRows(db, { ...base, reputationMin: 600, reputationMax: 9500 }).map((r) => r.staffId),
    ).toEqual([21])
    expect(filterStaffGridRows(db, { ...base, coachingPaMin: 15 }).map((r) => r.staffId)).toEqual([21])
    expect(filterStaffGridRows(db, { ...base, coachingPaMax: 14 }).map((r) => r.staffId)).toEqual([20])
  })

  it('sanitizes invalid non-player metrics and exposes display labels', () => {
    const npBad: NonPlayerRecord = {
      id: 3,
      currentAbility: 65535,
      potentialAbility: 65535,
      homeReputation: 0,
      currentReputation: 6,
      worldReputation: 0,
      attacking: 10,
      business: 10,
      coaching: 10,
      coachingGks: 10,
      coachingTechnique: 10,
      directness: 10,
      discipline: 10,
      freeRoles: 10,
      interference: 10,
      judgement: 10,
      judgingPotential: 10,
      manHandling: 10,
      marking: 10,
      motivating: 10,
      offside: 10,
      patience: 10,
      physiotherapy: 10,
      pressing: 10,
      resources: 10,
      tactics: 10,
      youngsters: 10,
      goalKeeperPref: 0,
      sweeperPref: 0,
      defenderPref: 0,
      defensiveMidfielderPref: 0,
      midfielderPref: 0,
      attackingMidfielderPref: 0,
      attackerPref: 0,
      wingBackPref: 0,
      formation: 0,
    }
    const npGood: NonPlayerRecord = {
      ...npBad,
      id: 4,
      currentAbility: 125,
      potentialAbility: 140,
      worldReputation: 4200,
    }
    const db = minimalDb([staffRow({ id: 30, job_for_club: 8, player_id: -1, non_player_id: 3 })])
    db.nonPlayersByRowIndex = [npBad, npBad, npBad, npBad, npGood]
    db.staff.push(staffRow({ id: 31, job_for_club: 8, player_id: -1, non_player_id: 4 }))

    const rows = filterStaffGridRows(db, { q: '', nation: '', club: '', includePlayers: false })
    const bad = rows.find((r) => r.staffId === 30)!
    const good = rows.find((r) => r.staffId === 31)!
    expect(bad.staffCa).toBeNull()
    expect(bad.reputationCurrent).toBeNull()
    expect(good.staffCa).toBe(125)
    expect(good.staffPa).toBe(140)
    expect(good.reputationCurrent).toBe(4200)
    expect(good.reputationLabel).toBe('Good')
  })
})
