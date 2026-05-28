import { describe, expect, it } from 'vitest'
import { computeEffectivenessFull } from './effectivenessEngine'
import { buildEffectivenessNarrative } from './effectivenessNarrative'

describe('buildEffectivenessNarrative', () => {
  it('describes an AMC hub with high technique and passing', () => {
    const get = (name: string): number => {
      const m: Record<string, number> = {
        technique: 20,
        decisions: 18,
        passing: 17,
        creativity: 19,
        off_the_ball: 13,
        anticipation: 16,
        consistency: 20,
        important_matches: 20,
        determination: 19,
        professionalism: 19,
        teamwork: 15,
        dribbling: 9,
      }
      return m[name] ?? 12
    }
    const full = computeEffectivenessFull(get, new Set(['amc']))
    const narrative = buildEffectivenessNarrative({
      result: full,
      playerName: 'Test Player',
      cmScoutRatingBp: 68.9,
    })
    expect(narrative).not.toBeNull()
    expect(narrative!.headline).toContain('AMC')
    expect(narrative!.summary.toLowerCase()).toContain('technique')
    expect(narrative!.summary.toLowerCase()).toContain('playmaker')
  })
})
