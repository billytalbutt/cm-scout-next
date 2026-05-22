/**
 * In-game descriptive strings for manager/coach `nonplayer.dat` preference bytes.
 * String tables extracted from CM0102.exe (profile UI copy).
 */

/**
 * Training emphasis (`coachingTechnique` byte). CM0102.exe string table order differs from the
 * profile enum: unset/General = -1 (or 0), 1 = Fitness-based, 2 = Technique-based.
 */
const COACHING_STYLE: readonly string[] = [
  'General',
  'Fitness-based',
  'Technique-based',
]

/** Default profile line when `coachingTechnique` is unset (-1) in `nonplayer.dat`. */
export const COACHING_TECHNIQUE_GENERAL = -1

/**
 * Preferred passing/style of play (`directness` byte indexes this table in the profile UI).
 * Order matches the “Preferred Style” block in CM0102.exe.
 */
const PREFERRED_PLAYING_STYLE: readonly string[] = [
  'Prefers a patient style of play',
  'Prefers a direct style of play',
  'Prefers a defensive style of play',
  'Prefers an attacking style of play',
  'Prefers a patient and defensive style of play',
  'Prefers a cautious but direct style of play',
  'Prefers an attractive attacking style of play',
  'Prefers a direct attacking style of play',
]

/** Preferred formation (`formation` byte) — index 3 is 4-4-2 on standard 3.9.68 data. */
const PREFERRED_FORMATION: readonly string[] = [
  'None',
  '5-3-2 Sweeper',
  '5-3-2',
  '4-4-2',
  '4-3-3',
  '3-5-2',
  '4-5-1',
  '4-2-4',
  '4-1-2-1-2',
  '3-4-3',
  '4-2-3-1',
  '4-3-1-2',
  '4-4-1-1',
  '3-6-1',
  '5-4-1',
  '3-3-3-1',
  '4-2-2-2',
]

function tableLabel(table: readonly string[], index: number): string | null {
  if (!Number.isFinite(index) || index < 0 || index >= table.length) return null
  const label = table[index]
  return label ?? null
}

export function coachingStyleLabel(coachingTechnique: number): string | null {
  if (!Number.isFinite(coachingTechnique)) return 'General'
  if (coachingTechnique === 1) return 'Fitness-based'
  if (coachingTechnique === 2) return 'Technique-based'
  // CM stores unset/General as -1, 0, or other non-special values on many DB rows.
  return 'General'
}

export function preferredPlayingStyleLabel(directness: number): string | null {
  return tableLabel(PREFERRED_PLAYING_STYLE, directness)
}

export function preferredFormationLabel(formation: number): string | null {
  return tableLabel(PREFERRED_FORMATION, formation)
}

/** High `pressing` / `marking` / `offside` bytes trigger these profile lines (CM profile ~15+). */
export const PREFERENCE_THRESHOLD = 14

export type StaffCoachPreferenceLines = {
  coachingStyle: string | null
  preferredFormation: string | null
  preferredStyle: string | null
  closesDownOpposition: boolean
  playsOffsideTrap: boolean
  usesManMarking: boolean
}

export function buildStaffCoachPreferenceLines(np: {
  coachingTechnique: number
  formation: number
  directness: number
  pressing: number
  offside: number
  marking: number
}): StaffCoachPreferenceLines {
  return {
    coachingStyle: coachingStyleLabel(np.coachingTechnique),
    preferredFormation: preferredFormationLabel(np.formation),
    preferredStyle: preferredPlayingStyleLabel(np.directness),
    closesDownOpposition: np.pressing >= PREFERENCE_THRESHOLD,
    playsOffsideTrap: np.offside >= PREFERENCE_THRESHOLD,
    usesManMarking: np.marking >= PREFERENCE_THRESHOLD,
  }
}
