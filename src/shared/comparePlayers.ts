export type CompareAttrCell = {
  key: string
  label: string
  inGame: number
  inGameUncapped?: number
  invert?: boolean
}

export type CompareWinner = 'left' | 'right' | 'tie'

export type AttrCategoryId =
  | 'attacking'
  | 'defending'
  | 'physical'
  | 'mental'
  | 'technical'
  | 'hidden'
  | 'other'

const CATEGORY_BY_KEY: Record<string, AttrCategoryId> = {
  finishing: 'attacking',
  off_the_ball: 'attacking',
  dribbling: 'attacking',
  crossing: 'attacking',
  long_shots: 'attacking',
  creativity: 'attacking',
  flair: 'attacking',
  penalties: 'attacking',
  free_kicks: 'attacking',
  corners: 'attacking',
  tackling: 'defending',
  marking: 'defending',
  positioning: 'defending',
  heading: 'defending',
  pace: 'physical',
  acceleration: 'physical',
  stamina: 'physical',
  strength: 'physical',
  jumping: 'physical',
  agility: 'physical',
  balance: 'physical',
  decisions: 'mental',
  anticipation: 'mental',
  teamwork: 'mental',
  work_rate: 'mental',
  bravery: 'mental',
  influence: 'mental',
  determination: 'mental',
  adaptability: 'mental',
  ambition: 'mental',
  loyalty: 'mental',
  pressure: 'mental',
  professionalism: 'mental',
  sportsmanship: 'mental',
  temperament: 'mental',
  passing: 'technical',
  technique: 'technical',
  first_touch: 'technical',
  consistency: 'hidden',
  important_matches: 'hidden',
  injury_proneness: 'hidden',
  natural_fitness: 'hidden',
  dirtiness: 'hidden',
  versatility: 'hidden',
  throw_ins: 'hidden',
}

export function attrCategoryForKey(key: string): AttrCategoryId {
  return CATEGORY_BY_KEY[key] ?? 'other'
}

function displayValue(cell: CompareAttrCell, useUncapped: boolean): number {
  const v = useUncapped && cell.inGameUncapped != null ? cell.inGameUncapped : cell.inGame
  return Number.isFinite(v) ? v : 0
}

export function compareAttrCells(
  left: CompareAttrCell,
  right: CompareAttrCell,
  useUncapped: boolean,
): CompareWinner {
  const lv = displayValue(left, useUncapped)
  const rv = displayValue(right, useUncapped)
  const invert = left.invert || right.invert
  const better = (a: number, b: number) => (invert ? a < b : a > b)
  if (lv === rv) return 'tie'
  if (better(lv, rv)) return 'left'
  if (better(rv, lv)) return 'right'
  return 'tie'
}

export type CategoryWinCounts = Record<AttrCategoryId, { left: number; right: number; tie: number }>

export function emptyCategoryCounts(): CategoryWinCounts {
  return {
    attacking: { left: 0, right: 0, tie: 0 },
    defending: { left: 0, right: 0, tie: 0 },
    physical: { left: 0, right: 0, tie: 0 },
    mental: { left: 0, right: 0, tie: 0 },
    technical: { left: 0, right: 0, tie: 0 },
    hidden: { left: 0, right: 0, tie: 0 },
    other: { left: 0, right: 0, tie: 0 },
  }
}

export function aggregateCategoryWins(
  rows: { left: CompareAttrCell; right: CompareAttrCell }[],
  useUncapped: boolean,
): CategoryWinCounts {
  const counts = emptyCategoryCounts()
  for (const { left, right } of rows) {
    const cat = attrCategoryForKey(left.key)
    const w = compareAttrCells(left, right, useUncapped)
    counts[cat][w]++
  }
  return counts
}

export function flattenProfileAttrs(
  attrColumns: [CompareAttrCell[], CompareAttrCell[], CompareAttrCell[]],
  hiddenColumns: [CompareAttrCell[], CompareAttrCell[], CompareAttrCell[]],
): CompareAttrCell[] {
  return [
    ...attrColumns[0],
    ...attrColumns[1],
    ...attrColumns[2],
    ...hiddenColumns[0],
    ...hiddenColumns[1],
    ...hiddenColumns[2],
  ]
}

export function mergeCompareRows(
  leftAttrs: CompareAttrCell[],
  rightAttrs: CompareAttrCell[],
): { key: string; label: string; left: CompareAttrCell; right: CompareAttrCell }[] {
  const rightByKey = new Map(rightAttrs.map((c) => [c.key, c]))
  const out: { key: string; label: string; left: CompareAttrCell; right: CompareAttrCell }[] = []
  for (const l of leftAttrs) {
    const r = rightByKey.get(l.key)
    if (r) out.push({ key: l.key, label: l.label, left: l, right: r })
  }
  return out
}
