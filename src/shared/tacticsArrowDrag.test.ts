import { describe, expect, it } from 'vitest'
import {
  computeMovementArrowLine,
  movementArrowForDrag,
  snapArrowDragTarget,
} from './tacticsArrowDrag'
import { computeMovementArrow, type PitchSlot } from './tacticsPitchSnap'

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

  it('uses left/right on the same row', () => {
    expect(computeMovementArrow('mc', 'mc', 0.7, 0.3)).toBe('left')
    expect(computeMovementArrow('mc', 'mc', 0.3, 0.7)).toBe('right')
  })
})

describe('snapArrowDragTarget', () => {
  it('snaps to nearest grid column on the row', () => {
    const t = snapArrowDragTarget(0.72, 0.64)
    expect(t.x).toBe(0.7)
    expect(t.rowId).toBe('am')
  })

  it('snaps to an existing player on the target row', () => {
    const slots: PitchSlot[] = [
      { id: 'a', role: 'AMC', x: 0.4, y: 0.64, arrow: 'none' },
    ]
    const t = snapArrowDragTarget(0.42, 0.64, slots, 'src')
    expect(t.x).toBe(0.4)
  })
})

describe('computeMovementArrowLine', () => {
  it('starts and ends on icon edges, not centres', () => {
    const line = computeMovementArrowLine('t', 'src', 0.5, 0.52, 'am', 0.5, [])
    expect(line).not.toBeNull()
    if (!line) return
    expect(line.y1).toBeGreaterThan((1 - 0.52) * 100)
    expect(line.y2).toBeLessThan(line.y1)
  })

  it('targets occupied cell at the near edge of the other icon', () => {
    const slots: PitchSlot[] = [
      { id: 'src', role: 'MC', x: 0.5, y: 0.52, arrow: 'none' },
      { id: 'tgt', role: 'AMC', x: 0.5, y: 0.64, arrow: 'none' },
    ]
    const line = computeMovementArrowLine('t', 'src', 0.5, 0.52, 'am', 0.5, slots)
    expect(line).not.toBeNull()
    if (!line) return
    const targetCentreY = (1 - 0.64) * 100
    expect(line.y2).toBeGreaterThan(targetCentreY)
  })
})

describe('movementArrowForDrag', () => {
  it('derives diagonal arrow from grid target', () => {
    const target = snapArrowDragTarget(0.1, 0.64)
    expect(movementArrowForDrag('mc', 0.5, target)).toBe('forward-left')
  })
})
