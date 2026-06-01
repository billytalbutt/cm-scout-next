import { describe, expect, it } from 'vitest'
import { computeMovementArrow } from './tacticsPitchSnap'

describe('computeMovementArrow', () => {
  it('uses forward when target row is higher on the pitch', () => {
    expect(computeMovementArrow('mc', 'am', 0.5, 0.5)).toBe('forward')
  })

  it('uses back when target row is deeper', () => {
    expect(computeMovementArrow('am', 'mc', 0.5, 0.5)).toBe('back')
  })
})
