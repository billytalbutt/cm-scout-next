import { describe, expect, it } from 'vitest'
import { inGameCa18, inGameCa18Uncapped } from './cm0102AttributeDisplay'
import {
  computeEffectivenessFull,
  computePlayerRiskFlags,
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
