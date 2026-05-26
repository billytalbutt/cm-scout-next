import { describe, expect, it } from 'vitest'
import { TACTIC_PRESETS } from './tacticsCommunityPresets'
import {
  evenRowXPositions,
  pitchRowKey,
  pitchSlotsFromPreset,
  rolesForTacticalRow,
  snapAndRedistributePitch,
  tacticalRowForY,
  type PitchSlot,
} from './tacticsPitchSnap'

function rowAt(slots: PitchSlot[], rowId: ReturnType<typeof tacticalRowForY>): PitchSlot[] {
  return slots.filter((s) => tacticalRowForY(s.y) === rowId).sort((a, b) => a.x - b.x)
}

describe('evenRowXPositions', () => {
  it('spaces five players evenly from touchline to touchline', () => {
    const xs = evenRowXPositions(5)
    expect(xs[0]).toBeCloseTo(0.1, 5)
    expect(xs[4]).toBeCloseTo(0.9, 5)
    expect(xs[2]).toBeCloseTo(0.5, 5)
    expect(xs[2]! - xs[1]!).toBeCloseTo(xs[1]! - xs[0]!, 5)
    expect(xs[4]! - xs[3]!).toBeCloseTo(xs[3]! - xs[2]!, 5)
  })
})

describe('rolesForTacticalRow', () => {
  it('maps row + count to CM0102 role labels', () => {
    expect(rolesForTacticalRow('dm', 1)).toEqual(['DMC'])
    expect(rolesForTacticalRow('mc', 3)).toEqual(['ML', 'MC', 'MR'])
    expect(rolesForTacticalRow('fwd', 2)).toEqual(['STCL', 'STCR'])
  })
})

describe('snapAndRedistributePitch', () => {
  it('every community preset has eleven slots after snap', () => {
    for (const preset of TACTIC_PRESETS) {
      const slots = pitchSlotsFromPreset(preset)
      expect(slots).toHaveLength(11)
    }
  })

  it('4-1-3-2: mids on one line with even spacing; strikers on forward line', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '4132_press_short')!
    const slots = pitchSlotsFromPreset(preset)
    const mids = rowAt(slots, 'mc')
    const strikers = rowAt(slots, 'fwd')

    expect(mids.map((s) => s.x).map((x) => Math.round(x * 100))).toEqual([10, 50, 90])
    expect(mids.every((s) => s.role.startsWith('M'))).toBe(true)
    expect(strikers.map((s) => s.x).map((x) => Math.round(x * 100))).toEqual([10, 90])
    expect(strikers.map((s) => s.role)).toEqual(['STCL', 'STCR'])
  })

  it('keeps four defenders evenly spaced after drag', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '4132_press_short')!
    const messy = preset.slots.map((s, i) => ({
      id: `t-${i}`,
      role: s.role,
      x: s.x + (i % 2 === 0 ? 0.03 : -0.03),
      y: s.y,
      arrow: 'none' as const,
    }))
    const slots = snapAndRedistributePitch(messy)
    const backFour = rowAt(slots, 'def')
    expect(backFour.map((s) => s.x).map((x) => Math.round(x * 100))).toEqual([10, 37, 63, 90])
    expect(backFour.map((s) => s.role)).toEqual(['DL', 'DCL', 'DCR', 'DR'])
  })

  it('moving AMC to midfield row becomes MC', () => {
    const slots = snapAndRedistributePitch([
      { id: '1', role: 'AMC', x: 0.5, y: 0.52, arrow: 'none' },
      { id: '2', role: 'MC', x: 0.3, y: 0.52, arrow: 'none' },
      { id: '3', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
    ])
    const amSlot = slots.find((s) => s.id === '1')!
    expect(tacticalRowForY(amSlot.y)).toBe('mc')
    expect(['MC', 'MCL', 'MCR']).toContain(amSlot.role)
  })

  it('moving DM to forward row becomes striker', () => {
    const slots = snapAndRedistributePitch([
      { id: '1', role: 'DMC', x: 0.5, y: 0.78, arrow: 'none' },
      { id: '2', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
    ])
    expect(slots.find((s) => s.id === '1')!.role).toBe('ST')
  })

  it('352: five on the defence line (wing-backs + three centre-backs)', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '352_wb')!
    const slots = pitchSlotsFromPreset(preset)
    const defLine = rowAt(slots, 'def')
    expect(defLine).toHaveLength(5)
    expect(defLine.map((s) => s.role)).toEqual(['DL', 'DCL', 'DC', 'DCR', 'DR'])
    expect(defLine.map((s) => s.x).map((x) => Math.round(x * 100))).toEqual([10, 30, 50, 70, 90])
  })

  it('only one goalkeeper on the GK line', () => {
    const slots = snapAndRedistributePitch([
      { id: 'gk1', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
      { id: 'gk2', role: 'GK', x: 0.4, y: 0.08, arrow: 'none' },
      { id: 'dc', role: 'DC', x: 0.5, y: 0.28, arrow: 'none' },
    ])
    expect(rowAt(slots, 'gk')).toHaveLength(1)
    expect(rowAt(slots, 'def').length).toBeGreaterThanOrEqual(1)
  })
})

describe('pitchRowKey', () => {
  it('uses tactical row Y', () => {
    expect(pitchRowKey(0.52)).toBe(0.52)
  })
})
