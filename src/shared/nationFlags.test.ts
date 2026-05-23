import { describe, expect, it } from 'vitest'
import { isoCountryCodeToFlag, nationNameToFlagEmoji, splitNationDisplay } from './nationFlags'

describe('nationFlags', () => {
  it('builds flag from ISO code', () => {
    expect(isoCountryCodeToFlag('IT')).toBe('🇮🇹')
    expect(isoCountryCodeToFlag('ENG')).toBe('')
  })

  it('maps CM nation names', () => {
    expect(nationNameToFlagEmoji('Italy')).toBe('🇮🇹')
    expect(nationNameToFlagEmoji('England')).toBe('🇬🇧')
    expect(nationNameToFlagEmoji('Holland')).toBe('🇳🇱')
  })

  it('splits dual nationality display', () => {
    expect(splitNationDisplay('Italy / Argentina')).toEqual(['Italy', 'Argentina'])
  })
})
