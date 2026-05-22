import { describe, expect, it } from 'vitest'
import {
  staffHiddenAttrDisplay,
  staffHiddenFilterValue,
  staffPositionPrefLabel,
  staffTacticalTraitLabel,
} from './cm0102StaffHiddenDisplay'

describe('cm0102StaffHiddenDisplay', () => {
  it('does not map unset position prefs to display 1', () => {
    expect(staffPositionPrefLabel(-1)).toBe('Not set')
    const d = staffHiddenAttrDisplay('attackerPref', -1)
    expect(d.displayText).toBe('Not set')
    expect(d.inGame).toBe(0)
    expect(d.raw).toBe(-1)
    expect(staffHiddenFilterValue('attackerPref', -1)).toBeNull()
  })

  it('maps coaching technique and formation as categories', () => {
    expect(staffHiddenAttrDisplay('coachingTechnique', 1).displayText).toBe('Fitness-based')
    expect(staffHiddenAttrDisplay('coachingTechnique', -1).displayText).toBe('General')
    expect(staffHiddenAttrDisplay('formation', 3).displayText).toBe('4-4-2')
  })

  it('maps tactical traits with threshold phrases', () => {
    expect(staffTacticalTraitLabel('marking', 5)).toBe('Inactive (5/20)')
    expect(staffTacticalTraitLabel('marking', 15)).toContain('man-marking')
    expect(staffHiddenAttrDisplay('offside', 5).displayText).toBe('Inactive (5/20)')
    expect(staffHiddenAttrDisplay('pressing', 20).displayText).toContain('close down')
  })

  it('labels chairman-only bytes', () => {
    expect(staffHiddenAttrDisplay('business', 12).displayText).toContain('chairman only')
  })
})
