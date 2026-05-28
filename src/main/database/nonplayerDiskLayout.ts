/** Writable `nonplayer.dat` fields (68-byte `TNonPlayer` row). */
import type { NonPlayerRecord } from './types'
import type { DiskFieldKind } from './playerStaffDiskLayout'

export const NONPLAYER_ROW_BYTES = 68

/** Disk field key → parsed `NonPlayerRecord` property. */
export const NONPLAYER_RECORD_KEY: Record<string, keyof NonPlayerRecord> = {
  current_ability: 'currentAbility',
  potential_ability: 'potentialAbility',
  home_reputation: 'homeReputation',
  current_reputation: 'currentReputation',
  world_reputation: 'worldReputation',
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

export const NONPLAYER_DISK_FIELDS: Record<string, { offset: number; kind: DiskFieldKind }> = {
  current_ability: { offset: 4, kind: 'u16' },
  potential_ability: { offset: 6, kind: 'u16' },
  home_reputation: { offset: 8, kind: 'u16' },
  current_reputation: { offset: 10, kind: 'u16' },
  world_reputation: { offset: 12, kind: 'u16' },
  attacking: { offset: 14, kind: 'i8' },
  business: { offset: 15, kind: 'i8' },
  coaching: { offset: 16, kind: 'i8' },
  coaching_gks: { offset: 17, kind: 'i8' },
  coaching_technique: { offset: 18, kind: 'i8' },
  directness: { offset: 19, kind: 'i8' },
  discipline: { offset: 20, kind: 'i8' },
  free_roles: { offset: 21, kind: 'i8' },
  interference: { offset: 22, kind: 'i8' },
  judgement: { offset: 23, kind: 'i8' },
  judging_potential: { offset: 24, kind: 'i8' },
  man_handling: { offset: 25, kind: 'i8' },
  marking: { offset: 26, kind: 'i8' },
  motivating: { offset: 27, kind: 'i8' },
  offside: { offset: 28, kind: 'i8' },
  patience: { offset: 29, kind: 'i8' },
  physiotherapy: { offset: 30, kind: 'i8' },
  pressing: { offset: 31, kind: 'i8' },
  resources: { offset: 32, kind: 'i8' },
  tactics: { offset: 33, kind: 'i8' },
  youngsters: { offset: 34, kind: 'i8' },
}
