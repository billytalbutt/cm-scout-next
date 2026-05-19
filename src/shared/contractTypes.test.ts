import { describe, expect, it } from 'vitest'
import { contractTypeLabel, contractTypeMatchesCategory } from './contractTypes'

describe('contractTypes', () => {
  it('matches CM Scout full-time monthly bytes', () => {
    expect(contractTypeMatchesCategory(0x01, 'ft_monthly')).toBe(true)
    expect(contractTypeMatchesCategory(0x41, 'ft_monthly')).toBe(true)
    expect(contractTypeMatchesCategory(0x02, 'ft_monthly')).toBe(false)
  })

  it('labels standard full-time contract', () => {
    expect(contractTypeLabel(0x02)).toBe('Full time — standard')
    expect(contractTypeLabel(0x81)).toBe('Part time — monthly')
  })
})
