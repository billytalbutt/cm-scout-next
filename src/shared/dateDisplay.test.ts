import { describe, expect, it } from 'vitest'
import { formatIsoDateUk } from './dateDisplay'

describe('formatIsoDateUk', () => {
  it('formats YYYY-MM-DD as DD/MM/YYYY', () => {
    expect(formatIsoDateUk('1973-03-19')).toBe('19/03/1973')
    expect(formatIsoDateUk('2001-08-01')).toBe('01/08/2001')
  })

  it('returns empty for null and passes through unknown strings', () => {
    expect(formatIsoDateUk(null)).toBe('')
    expect(formatIsoDateUk('n/a')).toBe('n/a')
  })
})
