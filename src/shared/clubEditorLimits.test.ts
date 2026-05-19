import { describe, expect, it } from 'vitest'
import { clampClubEditorValue } from './clubEditorLimits'

describe('clubEditorLimits', () => {
  it('caps bank balance at £2bn', () => {
    expect(clampClubEditorValue('cash', 5_000_000_000)).toBe(2_000_000_000)
    expect(clampClubEditorValue('cash', -1)).toBe(0)
  })

  it('caps training at 1–20', () => {
    expect(clampClubEditorValue('training', 99)).toBe(20)
    expect(clampClubEditorValue('training', 0)).toBe(1)
  })
})
