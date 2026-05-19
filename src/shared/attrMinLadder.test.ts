import { describe, expect, it } from 'vitest'
import { nextAttrMinLadderOnRightClick } from './attrMinLadder'

describe('nextAttrMinLadderOnRightClick', () => {
  it('cycles empty → 5 → 10 → 15 → 20 → empty', () => {
    expect(nextAttrMinLadderOnRightClick('')).toBe('5')
    expect(nextAttrMinLadderOnRightClick('5')).toBe('10')
    expect(nextAttrMinLadderOnRightClick('10')).toBe('15')
    expect(nextAttrMinLadderOnRightClick('15')).toBe('20')
    expect(nextAttrMinLadderOnRightClick('20')).toBe('')
  })
})
