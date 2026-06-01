import { describe, expect, it } from 'vitest'
import { TACTIC_PRESETS } from './tacticsCommunityPresets'
import {
  assignColumnsOnRow,
  evenRowXPositions,
  PITCH_COLUMNS,
  PITCH_NARROW_PAIR_X,
  rowXPositionsForCount,
  pitchRowKey,
  pitchSlotsFromPreset,
  roleForColumn,
  rolesForRowPositions,
  rolesForTacticalRow,
  snapAndRedistributePitch,
  tacticalRowForY,
  type PitchSlot,
} from './tacticsPitchSnap'

function rowAt(slots: PitchSlot[], rowId: ReturnType<typeof tacticalRowForY>): PitchSlot[] {
  return slots.filter((s) => tacticalRowForY(s.y) === rowId).sort((a, b) => a.x - b.x)
}

function pct(xs: number[]): number[] {
  return xs.map((x) => Math.round(x * 100))
}

describe('PITCH_COLUMNS', () => {
  it('defines five CM-style horizontal slots', () => {
    expect([...PITCH_COLUMNS]).toEqual([0.1, 0.3, 0.5, 0.7, 0.9])
  })
})

describe('rolesForRowPositions', () => {
  it('labels narrow three at the back as DC not DL/DR', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'D', x: 0.28, y: 0.28, arrow: 'none' },
      { id: 'b', role: 'D', x: 0.5, y: 0.28, arrow: 'none' },
      { id: 'c', role: 'D', x: 0.72, y: 0.28, arrow: 'none' },
    ]
    const xs = [0.3, 0.5, 0.7]
    expect(rolesForRowPositions('def', slots, xs)).toEqual(['DC', 'DC', 'DC'])
  })
})

describe('rowXPositionsForCount', () => {
  it('places two central midfielders in the narrow half-space (0.4 / 0.6)', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'MC', x: 0.35, y: 0.52, arrow: 'none' },
      { id: 'b', role: 'MC', x: 0.65, y: 0.52, arrow: 'none' },
    ]
    expect(rowXPositionsForCount(slots)).toEqual([...PITCH_NARROW_PAIR_X])
  })
})

describe('assignColumnsOnRow', () => {
  it('keeps two central players narrow instead of touchline-to-touchline', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'ST', x: 0.38, y: 0.78, arrow: 'none' },
      { id: 'b', role: 'ST', x: 0.62, y: 0.78, arrow: 'none' },
    ]
    const cols = assignColumnsOnRow(slots)
    expect(cols.map((c) => PITCH_COLUMNS[c])).toEqual([0.3, 0.7])
  })

  it('places three narrow AMs on centre-left, centre, centre-right', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'AM', x: 0.28, y: 0.64, arrow: 'none' },
      { id: 'b', role: 'AM', x: 0.5, y: 0.64, arrow: 'none' },
      { id: 'c', role: 'AM', x: 0.72, y: 0.64, arrow: 'none' },
    ]
    const cols = assignColumnsOnRow(slots)
    expect(cols.map((c) => PITCH_COLUMNS[c])).toEqual([0.3, 0.5, 0.7])
  })

  it('allows wide ML–MC–MR when dragged to the flanks', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'M', x: 0.12, y: 0.52, arrow: 'none' },
      { id: 'b', role: 'M', x: 0.5, y: 0.52, arrow: 'none' },
      { id: 'c', role: 'M', x: 0.88, y: 0.52, arrow: 'none' },
    ]
    const cols = assignColumnsOnRow(slots)
    expect(cols.map((c) => PITCH_COLUMNS[c])).toEqual([0.1, 0.5, 0.9])
  })
})

describe('evenRowXPositions', () => {
  it('uses column positions for five players', () => {
    expect(evenRowXPositions(5)).toEqual([...PITCH_COLUMNS])
  })
})

describe('rolesForTacticalRow', () => {
  it('maps row + count to CM0102 role labels', () => {
    expect(rolesForTacticalRow('dm', 1)).toEqual(['DMC'])
    expect(rolesForTacticalRow('mc', 3)).toEqual(['ML', 'MC', 'MR'])
    expect(rolesForTacticalRow('fwd', 2)).toEqual(['STCL', 'STCR'])
  })
})

describe('roleForColumn', () => {
  it('maps column index to CM role on each row', () => {
    expect(roleForColumn('mc', 0)).toBe('ML')
    expect(roleForColumn('mc', 2)).toBe('MC')
    expect(roleForColumn('am', 1)).toBe('AMCL')
    expect(roleForColumn('def', 4)).toBe('DR')
  })
})

describe('snapAndRedistributePitch', () => {
  it('every community preset has eleven slots after snap', () => {
    for (const preset of TACTIC_PRESETS) {
      const slots = pitchSlotsFromPreset(preset)
      expect(slots).toHaveLength(11)
    }
  })

  it('4-1-3-2: narrow central mids and strikers', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '4132_press_short')!
    const slots = pitchSlotsFromPreset(preset)
    const mids = rowAt(slots, 'mc')
    const strikers = rowAt(slots, 'fwd')

    expect(pct(mids.map((s) => s.x))).toEqual([30, 50, 70])
    expect(mids.map((s) => s.role)).toEqual(['MCL', 'MC', 'MCR'])
    expect(pct(strikers.map((s) => s.x))).toEqual([40, 60])
    expect(strikers.map((s) => s.role)).toEqual(['STCL', 'STCR'])
  })

  it('keeps four defenders on outer columns after drag', () => {
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
    expect(pct(backFour.map((s) => s.x))).toEqual([10, 30, 70, 90])
    expect(backFour.map((s) => s.role)).toEqual(['DL', 'DCL', 'DCR', 'DR'])
  })

  it('moving AMC to midfield row becomes MC column role', () => {
    const slots = snapAndRedistributePitch([
      { id: '1', role: 'AMC', x: 0.5, y: 0.52, arrow: 'none' },
      { id: '2', role: 'MC', x: 0.3, y: 0.52, arrow: 'none' },
      { id: '3', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
    ])
    const amSlot = slots.find((s) => s.id === '1')!
    expect(tacticalRowForY(amSlot.y)).toBe('mc')
    expect(amSlot.x).toBeCloseTo(0.5, 5)
    expect(amSlot.role).toBe('MC')
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
    expect(pct(defLine.map((s) => s.x))).toEqual([10, 30, 50, 70, 90])
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

  it('two DMs side by side on centre-left and centre-right columns', () => {
    const slots = snapAndRedistributePitch([
      { id: 'gk', role: 'GK', x: 0.5, y: 0.06, arrow: 'none' },
      { id: 'dm1', role: 'DMC', x: 0.35, y: 0.4, arrow: 'none' },
      { id: 'dm2', role: 'DMC', x: 0.65, y: 0.4, arrow: 'none' },
    ])
    const dms = rowAt(slots, 'dm')
    expect(pct(dms.map((s) => s.x))).toEqual([30, 70])
    expect(dms.map((s) => s.role)).toEqual(['DMCL', 'DMCR'])
  })
})

describe('pitchRowKey', () => {
  it('uses tactical row Y', () => {
    expect(pitchRowKey(0.52)).toBe(0.52)
  })
})
