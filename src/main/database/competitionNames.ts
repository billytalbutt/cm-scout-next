import type { ClubCompRecord, StaffCompRecord } from './clubComp'

/** Merged `club_comp.dat` + `staff_comp.dat` id → display name (loaded before save parse). */
export type CompetitionNamesById = Map<number, string>

export function buildCompetitionNamesById(
  clubCompsById?: Map<number, ClubCompRecord>,
  staffCompsById?: Map<number, StaffCompRecord>,
): CompetitionNamesById {
  const m: CompetitionNamesById = new Map()
  if (clubCompsById) {
    for (const [id, c] of clubCompsById) {
      const label = (c.name ?? '').trim() || (c.shortName ?? '').trim()
      if (label) m.set(id, label)
    }
  }
  if (staffCompsById) {
    for (const [id, c] of staffCompsById) {
      if (m.has(id)) continue
      const label = (c.name ?? '').trim() || (c.shortName ?? '').trim()
      if (label) m.set(id, label)
    }
  }
  return m
}

export function competitionNameFromMaps(
  competitionId: number | null | undefined,
  competitionNames: CompetitionNamesById,
  playerDatId?: number,
): string {
  if (competitionId == null || competitionId <= 0) return 'Unknown competition'
  if (playerDatId != null && competitionId === playerDatId) return 'Unknown competition (player id)'
  const hit = competitionNames.get(competitionId)
  if (hit) return hit
  return `Competition #${competitionId}`
}

export function isKnownCompetitionId(
  competitionId: number | null | undefined,
  competitionNames: CompetitionNamesById,
  playerDatId?: number,
): boolean {
  if (competitionId == null || competitionId <= 0) return false
  if (playerDatId != null && competitionId === playerDatId) return false
  return competitionNames.has(competitionId)
}
