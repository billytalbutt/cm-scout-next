import type { ProfileAttrCell, ProfilePayload } from './vite-env.d'

export type ProfileHighlightPack = {
  roleCmScoutIndex: number
  roleLabel: string
  playerPrimary: string[]
  playerSecondary: string[]
  playerEngineBreaker: string[]
  staffPrimary: string[]
  staffSecondary: string[]
}

const STAFF_ATTR_KEYS = new Set([
  'adaptability',
  'ambition',
  'loyalty',
  'pressure',
  'professionalism',
  'sportsmanship',
  'temperament',
  'determination',
])

function tierForKey(
  key: string,
  pack: ProfileHighlightPack,
): 'primary' | 'secondary' | undefined {
  if (key === 'injury_proneness' || key === 'dirtiness') return undefined
  if (pack.playerPrimary.includes(key)) return 'primary'
  if (pack.playerSecondary.includes(key)) return 'secondary'
  if (STAFF_ATTR_KEYS.has(key)) {
    if (pack.staffPrimary.includes(key)) return 'primary'
    if (pack.staffSecondary.includes(key)) return 'secondary'
  }
  return undefined
}

function mapCell(c: ProfileAttrCell, pack: ProfileHighlightPack): ProfileAttrCell {
  return {
    ...c,
    highlightTier: tierForKey(c.key, pack),
    highlightEngine: pack.playerEngineBreaker.includes(c.key),
  }
}

function footTier(
  key: 'left_foot' | 'right_foot' | 'morale',
  pack: ProfileHighlightPack,
): 'primary' | 'secondary' | undefined {
  if (key === 'morale') return 'secondary'
  if (pack.roleLabel === 'GK') return undefined
  return 'secondary'
}

/** Clone profile with attribute/hidden highlights for one CM Scout role column. */
export function applyProfileHighlightPack(
  profile: ProfilePayload,
  pack: ProfileHighlightPack | undefined,
): ProfilePayload {
  if (!pack) return profile

  const attrColumns: ProfilePayload['attrColumns'] = [
    profile.attrColumns[0].map((c) => mapCell(c, pack)),
    profile.attrColumns[1].map((c) => mapCell(c, pack)),
    profile.attrColumns[2].map((c) => mapCell(c, pack)),
  ]

  const hiddenColumns: ProfilePayload['hiddenColumns'] = [
    profile.hiddenColumns[0].map((c) => mapCell(c, pack)),
    profile.hiddenColumns[1].map((c) => mapCell(c, pack)),
    profile.hiddenColumns[2].map((c) => mapCell(c, pack)),
  ]

  const feetMorale = {
    left: { ...profile.feetMorale.left, highlightTier: footTier('left_foot', pack) },
    right: { ...profile.feetMorale.right, highlightTier: footTier('right_foot', pack) },
    morale: { ...profile.feetMorale.morale, highlightTier: footTier('morale', pack) },
  }

  return {
    ...profile,
    highlightRolesLabel: pack.roleLabel,
    defaultHighlightRoleCmScoutIndex: pack.roleCmScoutIndex,
    attrColumns,
    hiddenColumns,
    feetMorale,
  }
}
