import { describe, expect, it } from 'vitest'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'
import {
  applyBaselineFingerprintRegen,
  applyHeuristicRegenHints,
  applyRegenPipeline,
  findStaffIndexByPlayerId,
} from './regenDetection'
import { playerPosSig } from './regenBaseline'
import type { RegenBaselineFile } from './regenBaseline'

function minimalRow(
  overrides: Partial<UiPlayerRow> & {
    name: string
    staffIndex: number
    staffId: number
    player: Partial<PlayerRecord>
    staff: Partial<StaffRecord>
  },
): UiPlayerRow {
  const player = {
    potential_ability: 180,
    current_ability: 120,
    goalkeeper: 5,
    sweeper: 5,
    defender: 18,
    defensive_midfielder: 5,
    midfielder: 5,
    attacking_midfielder: 5,
    attacker: 5,
    wing_back: 5,
    right_side: 5,
    left_side: 5,
    centre_side: 5,
    free_role: 5,
    ...overrides.player,
  } as PlayerRecord
  const staff = {
    id: overrides.staffId,
    player_id: overrides.staff.player_id ?? 100,
    first_nation_id: 12,
    second_nation_id: 0,
    dob_iso: '1970-05-10',
    job_for_club: 11,
    ...overrides.staff,
  } as StaffRecord
  return {
    name: overrides.name,
    staffIndex: overrides.staffIndex,
    staff,
    player,
    ca: player.current_ability,
    pa: player.potential_ability,
    nation: 'Holland',
    club: 'Test',
    age: overrides.age ?? 20,
    staffId: overrides.staffId,
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

describe('regenDetection', () => {
  it('prefers retired old player over active old in same PA bucket', () => {
    const young = minimalRow({
      name: 'Arno van der Woerd',
      staffIndex: 1,
      staffId: 101,
      age: 19,
      staff: { id: 101, dob_iso: '1980-02-10', player_id: 201 },
      player: { current_ability: 140 },
    })
    const retiredLegend = minimalRow({
      name: 'Dennis Bergkamp',
      staffIndex: 2,
      staffId: 102,
      age: 35,
      staff: { id: 102, dob_iso: '1980-02-10', player_id: 202, job_for_club: 16 },
      player: { current_ability: 50 },
    })
    const wrongOld = minimalRow({
      name: 'Wim de Ron',
      staffIndex: 3,
      staffId: 103,
      age: 32,
      staff: { id: 103, dob_iso: '1965-01-01', player_id: 203 },
      player: { current_ability: 160 },
    })
    const rows = [young, retiredLegend, wrongOld]
    applyHeuristicRegenHints(rows)
    expect(young.isRegenLikely).toBe(true)
    expect(young.regenOfName).toBe('Dennis Bergkamp')
    expect(young.regenOfStaffIndex).toBe(2)
  })

  it('findStaffIndexByPlayerId resolves retired predecessor', () => {
    const rows = [
      minimalRow({
        name: 'Dennis Bergkamp',
        staffIndex: 5,
        staffId: 50,
        staff: { player_id: 999, job_for_club: 16 },
      }),
    ]
    expect(findStaffIndexByPlayerId(rows, 999, 'Dennis Bergkamp')).toBe(5)
  })

  it('snapshot fingerprint links new staff id to baseline legend', () => {
    const bergkamp = minimalRow({
      name: 'Dennis Bergkamp',
      staffIndex: 10,
      staffId: 500,
      age: 35,
      staff: { id: 500, player_id: 777, dob_iso: '1969-08-10', job_for_club: 16 },
      player: { potential_ability: 190, current_ability: 50 },
    })
    const arno = minimalRow({
      name: 'Arno van der Woerd',
      staffIndex: 99,
      staffId: 999,
      age: 19,
      staff: { id: 999, dob_iso: '1969-08-10', player_id: 888 },
      player: { potential_ability: 190, current_ability: 140 },
    })
    const baseline: RegenBaselineFile = {
      version: 1,
      indexPath: '/x.sav',
      pathKey: 'fp',
      gameDateIso: null,
      createdIso: new Date().toISOString(),
      entries: {
        '500': {
          name: 'Dennis Bergkamp',
          firstNameId: 1,
          secondNameId: 2,
          commonNameId: 0,
          playerId: 777,
          pa: 190,
          ca: 180,
          staffIndex: 10,
          firstNationId: 12,
          secondNationId: 0,
          posSig: playerPosSig(bergkamp.player),
          dobIso: '1969-08-10',
          jobForClub: 11,
        },
      },
    }
    applyBaselineFingerprintRegen([bergkamp, arno], baseline, 'fp')
    expect(arno.isRegenLikely).toBe(true)
    expect(arno.regenOfName).toBe('Dennis Bergkamp')
    expect(arno.regenDetectionSource).toBe('snapshot')
  })

  it('snapshot links regenOfStaffIndex when predecessor still in save', () => {
    const predecessor = minimalRow({
      name: 'Dennis Bergkamp',
      staffIndex: 10,
      staffId: 500,
      staff: { id: 500, player_id: 777, first_name_id: 1, second_name_id: 2, common_name_id: 0 },
    })
    const regen = minimalRow({
      name: 'Arno van der Woerd',
      staffIndex: 11,
      staffId: 500,
      staff: { id: 500, player_id: 888, first_name_id: 9, second_name_id: 9, common_name_id: 0 },
    })
    const baseline: RegenBaselineFile = {
      version: 1,
      indexPath: '/x.sav',
      pathKey: 'abc',
      gameDateIso: null,
      createdIso: new Date().toISOString(),
      entries: {
        '500': {
          name: 'Dennis Bergkamp',
          firstNameId: 1,
          secondNameId: 2,
          commonNameId: 0,
          playerId: 777,
          pa: 190,
          ca: 180,
          staffIndex: 10,
        },
      },
    }
    applyRegenPipeline([predecessor, regen], baseline, 'abc')
    expect(regen.isRegenLikely).toBe(true)
    expect(regen.regenOfName).toBe('Dennis Bergkamp')
    expect(regen.regenOfStaffIndex).toBe(10)
    expect(regen.regenDetectionSource).toBe('snapshot')
  })
})
