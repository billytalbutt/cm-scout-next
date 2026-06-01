import { describe, expect, it } from 'vitest'
import { movementArrowForDrag, snapArrowDragTarget } from './tacticsArrowDrag'
import { computeMovementArrow } from './tacticsPitchSnap'

describe('computeMovementArrow', () => {
  it('uses forward when target row is higher on the pitch', () => {
    expect(computeMovementArrow('mc', 'am', 0.5, 0.5)).toBe('forward')
  })

  it('uses back when target row is deeper', () => {
    expect(computeMovementArrow('am', 'mc', 0.5, 0.5)).toBe('back')
  })

  it('uses diagonal when target row and column differ', () => {
    expect(computeMovementArrow('mc', 'am', 0.3, 0.7)).toBe('forward-right')
    expect(computeMovementArrow('am', 'def', 0.7, 0.3)).toBe('back-left')
  })
})

describe('snapArrowDragTarget', () => {
  it('keeps horizontal position for diagonal arrow endpoints', () => {
    const t = snapArrowDragTarget(0.72, 0.64)
    expect(t.x).toBeCloseTo(0.72, 2)
    expect(t.rowId).toBe('am')
  })
})

describe('movementArrowForDrag', () => {
  it('derives diagonal arrow from free target x', () => {
    const target = snapArrowDragTarget(0.1, 0.64)
    expect(movementArrowForDrag('mc', 0.5, target)).toBe('forward-left')
  })
})
