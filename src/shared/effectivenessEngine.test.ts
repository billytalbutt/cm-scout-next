import { describe, expect, it } from 'vitest'
import { inGameCa18, inGameCa18Uncapped } from './cm0102AttributeDisplay'
import {
  computeEffectivenessFull,
  computePlayerRiskFlags,
  defenseBrainFactor,
  valPart,
} from './effectivenessEngine'
import { effectivenessAttrGetter } from '../main/effectivenessAttrGetter'
import type { PlayerRecord, StaffRecord } from '../main/database/types'

function poacherPlayer(finishingIntrinsic: number, otbIntrinsic: number): PlayerRecord {
  return {
    id: 1,
    squad_number: 9,
    current_ability: 200,
    potential_ability: 200,
    home_reputation: 9000,
    current_reputation: 9000,
    world_reputation: 9000,
    goalkeeper: 1,
    sweeper: 1,
    defender: 5,
    defensive_midfielder: 5,
    midfielder: 8,
    attacking_midfielder: 12,
    attacker: 20,
    wing_back: 5,
    right_side: 12,
    left_side: 12,
    centre_side: 16,
    pace: 20,
    acceleration: 20,
    agility: 18,
    balance: 18,
    jumping: 15,
    stamina: 16,
    strength: 14,
    finishing: finishingIntrinsic,
    off_the_ball: otbIntrinsic,
    technique: 18,
    dribbling: 14,
    flair: 12,
    creativity: 12,
    passing: 14,
    decisions: 16,
    anticipation: 18,
    positioning: 12,
    tackling: 8,
    marking: 6,
    heading: 14,
    long_shots: 14,
    crossing: 10,
    penalties: 16,
    handling: 1,
    one_on_ones: 1,
    reflexes: 1,
    throw_ins: 8,
    consistency: 18,
    dirtiness: 8,
    important_matches: 18,
    injury_proneness: 6,
    natural_fitness: 18,
    corners: 10,
    free_kicks: 10,
  } as PlayerRecord
}

const staffStub = { determination: 18, professionalism: 17 } as StaffRecord

describe('valPart overflow', () => {
  it('rewards display above 20 beyond flat GOD_MULT', () => {
    expect(valPart(20)).toBeCloseTo(1.25, 5)
    expect(valPart(23)).toBeGreaterThan(valPart(20))
    expect(valPart(30)).toBeGreaterThan(valPart(23))
    expect(valPart(30)).toBeCloseTo(2.25, 5)
  })
})

describe('recipe normalization', () => {
  const stOnly = new Set(['st'])

  it('all on-screen 20s on ST recipe land in high-80s after consistency', () => {
    const p = poacherPlayer(20, 20)
    p.pace = 20
    p.acceleration = 20
    p.agility = 20
    p.jumping = 20
    p.strength = 20
    p.consistency = 18
    const get = effectivenessAttrGetter(p, staffStub)
    const full = computeEffectivenessFull(get, stOnly)
    expect(full.effPercent).not.toBeNull()
    expect(full.effPercent!).toBeGreaterThanOrEqual(88)
  })
})

describe('effectivenessAttrGetter uncapped', () => {
  it('uses inGameUncapped for CA18 attrs so finishing/OTB can exceed 20', () => {
    const p = poacherPlayer(26, 30)
    const get = effectivenessAttrGetter(p, staffStub)
    const finIdx = 5
    const otbIdx = 9
    expect(inGameCa18(finIdx, p.current_ability, p.finishing, p)).toBe(20)
    expect(inGameCa18Uncapped(finIdx, p.current_ability, p.finishing, p)).toBeGreaterThan(20)
    expect(get('finishing')).toBeGreaterThan(20)
    expect(get('off_the_ball')).toBeGreaterThan(20)
  })
})

describe('poacher effectiveness', () => {
  const stOnly = new Set(['st'])

  it('scores higher with uncapped engine display than capped 1–20', () => {
    const p = poacherPlayer(26, 30)
    const getUncapped = effectivenessAttrGetter(p, staffStub)
    const getCapped = (name: string) => Math.min(20, getUncapped(name))

    const hi = computeEffectivenessFull(getUncapped, stOnly)
    const lo = computeEffectivenessFull(getCapped, stOnly)

    expect(hi.effPercent).not.toBeNull()
    expect(lo.effPercent).not.toBeNull()
    expect(hi.effPercent!).toBeGreaterThan(lo.effPercent!)
    expect(hi.effPercent! - lo.effPercent!).toBeGreaterThanOrEqual(5)
    expect(hi.effPercent!).toBeGreaterThanOrEqual(90)
    expect(hi.byArchetype).toHaveLength(1)
    expect(hi.byArchetype[0]!.percent).toBe(hi.effPercent)
    const finLine = hi.winnerDetail?.lines.find((l) => l.key === 'finishing')
    expect(finLine?.overflow).toBe(true)
    expect(finLine?.raw).toBeGreaterThan(20)
  })
})

