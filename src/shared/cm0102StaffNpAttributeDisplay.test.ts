import { describe, expect, it } from 'vitest'
import {
  staffManManagementInGame,
  staffNpAttrInGame,
  staffTacticsInGame,
} from './cm0102StaffNpAttributeDisplay'

/** Giorgos Pomaski–style elite coach (CA 182) — in-game profile from CM0102. */
describe('staffNpAttrInGame (Pomaski reference)', () => {
  const ca = 182

  it('matches in-game coaching attribute display', () => {
    expect(staffNpAttrInGame('coachingGks', 1, ca)).toBe(18)
    expect(staffNpAttrInGame('coaching', 7, ca)).toBe(20)
    expect(staffNpAttrInGame('judgement', 7, ca)).toBe(20)
    expect(staffNpAttrInGame('judgingPotential', 7, ca)).toBe(20)
    expect(staffManManagementInGame(ca, 1, 16)).toBe(16)
    expect(
      staffNpAttrInGame('manHandling', 1, ca, { manHandling: 1, resources: 16 }),
    ).toBe(16)
    expect(staffNpAttrInGame('motivating', 7, ca)).toBe(20)
    expect(staffTacticsInGame(ca, 1)).toBe(13)
    expect(staffNpAttrInGame('tactics', 1, ca)).toBe(13)
  })

  it('man management uses scaled manHandling when resources is low', () => {
    expect(staffManManagementInGame(182, 7, 6)).toBe(20)
    expect(staffManManagementInGame(182, 7, 9)).toBe(20)
  })

  it('tactical knowledge uses CA÷25 for higher intrinsics', () => {
    expect(staffTacticsInGame(182, 5)).toBe(17)
  })

  it('leaves already-high style bytes unchanged', () => {
    expect(staffNpAttrInGame('discipline', 20, ca)).toBe(20)
    expect(staffNpAttrInGame('youngsters', 20, ca)).toBe(20)
  })
})
