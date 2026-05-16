import { CM_SCOUT_ATTR_LABELS } from './cmScoutAttrLabels'
import { CM_SCOUT_ROLE_SHORT } from './cmScoutRoles'
import type { GridIncludeFlags } from './gridTypes'

export interface GridColumnCatalogEntry {
  id: string
  label: string
  group: string
  /** When present, turning this column on adds the given payload block(s). */
  requires?: Partial<GridIncludeFlags>
}

const CORE: GridColumnCatalogEntry[] = [
  { id: 'rating', label: 'CM Scout %', group: 'Ratings & summary' },
  { id: 'effRating', label: 'Eff %', group: 'Ratings & summary' },
  { id: 'staffId', label: 'Staff ID', group: 'Identity' },
  { id: 'staffIndex', label: 'Staff index', group: 'Identity' },
  { id: 'name', label: 'Player', group: 'Identity' },
  { id: 'age', label: 'Age', group: 'Identity' },
  { id: 'nation', label: 'Nation', group: 'Identity' },
  { id: 'eu', label: 'EU', group: 'Identity' },
  { id: 'club', label: 'Club', group: 'Identity' },
  { id: 'ca', label: 'CA', group: 'Ability & value' },
  { id: 'pa', label: 'PA', group: 'Ability & value' },
  { id: 'wage', label: 'Wage', group: 'Ability & value' },
  { id: 'value', label: 'Value', group: 'Ability & value' },
  { id: 'shCareerApps', label: 'SH career apps', group: 'staff_history.dat' },
  { id: 'shCareerGoals', label: 'SH career goals', group: 'staff_history.dat' },
  { id: 'shSeasonApps', label: 'SH season apps', group: 'staff_history.dat' },
  { id: 'shSeasonGoals', label: 'SH season goals', group: 'staff_history.dat' },
  { id: 'spfApps', label: 'Save apps', group: 'player stats.dat' },
  { id: 'spfGoals', label: 'Save goals', group: 'player stats.dat' },
  { id: 'spfAst', label: 'Save assists', group: 'player stats.dat' },
  { id: 'isRegen', label: 'Is Regen', group: 'Regen (heuristic)' },
  { id: 'regenOf', label: 'Regen of', group: 'Regen (heuristic)' },
  { id: 'playerId', label: 'Player ID', group: 'Misc', requires: { misc: true } },
  { id: 'squadNumber', label: 'Squad number', group: 'Misc', requires: { misc: true } },
  { id: 'leftFoot', label: 'Left foot', group: 'Misc', requires: { misc: true } },
  { id: 'rightFoot', label: 'Right foot', group: 'Misc', requires: { misc: true } },
  { id: 'morale', label: 'Morale', group: 'Misc', requires: { misc: true } },
  { id: 'staffYob', label: 'Staff year of birth', group: 'Misc', requires: { misc: true } },
  { id: 'repHome', label: 'Home reputation', group: 'Reputation', requires: { reputation: true } },
  { id: 'repCurrent', label: 'Current reputation', group: 'Reputation', requires: { reputation: true } },
  { id: 'repWorld', label: 'World reputation', group: 'Reputation', requires: { reputation: true } },
  { id: 'posGk', label: 'Natural GK', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posSw', label: 'Natural SW', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posD', label: 'Natural D', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posDm', label: 'Natural DM', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posM', label: 'Natural M', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posAm', label: 'Natural AM', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posAtt', label: 'Natural ST / F', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posWb', label: 'Natural WB', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posRight', label: 'Right side', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posLeft', label: 'Left side', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posCentre', label: 'Centre', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'posFreeRole', label: 'Free role', group: 'Positions (suitability)', requires: { positions: true } },
  { id: 'stAdaptability', label: 'Staff adaptability', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stAmbition', label: 'Staff ambition', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stDetermination', label: 'Staff determination', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stLoyalty', label: 'Staff loyalty', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stPressure', label: 'Staff pressure', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stProfessionalism', label: 'Staff professionalism', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stSportsmanship', label: 'Staff sportsmanship', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'stTemperament', label: 'Staff temperament', group: 'Staff (hidden mentals)', requires: { staffCore: true } },
  { id: 'cClubId', label: 'Contract club ID', group: 'Contract', requires: { contract: true } },
  { id: 'cGoalBonus', label: 'Goal bonus', group: 'Contract', requires: { contract: true } },
  { id: 'cAssistBonus', label: 'Assist bonus', group: 'Contract', requires: { contract: true } },
  { id: 'cCleanSheetBonus', label: 'Clean sheet bonus', group: 'Contract', requires: { contract: true } },
  { id: 'cReleaseFee', label: 'Release fee', group: 'Contract', requires: { contract: true } },
  { id: 'cDateStarted', label: 'Contract started', group: 'Contract', requires: { contract: true } },
  { id: 'cDateExpires', label: 'Contract expires', group: 'Contract', requires: { contract: true } },
  { id: 'cType', label: 'Contract type (byte)', group: 'Contract', requires: { contract: true } },
  { id: 'cBosman', label: 'Leaving on Bosman / free', group: 'Contract', requires: { contract: true } },
  { id: 'cMinFeeRc', label: 'Min-fee release clause', group: 'Contract', requires: { contract: true } },
  { id: 'cNonPromoRc', label: 'Non-promotion clause', group: 'Contract', requires: { contract: true } },
  { id: 'cNonPlayingRc', label: 'Non-playing clause', group: 'Contract', requires: { contract: true } },
  { id: 'cRelegationRc', label: 'Relegation clause', group: 'Contract', requires: { contract: true } },
  { id: 'cTransferStatus', label: 'Transfer status (byte)', group: 'Contract', requires: { contract: true } },
  { id: 'cSquadStatus', label: 'Squad status (byte)', group: 'Contract', requires: { contract: true } },
  { id: 'cTransferArranged', label: 'Transfer arranged for (id)', group: 'Contract', requires: { contract: true } },
  { id: 'cTlClub', label: 'Listed by club', group: 'Contract', requires: { contract: true } },
  { id: 'cTlRequest', label: 'Listed by request', group: 'Contract', requires: { contract: true } },
  { id: 'cLoanListed', label: 'Listed for loan', group: 'Contract', requires: { contract: true } },
]

