import { describe, expect, it } from 'vitest'
import { buildStaffEditorPatchedBuffer } from './staffEditorSave'
import type { BlockInfo, NonPlayerRecord, ParsedDatabase, StaffRecord } from './database/types'

describe('staffEditorSave', () => {
  it('patches coaching byte on nonplayer row', () => {
    const row = Buffer.alloc(68, 0)
    row.writeInt32LE(99, 0)
    row.writeInt8(10, 16)
    const block: BlockInfo = {
      name: 'nonplayer.dat',
      position: 0,
      size: 68,
      compressedSize: 68,
    }
    const archive = Buffer.from(row)
    const np: NonPlayerRecord = {
      id: 99,
      currentAbility: 100,
      potentialAbility: 120,
      homeReputation: 0,
      currentReputation: 0,
      worldReputation: 0,
      attacking: 0,
      business: 0,
      coaching: 10,
      coachingGks: 0,
      coachingTechnique: 0,
      directness: 0,
      discipline: 0,
      freeRoles: 0,
      interference: 0,
      judgement: 0,
      judgingPotential: 0,
      manHandling: 0,
      marking: 0,
      motivating: 0,
      offside: 0,
      patience: 0,
      physiotherapy: 0,
      pressing: 0,
      resources: 0,
      tactics: 0,
      youngsters: 0,
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
    const staff: StaffRecord = {
      id: 1,
      player_id: -1,
      non_player_id: 0,
      club_job_id: 5,
      job_for_club: 8,
    } as StaffRecord
    const db = {
      staff: [staff],
      nonPlayersByRowIndex: [np],
      blocks: [block],
      compressed: false,
      firstNames: [],
      secondNames: [],
      commonNames: [],
    } as ParsedDatabase
    const built = buildStaffEditorPatchedBuffer(archive, [block], false, db, 0, { coaching: 18 })
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.buffer.readInt8(16)).toBe(18)
  })
})
