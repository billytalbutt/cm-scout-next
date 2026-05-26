import { describe, expect, it } from 'vitest'
import {
  baselineTracksDevelopment,
  buildPlayerDevelopmentSummary,
  compareAttr48,
  filterAndSortDevelopmentRows,
} from './playerDevelopment'
import type { RegenBaselineEntry, RegenBaselineFile } from './regenBaseline'
import type { PlayerRecord, StaffRecord, UiPlayerRow } from './database/types'

function entry(overrides: Partial<RegenBaselineEntry> = {}): RegenBaselineEntry {
  return {
    name: 'Test Player',
    firstNameId: 1,
    secondNameId: 2,
    commonNameId: 0,
    playerId: 10,
    pa: 180,
    ca: 120,
    staffIndex: 0,
    firstNationId: 1,
    secondNationId: 0,
    posSig: '0,0,0',
    dobIso: null,
    jobForClub: 1,
    attr48: new Array(48).fill(10),
    ...overrides,
  }
}

function row(ca: number, attr48: number[]): UiPlayerRow {
  const player = { current_ability: ca, potential_ability: 180 } as PlayerRecord
  const staff = { id: 99 } as StaffRecord
  return {
    staffId: 99,
    staffIndex: 5,
    name: 'Young Star',
    club: 'Arsenal',
    age: 19,
    ca,
    pa: 180,
    player,
    staff,
  } as UiPlayerRow
}

describe('playerDevelopment', () => {
  it('detects attribute increases and decreases', () => {
    const before = new Array(48).fill(10)
    const after = [...before]
    after[9] = 14 // Off the ball
    after[23] = 8 // Injury proneness (lower is better)
    const deltas = compareAttr48(before, after)
    expect(deltas).toHaveLength(2)
    const otb = deltas.find((d) => d.index === 9)!
    expect(otb.delta).toBe(4)
    expect(otb.improved).toBe(true)
    const inj = deltas.find((d) => d.index === 23)!
    expect(inj.delta).toBe(-2)
    expect(inj.improved).toBe(true)
  })

  it('builds summary with CA delta', () => {
    const before = new Array(48).fill(12)
    const after = [...before]
    after[0] = 15
    const sum = buildPlayerDevelopmentSummary(row(130, after), entry({ ca: 120, attr48: before }), after)
    expect(sum?.caDelta).toBe(10)
    expect(sum?.attrsUp).toBe(1)
    expect(sum?.netAttrPoints).toBe(3)
  })

  it('baselineTracksDevelopment requires attr48 on v1 or version 2', () => {
    const v1NoAttrs: RegenBaselineFile = {
      version: 1,
      indexPath: '/x',
      pathKey: 'k',
      gameDateIso: null,
      createdIso: '',
      entries: { '1': entry({ attr48: undefined }) },
    }
    expect(baselineTracksDevelopment(v1NoAttrs)).toBe(false)
    const v2: RegenBaselineFile = { ...v1NoAttrs, version: 2 }
    expect(baselineTracksDevelopment(v2)).toBe(true)
  })

  it('filters onlyChanged rows', () => {
    const unchanged = {
      staffId: 1,
      staffIndex: 1,
      name: 'A',
      club: 'X',
      age: 20,
      caBefore: 100,
      caAfter: 100,
      caDelta: 0,
      paBefore: 150,
      paAfter: 150,
      paDelta: 0,
      attrsUp: 0,
      attrsDown: 0,
      netAttrPoints: 0,
      topGains: [],
      topLosses: [],
      deltas: [],
    }
    const changed = { ...unchanged, staffId: 2, name: 'B', caAfter: 110, caDelta: 10, deltas: [] }
    const out = filterAndSortDevelopmentRows([unchanged, changed], { onlyChanged: true })
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('B')
  })
})
