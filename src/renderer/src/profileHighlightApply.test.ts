import { describe, expect, it } from 'vitest'
import { applyProfileHighlightPack, highlightPackForRole } from './profileHighlightApply'
import type { ProfileHighlightPack, ProfilePayload } from './vite-env.d'

function minimalProfile(): ProfilePayload {
  return {
    name: 'Test',
    nation: 'England',
    secondNation: '',
    nationDisplay: 'England',
    club: 'Liverpool',
    age: 25,
    dobIso: null,
    euPassport: false,
    positionLabel: 'DM, WB',
    reputation: { home: 9000, current: 9000, world: 9000 },
    ca: 180,
    pa: 190,
    transfer: {
      value: 0,
      listedByClub: false,
      listedByRequest: false,
      listedForLoan: false,
      futureTransferToClubId: null,
      futureTransferToClubName: null,
    },
    attrColumns: [
      [
        {
          key: 'tackling',
          label: 'Tackling',
          inGame: 18,
          inGameUncapped: 18,
          raw: 18,
          inMatch: 18,
          invert: false,
        },
        {
          key: 'crossing',
          label: 'Crossing',
          inGame: 16,
          inGameUncapped: 16,
          raw: 16,
          inMatch: 16,
          invert: false,
        },
      ],
      [],
      [],
    ],
    feetMorale: {
      left: { label: 'Left', inGame: 15, inGameUncapped: 15, raw: 15, inMatch: 15 },
      right: { label: 'Right', inGame: 15, inGameUncapped: 15, raw: 15, inMatch: 15 },
      morale: { label: 'Morale', inGame: 15, inGameUncapped: 15, raw: 15, inMatch: 15 },
    },
    hiddenColumns: [[], [], []],
    highlightRolesLabel: 'DM',
    defaultHighlightRoleCmScoutIndex: 2,
    highlightPacksByCmScoutIndex: [dmPack, wbPack],
    seasonStats: {
      internationalCaps: { apps: 0, goals: 0 },
      cmHistorySeasonLabel: null,
      currentSeasonPerformance: null,
    },
    engineMetaProfiles: [],
    freeRoleHint: { recommend: false, headline: '', detail: '' },
    tacticalInstructionHints: [],
    contract: null,
  }
}

const dmPack: ProfileHighlightPack = {
  roleCmScoutIndex: 2,
  roleLabel: 'DM',
  playerPrimary: ['tackling', 'positioning', 'marking'],
  playerSecondary: ['passing'],
  playerEngineBreaker: ['tackling', 'positioning', 'marking'],
  staffPrimary: [],
  staffSecondary: [],
}

const wbPack: ProfileHighlightPack = {
  roleCmScoutIndex: 6,
  roleLabel: 'WB',
  playerPrimary: ['crossing', 'pace', 'stamina'],
  playerSecondary: ['tackling'],
  playerEngineBreaker: ['pace', 'acceleration', 'crossing'],
  staffPrimary: [],
  staffSecondary: [],
}

describe('highlightPackForRole', () => {
  it('finds pack by roleCmScoutIndex not array position', () => {
    const base = minimalProfile()
    expect(highlightPackForRole(base, 6)?.roleLabel).toBe('WB')
    expect(highlightPackForRole(base, 2)?.roleLabel).toBe('DM')
  })
})

describe('applyProfileHighlightPack', () => {
  it('switches primary highlights between DM and WB packs', () => {
    const base = minimalProfile()
    const dm = applyProfileHighlightPack(base, dmPack)
    const wb = applyProfileHighlightPack(base, wbPack)

    expect(dm.attrColumns[0].find((c) => c.key === 'tackling')?.highlightTier).toBe('primary')
    expect(dm.attrColumns[0].find((c) => c.key === 'crossing')?.highlightTier).toBeUndefined()

    expect(wb.attrColumns[0].find((c) => c.key === 'crossing')?.highlightTier).toBe('primary')
    expect(wb.attrColumns[0].find((c) => c.key === 'crossing')?.highlightEngine).toBe(true)
    expect(wb.attrColumns[0].find((c) => c.key === 'tackling')?.highlightTier).toBe('secondary')
    expect(wb.highlightRolesLabel).toBe('WB')
  })
})
