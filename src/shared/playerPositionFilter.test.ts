import { describe, expect, it } from 'vitest'
import { passesPlayerPositionFilter, POSITION_NATURAL_MIN } from './playerPositionFilter'
import type { PlayerRecord } from '../main/database/types'

function basePlayer(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  const low = POSITION_NATURAL_MIN
  return {
    id: 1,
    squad_number: 1,
    current_ability: 150,
    potential_ability: 160,
    home_reputation: 5000,
    current_reputation: 5000,
    world_reputation: 5000,
    goalkeeper: low,
    sweeper: low,
    defender: low,
    defensive_midfielder: low,
    midfielder: low,
    attacking_midfielder: low,
    attacker: low,
    wing_back: low,
    right_side: low,
    left_side: low,
    centre_side: low,
    free_role: low,
    acceleration: 10,
    aggression: 10,
    agility: 10,
    anticipation: 10,
    balance: 10,
    bravery: 10,
    consistency: 10,
    corners: 10,
    crossing: 10,
    decisions: 10,
    dirtiness: 10,
    dribbling: 10,
    finishing: 10,
    flair: 10,
    free_kicks: 10,
    handling: 10,
    heading: 10,
    important_matches: 10,
    injury_proneness: 10,
    jumping: 10,
    influence: 10,
    left_foot: 10,
    long_shots: 10,
    marking: 10,
    off_the_ball: 10,
    natural_fitness: 10,
    one_on_ones: 10,
    pace: 10,
    passing: 10,
    penalties: 10,
    positioning: 10,
    reflexes: 10,
    right_foot: 10,
    stamina: 10,
    strength: 10,
    tackling: 10,
    teamwork: 10,
    technique: 10,
    throw_ins: 10,
    versatility: 10,
    creativity: 10,
    work_rate: 10,
    morale: 10,
    ...overrides,
  }
}

describe('passesPlayerPositionFilter', () => {
  it('passes all when no roles or sides selected', () => {
    const p = basePlayer({ defender: 18, left_side: 16, right_side: 16 })
    expect(passesPlayerPositionFilter(p, [], [])).toBe(true)
  })

  it('requires every selected role and side (AND)', () => {
    const p = basePlayer({ defender: 18, midfielder: 17, left_side: 16, right_side: 16 })
    expect(passesPlayerPositionFilter(p, ['defender', 'midfielder'], ['left_side', 'right_side'])).toBe(true)
    expect(passesPlayerPositionFilter(p, ['defender'], ['left_side', 'right_side'])).toBe(true)
    expect(passesPlayerPositionFilter(p, ['attacker'], ['left_side'])).toBe(false)

    const leftOnly = basePlayer({ defender: 18, left_side: 16, right_side: 10 })
    expect(passesPlayerPositionFilter(leftOnly, ['defender'], ['right_side'])).toBe(false)
    expect(passesPlayerPositionFilter(leftOnly, ['defender'], ['left_side'])).toBe(true)
  })
})
