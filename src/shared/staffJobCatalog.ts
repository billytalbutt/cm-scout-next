/**
 * `TStaff.JobForClub` (`StaffJob` enum, CM0102Patcher SaveChanger/Structures.cs).
 * Values are the raw byte stored in `staff.dat`.
 */
export const STAFF_JOB_FOR_CLUB_LABELS: Record<number, string> = {
  0: 'Not set',
  1: 'Chairman',
  2: 'Managing director',
  3: 'General manager',
  4: 'Director of football',
  5: 'Manager',
  6: 'Assistant manager',
  7: 'Reserve team manager',
  8: 'Coach',
  9: 'Scout',
  10: 'Physio',
  11: 'Player',
  12: 'Player / Manager',
  13: 'Player / Assistant manager',
  14: 'Player / Reserve team manager',
  15: 'Player / Coach',
  16: 'Player (retired)',
  17: 'Media pundit',
}

export function staffJobForClubLabel(job: number): string {
  return STAFF_JOB_FOR_CLUB_LABELS[job] ?? `Job ${job}`
}

/** Sorted ids for filter dropdowns (includes all on-disk roles). */
export function staffJobForClubDropdownEntries(): { id: number; label: string }[] {
  return Object.keys(STAFF_JOB_FOR_CLUB_LABELS)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((id) => ({ id, label: STAFF_JOB_FOR_CLUB_LABELS[id]! }))
}
