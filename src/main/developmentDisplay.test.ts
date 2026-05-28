import { describe, expect, it } from 'vitest'
import {
  developmentDisplayVector48,
  displayVectorFromLegacyRaw48,
  isLegacyRawAttr48Snapshot,
  resolveSnapshotDisplay48,
} from './developmentDisplay'
import type { RegenBaselineEntry } from './regenBaseline'
import type { PlayerRecord, StaffRecord } from './database/types'

function player(partial: Partial<PlayerRecord>): PlayerRecord {
  return {
    current_ability: 160,
    potential_ability: 180,
    goalkeeper: 1,
    ...partial,
  } as PlayerRecord
}

const staff = { determination: 15 } as StaffRecord

describe('developmentDisplay', () => {
  it('detects legacy raw CA18 snapshots', () => {
    const legacy = new Array(48).fill(12)
    legacy[0] = -2
    expect(isLegacyRawAttr48Snapshot(legacy)).toBe(true)
    const display = new Array(48).fill(12)
    expect(isLegacyRawAttr48Snapshot(display)).toBe(false)
  })

  it('converts legacy raw intrinsics to in-game display at snapshot CA', () => {
    const raw = new Array(48).fill(10)
    raw[3] = 8 // decisions intrinsic
    const disp = displayVectorFromLegacyRaw48(raw, 120, '1,1,1,1,1,1,1,1,1,1,1,1')
    expect(disp[3]).toBeGreaterThanOrEqual(1)
    expect(disp[3]).toBeLessThanOrEqual(20)
    expect(disp[0]).toBeGreaterThanOrEqual(1)
  })

  it('uses stored display values when snapshot is already display-shaped', () => {
    const entry: RegenBaselineEntry = {
      name: 'X',
      firstNameId: 1,
      secondNameId: 2,
      commonNameId: 0,
      playerId: 1,
      pa: 180,
      ca: 150,
      staffIndex: 0,
      firstNationId: 1,
      secondNationId: 0,
      posSig: '1,1,1',
      dobIso: null,
      jobForClub: 11,
      attr48: [...new Array(48).fill(14)],
    }
    expect(resolveSnapshotDisplay48(entry)?.[3]).toBe(14)
  })

  it('developmentDisplayVector48 returns 1–20 for CA18 attrs', () => {
    const raw = new Array(48).fill(10)
    raw[0] = -3
    const p = player({ anticipation: -3, decisions: 8, current_ability: 180 })
    const disp = developmentDisplayVector48(p, staff)
    expect(disp[0]).toBeGreaterThanOrEqual(1)
    expect(disp[0]).toBeLessThanOrEqual(20)
  })
})
