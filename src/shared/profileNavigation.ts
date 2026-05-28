/** Ordered staff indices for pop-out profile Next/Previous navigation. */
export type ProfileNavigationSource = 'grid' | 'shortlist' | 'club_squad' | 'development'

export type ProfileNavigationContext = {
  orderedStaffIndices: number[]
  source: ProfileNavigationSource
}

export function profileNavIndex(
  ordered: readonly number[],
  staffIndex: number,
): number {
  return ordered.indexOf(staffIndex)
}

export function profileNavStep(
  ordered: readonly number[],
  currentStaffIndex: number,
  direction: 'next' | 'prev',
): number | null {
  if (ordered.length === 0) return null
  const idx = profileNavIndex(ordered, currentStaffIndex)
  const base = idx >= 0 ? idx : 0
  const nextIdx =
    direction === 'next'
      ? (base + 1) % ordered.length
      : (base - 1 + ordered.length) % ordered.length
  if (idx < 0 && direction === 'prev') return ordered[ordered.length - 1] ?? null
  return ordered[nextIdx] ?? null
}
