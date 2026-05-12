import { buildCa18Display, CA18_KEYS, otherAttrDisplay } from './database/attributes'
import type { UiPlayerRow } from './database/types'
import { formatNaturalPositions, humanizeAttrKey, splitIntoThreeColumns } from './profileLayout'
import { computeHighlightSets, footMoraleHighlightTier, formatHighlightRoles } from './positionHighlights'

const OTHER_KEYS = [
  'acceleration',
  'agility',
  'balance',
  'corners',
  'flair',
  'injury_proneness',
  'dirtiness',
  'jumping',
  'natural_fitness',
  'pace',
  'free_kicks',
  'stamina',
  'strength',
  'technique',
  'work_rate',
  'aggression',
  'important_matches',
  'consistency',
  'influence',
  'teamwork',
  'versatility',
  'morale',
] as const

export type ProfileAttrCell = {
  key: string
  label: string
  inGame: number
  raw: number
  inMatch: number
  invert: boolean
  /** FM-style row tint: key attributes for natural position(s) */
  highlightTier?: 'primary' | 'secondary'
}

export type ProfileFeetMorale = {
  left: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
  right: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
  morale: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
}

export function buildProfilePayload(row: UiPlayerRow) {
  const p = row.player
  const s = row.staff
  const ca18 = buildCa18Display(p)

  const other: Record<string, { raw: number; inGame: number; inMatch: number }> = {}
  for (const k of OTHER_KEYS) {
    if (k === 'morale') continue
    other[k] = otherAttrDisplay(p[k as keyof typeof p] as number)
  }

  const mentalStaff: Record<string, { raw: number; inGame: number; inMatch: number }> = {
    adaptability: otherAttrDisplay(s.adaptability),
    ambition: otherAttrDisplay(s.ambition),
    determination: otherAttrDisplay(s.determination),
    loyalty: otherAttrDisplay(s.loyalty),
    pressure: otherAttrDisplay(s.pressure),
    professionalism: otherAttrDisplay(s.professionalism),
    sportsmanship: otherAttrDisplay(s.sportsmanship),
    temperament: otherAttrDisplay(s.temperament),
  }

  const hl = computeHighlightSets(p)
  const rolesUsed = hl.rolesUsed

  const tierForPlayerAttr = (key: string): 'primary' | 'secondary' | undefined => {
    if (key === 'injury_proneness' || key === 'dirtiness') return undefined
    if (hl.playerPrimary.has(key)) return 'primary'
    if (hl.playerSecondary.has(key)) return 'secondary'
    return undefined
  }

  const tierForStaffAttr = (key: string): 'primary' | 'secondary' | undefined => {
    if (hl.staffPrimary.has(key)) return 'primary'
    if (hl.staffSecondary.has(key)) return 'secondary'
    return undefined
  }

  const gridKeys = [...CA18_KEYS, ...OTHER_KEYS.filter((k) => k !== 'morale')].sort((a, b) =>
    humanizeAttrKey(a).localeCompare(humanizeAttrKey(b)),
  )

  const toCell = (key: string): ProfileAttrCell => {
    const label = humanizeAttrKey(key)
    if ((CA18_KEYS as readonly string[]).includes(key)) {
      const x = ca18[key as (typeof CA18_KEYS)[number]]
      return {
        key,
        label,
        inGame: x.inGame,
        raw: x.raw,
        inMatch: x.inMatch,
        invert: false,
        highlightTier: tierForPlayerAttr(key),
      }
    }
    const x = other[key]!
    const inv = key === 'injury_proneness' || key === 'dirtiness'
    return {
      key,
      label,
      inGame: x.inGame,
      raw: x.raw,
      inMatch: x.inMatch,
      invert: inv,
      highlightTier: tierForPlayerAttr(key),
    }
  }

  const [k0, k1, k2] = splitIntoThreeColumns(gridKeys)
  const attrColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]] = [
    k0.map(toCell),
    k1.map(toCell),
    k2.map(toCell),
  ]

  const feetMorale: ProfileFeetMorale = {
    left: {
      label: 'Left foot',
      ...otherAttrDisplay(p.left_foot),
      highlightTier: footMoraleHighlightTier('left_foot', rolesUsed),
    },
    right: {
      label: 'Right foot',
      ...otherAttrDisplay(p.right_foot),
      highlightTier: footMoraleHighlightTier('right_foot', rolesUsed),
    },
    morale: {
      label: 'Morale',
      ...otherAttrDisplay(p.morale),
      highlightTier: footMoraleHighlightTier('morale', rolesUsed),
    },
  }

  const hiddenSorted: ProfileAttrCell[] = Object.entries(mentalStaff)
    .map(([key, v]) => ({
      key,
      label: humanizeAttrKey(key),
      inGame: v.inGame,
      raw: v.raw,
      inMatch: v.inMatch,
      invert: false,
      highlightTier: tierForStaffAttr(key),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const hiddenColumns = splitIntoThreeColumns(hiddenSorted)

  const contract = row.contract
    ? {
        wage: row.contract.wage,
        clubId: row.contract.club_id,
        goalBonus: row.contract.goal_bonus,
        assistBonus: row.contract.assist_bonus,
        releaseFee: row.contract.release_fee,
        type: row.contract.contract_type,
        dateStarted: row.contract.date_started_iso,
        contractExpires: row.contract.contract_expires_iso,
        leavingOnBosman: row.contract.leaving_on_bosman > 0,
        minimumReleaseClause: row.contract.minimum_fee_rc > 0,
        nonPromotionClause: row.contract.non_promotion_rc > 0,
        nonPlayingClause: row.contract.non_playing_rc > 0,
        relegationClause: row.contract.relegation_rc > 0,
      }
    : null

  const nationDisplay =
    row.secondNation && row.secondNation.trim()
      ? `${row.nation} / ${row.secondNation}`
      : row.nation

  return {
    name: row.name,
    nation: row.nation,
    secondNation: row.secondNation ?? '',
    nationDisplay,
    club: row.club,
    dobIso: s.dob_iso,
    euPassport: row.euPassport,
    positionLabel: formatNaturalPositions(p),
    highlightRolesLabel: formatHighlightRoles(rolesUsed),
    ca: p.current_ability,
    pa: p.potential_ability,
    attrColumns,
    feetMorale,
    hiddenColumns,
    contract,
  }
}
