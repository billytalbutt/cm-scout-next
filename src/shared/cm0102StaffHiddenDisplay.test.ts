import { describe, expect, it } from 'vitest'
import {
  staffHiddenAttrDisplay,
  staffHiddenColumnForKey,
  staffHiddenFilterValue,
  staffHiddenMeaningfulForDisplay,
  STAFF_JOB_CHAIRMAN,
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

  it('chairman traits use numeric 1–20 display', () => {
    const d = staffHiddenAttrDisplay('business', 12)
    expect(d.displayText).toBeUndefined()
    expect(d.inGame).toBe(12)
    expect(staffHiddenColumnForKey('business')).toBe('numeric')
    expect(staffHiddenColumnForKey('pressing')).toBe('text')
  })

  it('staffHiddenMeaningfulForDisplay matches CM profile visibility', () => {
    expect(staffHiddenMeaningfulForDisplay('attacking', 6, 8)).toBe(false)
    expect(staffHiddenMeaningfulForDisplay('attacking', 15, 8)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('attackerPref', -1, 8)).toBe(false)
    expect(staffHiddenMeaningfulForDisplay('attackerPref', 12, 8)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('business', 12, 8)).toBe(false)
    expect(staffHiddenMeaningfulForDisplay('business', 12, STAFF_JOB_CHAIRMAN)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('business', 12, 2)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('coachingTechnique', -1, 8)).toBe(false)
    expect(staffHiddenMeaningfulForDisplay('coachingTechnique', 1, 8)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('formation', 0, 8)).toBe(false)
    expect(staffHiddenMeaningfulForDisplay('formation', 3, 8)).toBe(true)
    expect(staffHiddenMeaningfulForDisplay('ambition', 10, 8)).toBe(true)
  })
})
