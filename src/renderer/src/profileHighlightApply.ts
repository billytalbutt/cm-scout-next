import {
  defaultArchetypeFromCmScoutIndex,
  footMoraleHighlightTier,
  roleFromEffectivenessArchetypeId,
} from '../../main/positionHighlights'
import type { ProfileAttrCell, ProfilePayload } from './vite-env.d'

export type ProfileHighlightPack = {
  archetypeId: string
  roleCmScoutIndex: number
  roleLabel: string
  playerPrimary: string[]
  playerSecondary: string[]
  playerEngineBreaker: string[]
  playerRecipeAccent: string[]
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
    highlightRecipeAccent: pack.playerRecipeAccent.includes(c.key),
  }
}

function footTier(archetypeId: string, key: 'left_foot' | 'right_foot' | 'morale'): 'primary' | 'secondary' | undefined {
  return footMoraleHighlightTier(key, [roleFromEffectivenessArchetypeId(archetypeId)])
}

export function highlightPackForArchetype(
  profile: ProfilePayload,
  archetypeId: string,
): ProfileHighlightPack | undefined {
  return profile.highlightPacksByArchetypeId?.[archetypeId]
}

export function highlightPackForRole(
  profile: ProfilePayload,
  roleCmScoutIndex: number,
): ProfileHighlightPack | undefined {
  const archetypeId = defaultArchetypeFromCmScoutIndex(roleCmScoutIndex)
  return highlightPackForArchetype(profile, archetypeId) ?? profile.highlightPacksByCmScoutIndex?.[roleCmScoutIndex]
}

/** Clone profile with attribute/hidden highlights for one Eff archetype (or CM Scout role fallback). */
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
    left: { ...profile.feetMorale.left, highlightTier: footTier(pack.archetypeId, 'left_foot') },
    right: { ...profile.feetMorale.right, highlightTier: footTier(pack.archetypeId, 'right_foot') },
    morale: { ...profile.feetMorale.morale, highlightTier: footTier(pack.archetypeId, 'morale') },
  }

  return {
    ...profile,
    highlightRolesLabel: pack.roleLabel,
    defaultHighlightRoleCmScoutIndex: pack.roleCmScoutIndex,
    defaultHighlightArchetypeId: pack.archetypeId,
    attrColumns,
    hiddenColumns,
    feetMorale,
  }
}
