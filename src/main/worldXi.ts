import type { GridPlayerRow } from '../shared/gridTypes'
import { autoPickBestLineup } from '../shared/tacticsAutoPick'
import type { PitchSlot, TacticsPlayerAssignment } from '../shared/tacticsPitchSnap'
import type { UiPlayerRow } from './database/types'
import { mapUiRowToGridPayload } from './gridRowPayload'

/** Every playable player in the loaded save, with role7 + natural positions for tactics. */
export function buildWorldSquadGridRows(rows: UiPlayerRow[]): GridPlayerRow[] {
  return rows.map((r) => mapUiRowToGridPayload(r, { role7: true, positions: true }))
}

/** Best XI in the world for the current pitch slots (ignores club selection). */
export function pickWorldXiLineup(
  pitchSlots: PitchSlot[],
  allPlayers: UiPlayerRow[],
): Partial<Record<string, TacticsPlayerAssignment>> {
  const pool = buildWorldSquadGridRows(allPlayers)
  return autoPickBestLineup(pitchSlots, pool)
}
