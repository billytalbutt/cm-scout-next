/**
 * Byte offsets within one `player.dat` row (70 bytes) and `staff.dat` row (110 bytes),
 * derived from `parsePlayer` / `parseStaff` in `parser.ts`. Keep in sync when those parsers change.
 */

import type { BlockInfo } from './types'

export const PLAYER_ROW_BYTES = 70
export const STAFF_ROW_BYTES = 110

export type DiskFieldKind = 'i8' | 'u8' | 'i16' | 'u16'

/** Writable `player.dat` fields (excludes `id` at 0–3). */
export const PLAYER_DISK_FIELDS: Record<string, { offset: number; kind: DiskFieldKind }> = {
  squad_number: { offset: 4, kind: 'u8' },
  current_ability: { offset: 5, kind: 'i16' },
  potential_ability: { offset: 7, kind: 'i16' },
  home_reputation: { offset: 9, kind: 'u16' },
  current_reputation: { offset: 11, kind: 'u16' },
  world_reputation: { offset: 13, kind: 'u16' },
  goalkeeper: { offset: 15, kind: 'i8' },
  sweeper: { offset: 16, kind: 'i8' },
  defender: { offset: 17, kind: 'i8' },
  defensive_midfielder: { offset: 18, kind: 'i8' },
  midfielder: { offset: 19, kind: 'i8' },
  attacking_midfielder: { offset: 20, kind: 'i8' },
  attacker: { offset: 21, kind: 'i8' },
  wing_back: { offset: 22, kind: 'i8' },
  right_side: { offset: 23, kind: 'i8' },
  left_side: { offset: 24, kind: 'i8' },
  centre_side: { offset: 25, kind: 'i8' },
  free_role: { offset: 26, kind: 'i8' },
  acceleration: { offset: 27, kind: 'i8' },
  aggression: { offset: 28, kind: 'i8' },
  agility: { offset: 29, kind: 'i8' },
  anticipation: { offset: 30, kind: 'i8' },
  balance: { offset: 31, kind: 'i8' },
  bravery: { offset: 32, kind: 'i8' },
  consistency: { offset: 33, kind: 'i8' },
  corners: { offset: 34, kind: 'i8' },
  crossing: { offset: 35, kind: 'i8' },
  decisions: { offset: 36, kind: 'i8' },
  dirtiness: { offset: 37, kind: 'i8' },
  dribbling: { offset: 38, kind: 'i8' },
  finishing: { offset: 39, kind: 'i8' },
  flair: { offset: 40, kind: 'i8' },
  free_kicks: { offset: 41, kind: 'i8' },
  handling: { offset: 42, kind: 'i8' },
  heading: { offset: 43, kind: 'i8' },
  important_matches: { offset: 44, kind: 'i8' },
  injury_proneness: { offset: 45, kind: 'i8' },
  jumping: { offset: 46, kind: 'i8' },
  influence: { offset: 47, kind: 'i8' },
  left_foot: { offset: 48, kind: 'i8' },
  long_shots: { offset: 49, kind: 'i8' },
  marking: { offset: 50, kind: 'i8' },
  off_the_ball: { offset: 51, kind: 'i8' },
  natural_fitness: { offset: 52, kind: 'i8' },
  one_on_ones: { offset: 53, kind: 'i8' },
  pace: { offset: 54, kind: 'i8' },
  passing: { offset: 55, kind: 'i8' },
  penalties: { offset: 56, kind: 'i8' },
  positioning: { offset: 57, kind: 'i8' },
  reflexes: { offset: 58, kind: 'i8' },
  right_foot: { offset: 59, kind: 'i8' },
  stamina: { offset: 60, kind: 'i8' },
  strength: { offset: 61, kind: 'i8' },
  tackling: { offset: 62, kind: 'i8' },
  teamwork: { offset: 63, kind: 'i8' },
  technique: { offset: 64, kind: 'i8' },
  throw_ins: { offset: 65, kind: 'i8' },
  versatility: { offset: 66, kind: 'i8' },
  creativity: { offset: 67, kind: 'i8' },
  work_rate: { offset: 68, kind: 'i8' },
  morale: { offset: 69, kind: 'i8' },
}

/** Writable staff mentals (same bytes as profile “hidden” staff slice + determination). */
export const STAFF_MENTAL_DISK_OFFSETS: Record<string, number> = {
  adaptability: 86,
  ambition: 87,
  determination: 88,
  loyalty: 89,
  pressure: 90,
  professionalism: 91,
  sportsmanship: 92,
  temperament: 93,
}

export const STAFF_EDITOR_KEYS = new Set(Object.keys(STAFF_MENTAL_DISK_OFFSETS))

export function findBlock(blocks: BlockInfo[], canonicalLower: string): BlockInfo | undefined {
  return blocks.find((b) =>
    b.name
      .replace(/\0+$/g, '')
      .trim()
      .toLowerCase() === canonicalLower,
  )
}

function clampInt(n: number, lo: number, hi: number): number {
  let x = Math.trunc(n)
  if (x < lo) x = lo
  if (x > hi) x = hi
  return x
}

export function writeScalarAt(buf: Buffer, absOffset: number, kind: DiskFieldKind, value: number): void {
  let v = value
  switch (kind) {
    case 'i8':
      buf.writeInt8(clampInt(v, -128, 127), absOffset)
      break
    case 'u8':
      buf.writeUInt8(clampInt(v, 0, 255), absOffset)
      break
    case 'i16':
      buf.writeInt16LE(clampInt(v, -32768, 32767), absOffset)
      break
    case 'u16':
      buf.writeUInt16LE(clampInt(v, 0, 65535), absOffset)
      break
    default:
      break
  }
}