describe('injury proneness does not affect Eff %', () => {
  const stOnly = new Set(['st'])

  it('same Eff % when only injury proneness differs', () => {
    const lowInjury = poacherPlayer(26, 30)
    lowInjury.injury_proneness = 4
    const highInjury = poacherPlayer(26, 30)
    highInjury.injury_proneness = 18

    const getLow = effectivenessAttrGetter(lowInjury, staffStub)
    const getHigh = effectivenessAttrGetter(highInjury, staffStub)
    const effLow = computeEffectivenessFull(getLow, stOnly)
    const effHigh = computeEffectivenessFull(getHigh, stOnly)

    expect(effLow.effPercent).toBe(effHigh.effPercent)
    expect(computePlayerRiskFlags(getLow).injuryRisk).toBe(false)
    expect(computePlayerRiskFlags(getHigh).injuryRisk).toBe(true)
  })
})

describe('DMC effectiveness (no double brain penalty)', () => {
  const dmcOnly = new Set(['dmc'])

  function anchorDmcPlayer(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
    return {
      id: 1,
      squad_number: 6,
      current_ability: 153,
      potential_ability: 170,
      home_reputation: 5000,
      current_reputation: 5000,
      world_reputation: 5000,
      goalkeeper: 1,
      sweeper: 8,
      defender: 14,
      defensive_midfielder: 20,
      midfielder: 17,
      attacking_midfielder: 10,
      attacker: 8,
      wing_back: 10,
      right_side: 12,
      left_side: 12,
      centre_side: 16,
      positioning: 20,
      tackling: 18,
      stamina: 18,
      marking: 17,
      anticipation: 15,
      decisions: 16,
      strength: 16,
      teamwork: 16,
      passing: 16,
      technique: 16,
      creativity: 14,
      work_rate: 12,
      pace: 15,
      acceleration: 15,
      aggression: 14,
      bravery: 16,
      heading: 15,
      jumping: 14,
      balance: 15,
      agility: 14,
      crossing: 11,
      dribbling: 12,
      finishing: 11,
      flair: 2,
      long_shots: 13,
      off_the_ball: 14,
      penalties: 12,
      handling: 1,
      one_on_ones: 1,
      reflexes: 1,
      throw_ins: 10,
      consistency: 19,
      dirtiness: 8,
      important_matches: 19,
      injury_proneness: 3,
      natural_fitness: 18,
      corners: 11,
      free_kicks: 11,
      ...overrides,
    } as PlayerRecord
  }

  const staffAnchor = { determination: 17, professionalism: 18, teamwork: 16 } as StaffRecord

  it('strong DMC regen with solid mentals scores high-60s/low-70s, not ~40%', () => {
    const p = anchorDmcPlayer()
    const get = effectivenessAttrGetter(p, staffAnchor)
    const full = computeEffectivenessFull(get, dmcOnly)
    expect(full.effPercent).not.toBeNull()
    expect(full.effPercent!).toBeGreaterThan(65)
    expect(full.effPercent!).toBeLessThan(88)
    expect(full.winnerDetail?.brainMult).toBeUndefined()
    expect(full.byArchetype[0]!.archetypeId).toBe('dmc')
  })
})

describe('defenseBrainFactor (DC)', () => {
  it('uses average mentals so 16/15 is not crushed like the old product formula', () => {
    expect(defenseBrainFactor(20, 20)).toBeCloseTo(1, 5)
    expect(defenseBrainFactor(16, 15)).toBeGreaterThan(0.8)
    expect(defenseBrainFactor(16, 15)).toBeLessThan(0.9)
    const oldProduct = (16 / 20) * (15 / 20)
    expect(defenseBrainFactor(16, 15)).toBeGreaterThan(oldProduct + 0.25)
  })
})

describe('false-positive control (weak primaries)', () => {
  const stOnly = new Set(['st'])

  it('mediocre finisher profile stays below elite poacher Eff %', () => {
    const weak = poacherPlayer(12, 12)
    weak.pace = 12
    weak.acceleration = 12
    weak.finishing = 12
    weak.off_the_ball = 12
    weak.injury_proneness = 4
    const elite = poacherPlayer(26, 30)
    const getWeak = effectivenessAttrGetter(weak, staffStub)
    const getElite = effectivenessAttrGetter(elite, staffStub)
    const weakEff = computeEffectivenessFull(getWeak, stOnly)
    const eliteEff = computeEffectivenessFull(getElite, stOnly)
    expect(weakEff.effPercent).not.toBeNull()
    expect(eliteEff.effPercent).not.toBeNull()
    expect(weakEff.effPercent!).toBeLessThan(80)
    expect(eliteEff.effPercent! - weakEff.effPercent!).toBeGreaterThan(10)
  })
})
