import { describe, expect, it } from 'vitest'
import { TACTIC_PRESETS } from './tacticsCommunityPresets'
import {
  CM_PAIR_NARROW,
  CM_ROW_X_BY_COUNT,
  pitchRowKey,
  pitchSlotsFromPreset,
  snapAndRedistributePitch,
  snapXPositionsForRow,
  type PitchSlot,
} from './tacticsPitchSnap'

function rowAtY(slots: PitchSlot[], y: number): PitchSlot[] {
  const key = pitchRowKey(y)
  return slots.filter((s) => pitchRowKey(s.y) === key).sort((a, b) => a.x - b.x)
}

describe('snapXPositionsForRow', () => {
  it('uses full width for four and inner three for three', () => {
    expect(snapXPositionsForRow([slot('DL'), slot('DCL'), slot('DCR'), slot('DR')])).toEqual([
      ...CM_ROW_X_BY_COUNT[4]!,
    ])
    expect(snapXPositionsForRow([slot('MCL'), slot('MC'), slot('MCR')])).toEqual([...CM_ROW_X_BY_COUNT[3]!])
  })

  it('places strikers in a narrow pair, not on outer three-man columns', () => {
    expect(snapXPositionsForRow([slot('STCL'), slot('STCR')])).toEqual([...CM_PAIR_NARROW])
    const outerThree = CM_ROW_X_BY_COUNT[3]!
    expect(CM_PAIR_NARROW[0]).toBeGreaterThan(outerThree[0]!)
    expect(CM_PAIR_NARROW[1]).toBeLessThan(outerThree[2]!)
  })

  it('uses touchline pair for wing-backs and wide-mid pair for ML/MR', () => {
    expect(snapXPositionsForRow([slot('WBL'), slot('WBR')])).toEqual([0.12, 0.88])
    expect(snapXPositionsForRow([slot('ML'), slot('MR')])).toEqual([0.22, 0.78])
  })
})

describe('snapAndRedistributePitch', () => {
  it('4-1-3-2: three mids wide, two strikers tucked inside outer mids', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '4132_press_short')!
    const slots = pitchSlotsFromPreset(preset)
    const mids = rowAtY(slots, 0.54)
    const strikers = rowAtY(slots, 0.8)

    expect(mids.map((s) => s.x)).toEqual([0.28, 0.5, 0.72])
    expect(strikers.map((s) => s.x)).toEqual([0.38, 0.62])
    expect(strikers[0]!.x).toBeGreaterThan(mids[0]!.x)
    expect(strikers[1]!.x).toBeLessThan(mids[2]!.x)
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
    const backFour = rowAtY(slots, 0.28)
    expect(backFour.map((s) => s.x)).toEqual([0.14, 0.38, 0.62, 0.86])
  })

  it('groups three centre-backs on one row despite slight Y offsets', () => {
    const preset = TACTIC_PRESETS.find((p) => p.id === '352_wb')!
    const slots = pitchSlotsFromPreset(preset)
    const centreBacks = slots.filter((s) => s.role === 'DC').sort((a, b) => a.x - b.x)
    expect(centreBacks).toHaveLength(3)
    expect(centreBacks.map((s) => s.x)).toEqual([0.28, 0.5, 0.72])
  })
})

function slot(role: string): PitchSlot {
  return { id: role, role, x: 0.5, y: 0.5, arrow: 'none' }
}
