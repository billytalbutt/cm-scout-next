import { describe, expect, it } from 'vitest'
import {
  computeHighlightSets,
  computeHighlightSetsForArchetype,
  computeHighlightSetsForRole,
  pickBestCmScoutRoleIndex,
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
  it('exposes 2–4 forum breakers per role', () => {
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

  it('AMC rings use recipe primaries; forum key attrs get blue labels', () => {
    const amc = computeHighlightSetsForArchetype('amc')
    expect(amc.playerEngineBreaker.has('technique')).toBe(true)
    expect(amc.playerEngineBreaker.has('decisions')).toBe(true)
    expect(amc.playerEngineBreaker.has('passing')).toBe(true)
    expect(amc.playerEngineBreaker.has('dribbling')).toBe(false)
    expect(amc.playerRecipeAccent.has('technique')).toBe(true)
    expect(amc.playerRecipeAccent.has('passing')).toBe(true)
    expect(amc.playerRecipeAccent.has('off_the_ball')).toBe(true)
  })

  it('DMC forum key attrs include marking plus recipe primaries as blue labels', () => {
    const dmc = computeHighlightSetsForArchetype('dmc')
    expect(dmc.playerEngineBreaker.has('positioning')).toBe(true)
    expect(dmc.playerEngineBreaker.has('tackling')).toBe(true)
    expect(dmc.playerRecipeAccent.has('marking')).toBe(true)
    expect(dmc.playerRecipeAccent.has('positioning')).toBe(true)
    expect(dmc.playerRecipeAccent.has('tackling')).toBe(true)
  })

  it('AMW rings differ from AMC (wide attacker vs central hub)', () => {
    const amw = computeHighlightSetsForArchetype('amw')
    const amc = computeHighlightSetsForArchetype('amc')
    expect(amw.playerEngineBreaker.has('pace')).toBe(true)
    expect(amw.playerEngineBreaker.has('dribbling')).toBe(true)
    expect(amc.playerEngineBreaker.has('passing')).toBe(true)
    expect(amw.playerEngineBreaker.has('passing')).toBe(false)
  })

  it('single-role highlights do not merge M and AMC engine breakers', () => {
    const p = minimalPlayer({
      midfielder: 18,
      attacking_midfielder: 18,
      attacker: 5,
      defender: 5,
    })
    const merged = computeHighlightSets(p)
    expect(merged.playerEngineBreaker.has('technique')).toBe(true)

    const mOnly = computeHighlightSetsForRole('M')
    expect(mOnly.playerEngineBreaker.has('technique')).toBe(true)
    expect(mOnly.playerEngineBreaker.has('passing')).toBe(false)

    const amcOnly = computeHighlightSetsForRole('AMC')
    expect(amcOnly.playerEngineBreaker.has('passing')).toBe(true)
    expect(amcOnly.playerEngineBreaker.has('marking')).toBe(false)
  })

  it('pickBestCmScoutRoleIndex prefers suitable roles then highest %', () => {
    const percents = [50, 88, 40, 70, 90, 30, 85]
    const suitable = [false, true, false, true, true, false, true]
    expect(pickBestCmScoutRoleIndex(percents, suitable)).toBe(4)
  })
})
