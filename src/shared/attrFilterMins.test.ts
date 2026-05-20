import { describe, expect, it } from 'vitest'
import { attrMinStringsFromComparisonVectors } from './attrFilterMins'

describe('attrMinStringsFromComparisonVectors', () => {
  it('fills mins from on-screen values and uses overflow vector above 20', () => {
    const inNorm = Array(48).fill(15)
    const filter48 = Array(48).fill(15)
    inNorm[5] = 20
    filter48[5] = 28
    const mins = attrMinStringsFromComparisonVectors(inNorm, filter48)
    expect(mins[5]).toBe('28')
    expect(mins[0]).toBe('15')
  })

  it('flips injury proneness for filter scale', () => {
    const inNorm = Array(48).fill(10)
    const filter48 = Array(48).fill(10)
    inNorm[23] = 8
    const mins = attrMinStringsFromComparisonVectors(inNorm, filter48)
    expect(mins[23]).toBe('13')
  })
})