const ATTR_ENTRIES: GridColumnCatalogEntry[] = CM_SCOUT_ATTR_LABELS.map((label, i) => ({
  id: `attr_${i}`,
  label,
  group: 'Attributes (scout order, raw 1–20)',
  requires: { attr48: true },
}))

const ROLE_ENTRIES: GridColumnCatalogEntry[] = CM_SCOUT_ROLE_SHORT.map((lab, i) => ({
  id: `role_${i}`,
  label: `CM % ${lab}`,
  group: 'CM Scout % by role',
  requires: { role7: true },
}))

export const GRID_COLUMN_CATALOG: GridColumnCatalogEntry[] = [...CORE, ...ATTR_ENTRIES, ...ROLE_ENTRIES]

export const GRID_DEFAULT_COLUMN_ORDER: string[] = [
  'rating',
  'effRating',
  'name',
  'age',
  'nation',
  'eu',
  'club',
  'ca',
  'pa',
  'wage',
  'value',
  'isRegen',
  'regenOf',
]

const CATALOG_BY_ID = new Map(GRID_COLUMN_CATALOG.map((e) => [e.id, e]))

export function gridFlagsForVisibleColumnIds(visibleIds: readonly string[]): GridIncludeFlags {
  const f: GridIncludeFlags = {}
  for (const id of visibleIds) {
    const e = CATALOG_BY_ID.get(id)
    if (e?.requires) Object.assign(f, e.requires)
  }
  return f
}

export function isKnownGridColumnId(id: string): boolean {
  return CATALOG_BY_ID.has(id)
}

export function sanitizeGridColumnOrder(order: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (!CATALOG_BY_ID.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
