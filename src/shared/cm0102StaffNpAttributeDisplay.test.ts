import { describe, expect, it } from 'vitest'
import { staffNpAttrInGame } from './cm0102StaffNpAttributeDisplay'

/** Giorgos Pomaski–style elite coach (CA 182) — in-game profile from CM0102. */
describe('staffNpAttrInGame (Pomaski reference)', () => {
  const ca = 182

  it('matches in-game coaching profile bytes from save', () => {
    expect(staffNpAttrInGame('coachingGks', 1, ca)).toBe(18)
    expect(staffNpAttrInGame('coaching', 7, ca)).toBe(20)
    expect(staffNpAttrInGame('judgement', 7, ca)).toBe(20)
    expect(staffNpAttrInGame('judgingPotential', 2, ca)).toBe(19)
    expect(staffNpAttrInGame('manHandling', 1, ca)).toBe(16)
    expect(staffNpAttrInGame('motivating', 7, ca)).toBe(20)
    expect(staffNpAttrInGame('tactics', 1, ca)).toBe(13)
  })

  it('leaves already-high style bytes unchanged', () => {
    expect(staffNpAttrInGame('discipline', 20, ca)).toBe(20)
    expect(staffNpAttrInGame('directness', 20, ca)).toBe(20)
    expect(staffNpAttrInGame('youngsters', 20, ca)).toBe(20)
  })
})
