/** CM `Preferences.dat` row slots (GK editor: favourite / disliked clubs & staff). */
export type PreferencesEditorValues = {
  favouriteClubs: [number, number, number]
  dislikedClubs: [number, number, number]
  favouriteStaff: [number, number, number]
  dislikedStaff: [number, number, number]
}

/** Empty slot in CM (-1 = none). */
export const PREFERENCES_SLOT_NONE = -1

export function emptyPreferencesValues(): PreferencesEditorValues {
  const none = PREFERENCES_SLOT_NONE
  return {
    favouriteClubs: [none, none, none],
    dislikedClubs: [none, none, none],
    favouriteStaff: [none, none, none],
    dislikedStaff: [none, none, none],
  }
}

export function normalizePreferenceSlotId(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return PREFERENCES_SLOT_NONE
  return Math.trunc(raw)
}

export function preferencesValuesEqual(a: PreferencesEditorValues, b: PreferencesEditorValues): boolean {
  const eq3 = (x: [number, number, number], y: [number, number, number]) =>
    x[0] === y[0] && x[1] === y[1] && x[2] === y[2]
  return (
    eq3(a.favouriteClubs, b.favouriteClubs) &&
    eq3(a.dislikedClubs, b.dislikedClubs) &&
    eq3(a.favouriteStaff, b.favouriteStaff) &&
    eq3(a.dislikedStaff, b.dislikedStaff)
  )
}
