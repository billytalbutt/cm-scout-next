import type { GridPlayerRow } from './gridTypes'
import { filterSquadRowsForPitchSlot } from './tacticsSquadFilter'
import {
  assignmentFromSquadRow,
  comparePlayersForSlot,
} from './tacticsLineupRating'
import {
  LINEUP_GROUPS,
  slotsInLineupGroup,
  type PitchSlot,
  type TacticsPlayerAssignment,
} from './tacticsPitchSnap'

/** Pitch slots in FM-style order: GK → defence (L→R) → midfield → attack. */
export function orderedPitchSlotsForAutoPick(pitchSlots: PitchSlot[]): PitchSlot[] {
  const out: PitchSlot[] = []
  for (const g of LINEUP_GROUPS) {
    out.push(...slotsInLineupGroup(pitchSlots, g.id))
  }
  const seen = new Set(out.map((s) => s.id))
  for (const s of pitchSlots) {
    if (!seen.has(s.id)) out.push(s)
  }
  return out
}

/**
 * Greedy best-XI from a club squad: each slot gets the highest role-rated available
 * player eligible for that line (GK / defence / midfield / attack), without reusing anyone.
 */
export function autoPickClubSquadLineup(
  pitchSlots: PitchSlot[],
  squadRows: GridPlayerRow[],
): Partial<Record<string, TacticsPlayerAssignment>> {
  const used = new Set<number>()
  const out: Partial<Record<string, TacticsPlayerAssignment>> = {}

  for (const slot of orderedPitchSlotsForAutoPick(pitchSlots)) {
    const candidates = filterSquadRowsForPitchSlot(squadRows, slot)
      .filter((p) => !used.has(p.staffIndex))
      .sort((a, b) => comparePlayersForSlot(a, b, slot.role))
    const pick = candidates[0]
    if (!pick) continue
    used.add(pick.staffIndex)
    out[slot.id] = assignmentFromSquadRow(pick, slot.role)
  }

  return out
}
