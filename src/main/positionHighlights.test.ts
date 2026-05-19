import { describe, expect, it } from 'vitest'
import {
  computeHighlightSets,
  ENGINE_BREAKERS_BY_ROLE,
  UNIVERSAL_HIDDEN_ENGINE_BREAKERS,
  UNIVERSAL_STAFF_HIDDEN_ENGINE_BREAKERS,
} from './positionHighlights'
import type { PlayerRecord } from './database/types'

function minimalPlayer(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id: 1,
    squad_number: 1,
    current_ability: 150,
    potential_ability: 180,
    home_reputation: 100,
    current_reputation: 100,
    world_reputation: 100,
    goalkeeper: 1,
    sweeper: 1,
    defender: 1,
    defensive_midfielder: 1,
    midfielder: 1,
    attacking_midfielder: 1,
    attacker: 1,
    wing_back: 1,
    right_side: 10,
    left_side: 10,
    centre_side: 10,
    ...overrides,
  } as PlayerRecord
}

describe('positionHighlights engine breakers', () => {
  it('exposes 2–4 bankers per role', () => {
    for (const role of Object.keys(ENGINE_BREAKERS_BY_ROLE) as (keyof typeof ENGINE_BREAKERS_BY_ROLE)[]) {
      const n = ENGINE_BREAKERS_BY_ROLE[role].length
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(4)
    }
  })

  it('marks ST engine breakers for a natural striker', () => {
    const p = minimalPlayer({ attacker: 20, midfielder: 5, defender: 5, goalkeeper: 1 })
    const hl = computeHighlightSets(p)
    expect(hl.playerEngineBreaker.has('finishing')).toBe(true)
    expect(hl.playerEngineBreaker.has('off_the_ball')).toBe(true)
    expect(hl.playerEngineBreaker.has('passing')).toBe(false)
  })

  it('always marks universal hidden engine breakers', () => {
    const p = minimalPlayer({ goalkeeper: 20, attacker: 1 })
    const hl = computeHighlightSets(p)
    for (const key of UNIVERSAL_HIDDEN_ENGINE_BREAKERS) {
      expect(hl.playerEngineBreaker.has(key)).toBe(true)
    }
    for (const key of UNIVERSAL_STAFF_HIDDEN_ENGINE_BREAKERS) {
      expect(hl.playerEngineBreaker.has(key)).toBe(true)
    }
  })

  it('merges engine breakers when multiple naturals', () => {
    const p = minimalPlayer({
      midfielder: 18,
      attacking_midfielder: 18,
      attacker: 5,
      defender: 5,
    })
    const hl = computeHighlightSets(p)
    expect(hl.playerEngineBreaker.has('technique')).toBe(true)
    expect(hl.playerEngineBreaker.has('creativity')).toBe(true)
  })
})
