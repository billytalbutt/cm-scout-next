/** Editable on-disk club / stadium fields (CM0102 `TClub` / `TStadiums`, Pack=1). */

export type ClubEditorFieldKind = 'i32' | 'u16' | 'u8' | 'bool'

export type ClubEditorFieldSpec = {
  key: string
  label: string
  kind: ClubEditorFieldKind
  section: 'club_finance' | 'club_other' | 'stadium'
  hint?: string
}

export const CLUB_EDITOR_FIELDS: readonly ClubEditorFieldSpec[] = [
  {
    key: 'cash',
    label: 'Bank balance',
    kind: 'i32',
    section: 'club_finance',
    hint: 'On-disk cash; the game derives transfer budget from this and other rules.',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    kind: 'i32',
    section: 'club_finance',
  },
  {
    key: 'min_attendance',
    label: 'Min attendance',
    kind: 'i32',
    section: 'club_finance',
  },
  {
    key: 'max_attendance',
    label: 'Max attendance',
    kind: 'i32',
    section: 'club_finance',
  },
  {
    key: 'training',
    label: 'Training facilities',
    kind: 'u8',
    section: 'club_other',
    hint: 'Typically 1–20.',
  },
  {
    key: 'reputation',
    label: 'Reputation',
    kind: 'u16',
    section: 'club_other',
  },
]

export const STADIUM_EDITOR_FIELDS: readonly ClubEditorFieldSpec[] = [
  { key: 'stadium_capacity', label: 'Capacity', kind: 'i32', section: 'stadium' },
  { key: 'stadium_seating', label: 'Seating capacity', kind: 'i32', section: 'stadium' },
  { key: 'stadium_expansion', label: 'Expansion capacity', kind: 'i32', section: 'stadium' },
  { key: 'stadium_nearby_id', label: 'Nearby stadium ID', kind: 'i32', section: 'stadium' },
  {
    key: 'stadium_covered',
    label: 'Covered stands',
    kind: 'bool',
    section: 'stadium',
  },
  {
    key: 'stadium_under_soil_heating',
    label: 'Under-soil heating',
    kind: 'bool',
    section: 'stadium',
  },
]

export const ALL_CLUB_EDITOR_FIELD_SPECS: readonly ClubEditorFieldSpec[] = [
  ...CLUB_EDITOR_FIELDS,
  ...STADIUM_EDITOR_FIELDS,
]

export function clubEditorFieldLabel(key: string): string {
  return ALL_CLUB_EDITOR_FIELD_SPECS.find((f) => f.key === key)?.label ?? key
}
