import { describe, expect, it } from 'vitest'
import {
  aggregateCategoryWins,
  attrCategoryForKey,
  compareAttrCells,
  type CompareAttrCell,
} from './comparePlayers'

function cell(key: string, inGame: number, invert?: boolean): CompareAttrCell {
  return { key, label: key, inGame, invert }
}

describe('compareAttrCells', () => {
  it('picks higher in-game value when not inverted', () => {
    expect(compareAttrCells(cell('pace', 15), cell('pace', 12), false)).toBe('left')
    expect(compareAttrCells(cell('pace', 10), cell('pace', 14), false)).toBe('right')
  })

  it('inverts winner for lower-is-better attrs', () => {
    expect(
      compareAttrCells(
        { ...cell('injury_proneness', 5), invert: true },
        { ...cell('injury_proneness', 18), invert: true },
        false,
      ),
    ).toBe('left')
  })

  it('ties on equal values', () => {
    expect(compareAttrCells(cell('pace', 12), cell('pace', 12), false)).toBe('tie')
  })
})

describe('aggregateCategoryWins', () => {
  it('counts left/right wins per category', () => {
    const rows = [
      { left: cell('finishing', 16), right: cell('finishing', 12) },
      { left: cell('tackling', 10), right: cell('tackling', 14) },
      { left: cell('pace', 14), right: cell('pace', 14) },
    ]
    const agg = aggregateCategoryWins(rows, false)
    expect(agg.attacking.left).toBe(1)
    expect(agg.defending.right).toBe(1)
    expect(agg.physical.left).toBe(0)
    expect(agg.physical.right).toBe(0)
  })
})

describe('attrCategoryForKey', () => {
  it('maps known keys', () => {
    expect(attrCategoryForKey('finishing')).toBe('attacking')
    expect(attrCategoryForKey('tackling')).toBe('defending')
    expect(attrCategoryForKey('unknown_attr')).toBe('other')
  })
})
