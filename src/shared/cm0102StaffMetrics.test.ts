import { describe, expect, it } from 'vitest'
import {
  cm0102CoachingAbilityWord,
  cm0102ReputationWord,
  sanitizeStaffAbility,
  sanitizeStaffReputation,
} from './cm0102StaffMetrics'

describe('cm0102StaffMetrics', () => {
  it('drops invalid ability and reputation sentinels', () => {
    expect(sanitizeStaffAbility(65535)).toBeNull()
    expect(sanitizeStaffAbility(0)).toBeNull()
    expect(sanitizeStaffAbility(125)).toBe(125)
    expect(sanitizeStaffReputation(6)).toBeNull()
    expect(sanitizeStaffReputation(199)).toBeNull()
    expect(sanitizeStaffReputation(65527)).toBeNull()
    expect(sanitizeStaffReputation(3750)).toBe(3750)
  })

  it('maps reputation to in-game style words', () => {
    expect(cm0102ReputationWord(350)).toBe('Unproven')
    expect(cm0102ReputationWord(1500)).toBe('Poor')
    expect(cm0102ReputationWord(3000)).toBe('OK')
    expect(cm0102ReputationWord(6000)).toBe('Very Good')
    expect(cm0102ReputationWord(7500)).toBe('Superb')
  })

  it('maps coaching CA to morale-style words', () => {
    expect(cm0102CoachingAbilityWord(60)).toBe('Poor')
    expect(cm0102CoachingAbilityWord(125)).toBe('Good')
    expect(cm0102CoachingAbilityWord(200)).toBe('Superb')
  })
})
