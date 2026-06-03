import { describe, expect, it } from 'vitest'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'
import { playerPosSig } from './regenBaseline'
import type { RegenBaselineEntry } from './regenBaseline'
import { regenMatchesSnapshotLegend } from './regenFingerprint'

function row(
  overrides: Partial<{ name: string; staff: Partial<StaffRecord>; player: Partial<PlayerRecord>; age: number }>,
): UiPlayerRow {
  const player = {
    potential_ability: 165,
    current_ability: 120,
    goalkeeper: 1,
    sweeper: 1,
    defender: 1,
    defensive_midfielder: 1,
    midfielder: 1,
    attacking_midfielder: 8,
    attacker: 18,
    wing_back: 1,
    right_side: 12,
    left_side: 1,
    centre_side: 10,
    free_role: 1,
    ...overrides.player,
  } as PlayerRecord
  const staff = {
    id: 1,
    player_id: 1,
    first_nation_id: 100,
    second_nation_id: 0,
    dob_iso: '1978-11-12',
    job_for_club: 11,
    ...overrides.staff,
  } as StaffRecord
  return {
    name: overrides.name ?? 'Test',
    staffIndex: 0,
    staff,
    player,
    ca: player.current_ability,
    pa: player.potential_ability,
    nation: 'Test',
    club: 'Test',
    age: overrides.age ?? 20,
    staffId: staff.id,
    value: 0,
    staffHistCareerApps: 0,
    staffHistCareerGoals: 0,
    staffHistSeasonApps: 0,
    staffHistSeasonGoals: 0,
    curSeasonApps: 0,
    curSeasonGoals: 0,
    curSeasonAssists: 0,
    euPassport: false,
  } as UiPlayerRow
}

describe('regenMatchesSnapshotLegend', () => {
  const olisadebe: RegenBaselineEntry = {
    name: 'Emmanuel Olisadebe',
    firstNameId: 1,
    secondNameId: 2,
    commonNameId: 0,
    playerId: 50,
    pa: 165,
    ca: 150,
    staffIndex: 10,
    firstNationId: 100,
    secondNationId: 0,
    posSig: playerPosSig(
      row({ player: { attacking_midfielder: 8, attacker: 18 } }).player,
    ),
    dobIso: '1978-11-12',
    jobForClub: 11,
  }

  it('accepts same PA, nation, positions, and DOB month/day', () => {
    const regen = row({
      name: 'Gilberto Cordero',
      staff: { first_nation_id: 100, dob_iso: '1990-11-12' },
      player: { potential_ability: 165, attacking_midfielder: 8, attacker: 18 },
    })
    expect(regenMatchesSnapshotLegend(regen, olisadebe)).toBe(true)
  })

  it('rejects wrong nation (Costa Rican regen of Nigerian legend)', () => {
    const regen = row({
      name: 'Gilberto Cordero',
      staff: { first_nation_id: 200, dob_iso: '1990-11-12' },
      player: {
        potential_ability: 165,
        attacking_midfielder: 12,
        midfielder: 15,
        attacker: 5,
      },
    })
    expect(regenMatchesSnapshotLegend(regen, olisadebe)).toBe(false)
  })

  it('rejects wrong natural positions', () => {
    const regen = row({
      staff: { first_nation_id: 100, dob_iso: '1990-11-12' },
      player: {
        potential_ability: 165,
        defender: 18,
        attacking_midfielder: 1,
        attacker: 1,
      },
    })
    expect(regenMatchesSnapshotLegend(regen, olisadebe)).toBe(false)
  })

  it('rejects wrong PA', () => {
    const regen = row({
      staff: { first_nation_id: 100, dob_iso: '1990-11-12' },
      player: { potential_ability: 140, attacking_midfielder: 8, attacker: 18 },
    })
    expect(regenMatchesSnapshotLegend(regen, olisadebe)).toBe(false)
  })
})
