import { describe, expect, it } from 'vitest'
import { isAwardOrNominationCompetition, isAwardOrNominationCompetitionId } from './competitionNames'

describe('isAwardOrNominationCompetition', () => {
  it('flags award and nomination competition names', () => {
    expect(isAwardOrNominationCompetition('European Footballer of the Year')).toBe(true)
    expect(isAwardOrNominationCompetition('Premier League Team of the Year')).toBe(true)
    expect(isAwardOrNominationCompetition('Greek Super League')).toBe(false)
  })

  it('resolves by competition id map', () => {
    const names = new Map<number, string>([
      [1, 'Greek Super League'],
      [2, 'European Footballer of the Year'],
    ])
    expect(isAwardOrNominationCompetitionId(1, names)).toBe(false)
    expect(isAwardOrNominationCompetitionId(2, names)).toBe(true)
    expect(isAwardOrNominationCompetitionId(99, names)).toBe(false)
  })
})
