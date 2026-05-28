import { describe, expect, it } from 'vitest'
import {
  fmtContractBonus,
  fmtWage,
  squadStatusLabel,
  transferArrangedLabel,
} from './contractEditorDisplay'
import { contractTypeLabel } from './contractTypes'

describe('contractEditorDisplay', () => {
  it('formats bonuses with -1 as None', () => {
    expect(fmtContractBonus(-1)).toBe('None')
    expect(fmtContractBonus(500)).toBe('500')
  })

  it('labels contract type bytes like filters', () => {
    expect(contractTypeLabel(2)).toMatch(/Full time/)
  })

  it('labels squad status', () => {
    expect(squadStatusLabel(1)).toBe('Key player')
  })

  it('formats transfer arranged club', () => {
    expect(transferArrangedLabel(-1)).toBe('None')
    expect(transferArrangedLabel(0)).toBe('None')
    expect(transferArrangedLabel(100, 'Arsenal')).toBe('Arsenal')
  })

  it('formats wage', () => {
    expect(fmtWage(1500)).toBe('2k')
  })
})
