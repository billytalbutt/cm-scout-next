import { describe, expect, it } from 'vitest'
import { getStaffEditorFieldPreview, getStaffManManagementPreview } from './staffEditorFieldPreview'

describe('staffEditorFieldPreview', () => {
  it('shows in-game motivating from raw byte + CA', () => {
    const values = { current_ability: 180, motivating: -13 }
    const p = getStaffEditorFieldPreview(values, 'motivating')
    expect(p).not.toBeNull()
    expect(p!.inGame).toBeGreaterThanOrEqual(1)
    expect(p!.inGame).toBeLessThanOrEqual(20)
  })

  it('shows direct CA/PA', () => {
    const p = getStaffEditorFieldPreview({ current_ability: 182, potential_ability: 200 }, 'current_ability')
    expect(p?.kind).toBe('direct')
    expect(p?.inGame).toBe(182)
  })

  it('man management preview uses resources threshold', () => {
    const high = getStaffManManagementPreview({
      current_ability: 160,
      man_handling: 5,
      resources: 16,
    })
    expect(high.inGame).toBe(16)
  })
})
