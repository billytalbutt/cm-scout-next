import { describe, expect, it } from 'vitest'
import {
  buildStaffCoachPreferenceLines,
  coachingStyleLabel,
  preferredFormationLabel,
  preferredPlayingStyleLabel,
} from './cm0102StaffProfileText'

describe('cm0102StaffProfileText', () => {
  it('maps preference bytes to in-game phrases', () => {
    expect(coachingStyleLabel(1)).toBe('Fitness-based')
    expect(coachingStyleLabel(2)).toBe('Technique-based')
    expect(preferredFormationLabel(3)).toBe('4-4-2')
    expect(preferredPlayingStyleLabel(7)).toBe('Prefers a direct attacking style of play')
  })

  it('builds Pomaski-style preference block', () => {
    const lines = buildStaffCoachPreferenceLines({
      coachingTechnique: 1,
      formation: 3,
      directness: 7,
      pressing: 20,
      offside: 5,
      marking: 5,
    })
    expect(lines.coachingStyle).toBe('Fitness-based')
    expect(lines.coachingStyle).not.toBe('Technique-based')
    expect(lines.preferredFormation).toBe('4-4-2')
    expect(lines.preferredStyle).toContain('direct attacking')
    expect(lines.closesDownOpposition).toBe(true)
    expect(lines.playsOffsideTrap).toBe(false)
    expect(lines.usesManMarking).toBe(false)
  })
})
