import {
  staffManManagementInGame,
  staffNpAttrDisplay,
  staffNpConvertMode,
} from './cm0102StaffNpAttributeDisplay'
import type { EditorFieldGamePreview } from './editorFieldGamePreview'

/** Disk field key → non-player attribute key for display math. */
const NP_ATTR_KEY: Record<string, string> = {
  attacking: 'attacking',
  business: 'business',
  coaching: 'coaching',
  coaching_gks: 'coachingGks',
  coaching_technique: 'coachingTechnique',
  directness: 'directness',
  discipline: 'discipline',
  free_roles: 'freeRoles',
  interference: 'interference',
  judgement: 'judgement',
  judging_potential: 'judgingPotential',
  man_handling: 'manHandling',
  marking: 'marking',
  motivating: 'motivating',
  offside: 'offside',
  patience: 'patience',
  physiotherapy: 'physiotherapy',
  pressing: 'pressing',
  resources: 'resources',
  tactics: 'tactics',
  youngsters: 'youngsters',
}

const DIRECT_KEYS = new Set([
  'current_ability',
  'potential_ability',
  'home_reputation',
  'current_reputation',
  'world_reputation',
])

function mergedInt(values: Record<string, number>, key: string): number {
  const n = Number(values[key])
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** Same in-game preview math as the staff profile, for editor raw bytes. */
export function getStaffEditorFieldPreview(
  values: Record<string, number>,
  diskKey: string,
): EditorFieldGamePreview | null {
  if (!(diskKey in values)) return null

  if (DIRECT_KEYS.has(diskKey)) {
    const v = mergedInt(values, diskKey)
    return { kind: 'direct', inGame: v, inGameUncapped: v, inMatch: null }
  }

  const npKey = NP_ATTR_KEY[diskKey]
  if (!npKey) return null

  const ca = mergedInt(values, 'current_ability')
  const raw = mergedInt(values, diskKey)
  const extra =
    diskKey === 'man_handling'
      ? { manHandling: raw, resources: mergedInt(values, 'resources') }
      : { manHandling: mergedInt(values, 'man_handling'), resources: mergedInt(values, 'resources') }

  const block = staffNpAttrDisplay(npKey, raw, ca, extra)
  const mode = staffNpConvertMode(npKey)

  if (mode === 'raw') {
    return {
      kind: 'direct',
      inGame: block.inGame,
      inGameUncapped: block.inGameUncapped,
      inMatch: block.inMatch,
    }
  }

  return {
    kind: 'clamped',
    inGame: block.inGame,
    inGameUncapped: block.inGameUncapped,
    inMatch: block.inMatch,
  }
}

/** Man management preview when editing resources (shown on resources field). */
export function getStaffManManagementPreview(values: Record<string, number>): EditorFieldGamePreview {
  const ca = mergedInt(values, 'current_ability')
  const man = mergedInt(values, 'man_handling')
  const res = mergedInt(values, 'resources')
  const inGame = staffManManagementInGame(ca, man, res)
  return { kind: 'clamped', inGame, inGameUncapped: inGame, inMatch: inGame }
}
