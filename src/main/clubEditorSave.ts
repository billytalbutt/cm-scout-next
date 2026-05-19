import { clampClubEditorValue } from '../shared/clubEditorLimits'
import type { BlockInfo, ParsedDatabase } from './database/types'
import {
  CLUB_ATTENDANCE_OFF,
  CLUB_CASH_OFF,
  CLUB_EDITOR_DISK_FIELDS,
  CLUB_MAX_ATTENDANCE_OFF,
  CLUB_MIN_ATTENDANCE_OFF,
  CLUB_REPUTATION_OFF,
  CLUB_TRAINING_OFF,
  resolveClubAndStadiumBases,
  STADIUM_CAPACITY_OFF,
  STADIUM_COVERED_OFF,
  STADIUM_EXPANSION_OFF,
  STADIUM_NEARBY_OFF,
  STADIUM_SEATING_OFF,
  STADIUM_SOIL_HEATING_OFF,
  writeClubEditorField,
} from './database/clubStadiumDiskLayout'

export type ClubEditorSaveResult = { ok: true; buffer: Buffer } | { ok: false; error: string }

export type ClubEditorSnapshot = {
  clubId: number
  stadiumId: number
  name: string
  nation: string
  division: string
  stadiumName: string
  values: Record<string, number>
}

function readClubValuesAt(buf: Buffer, clubBase: number): Record<string, number> {
  return {
    cash: buf.readInt32LE(clubBase + CLUB_CASH_OFF),
    attendance: buf.readInt32LE(clubBase + CLUB_ATTENDANCE_OFF),
    min_attendance: buf.readInt32LE(clubBase + CLUB_MIN_ATTENDANCE_OFF),
    max_attendance: buf.readInt32LE(clubBase + CLUB_MAX_ATTENDANCE_OFF),
    training: buf.readUInt8(clubBase + CLUB_TRAINING_OFF),
    reputation: buf.readUInt16LE(clubBase + CLUB_REPUTATION_OFF),
  }
}

function readStadiumValuesAt(buf: Buffer, stadiumBase: number): Record<string, number> {
  return {
    stadium_capacity: buf.readInt32LE(stadiumBase + STADIUM_CAPACITY_OFF),
    stadium_seating: buf.readInt32LE(stadiumBase + STADIUM_SEATING_OFF),
    stadium_expansion: buf.readInt32LE(stadiumBase + STADIUM_EXPANSION_OFF),
    stadium_nearby_id: buf.readInt32LE(stadiumBase + STADIUM_NEARBY_OFF),
    stadium_covered: buf.readUInt8(stadiumBase + STADIUM_COVERED_OFF) ? 1 : 0,
    stadium_under_soil_heating: buf.readUInt8(stadiumBase + STADIUM_SOIL_HEATING_OFF) ? 1 : 0,
  }
}

export function buildClubEditorSnapshot(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  clubId: number,
): ClubEditorSnapshot | { error: string } {
  if (compressed) {
    return {
      error:
        'Club editing requires an uncompressed database or save (Game Settings → Save Compressed = No).',
    }
  }
  const club = db.clubsById?.get(clubId)
  if (!club) return { error: 'Club not found in loaded database.' }
  const stadium = db.stadiumsById?.get(club.stadiumId)
  if (!stadium) return { error: 'Stadium data not loaded for this save (missing stadium.dat?).' }

  const bases = resolveClubAndStadiumBases(archiveBuffer, blocks, clubId, club.stadiumId)
  if ('error' in bases) return { error: bases.error }

  const nation = db.nationNames.get(club.nationId) ?? ''
  const comp = db.clubCompsById?.get(club.divisionCompId)
  const division = comp?.name ?? (club.divisionCompId ? `#${club.divisionCompId}` : '—')

  return {
    clubId: club.id,
    stadiumId: club.stadiumId,
    name: club.name,
    nation,
    division,
    stadiumName: stadium.name,
    values: {
      ...readClubValuesAt(archiveBuffer, bases.clubBase),
      ...readStadiumValuesAt(archiveBuffer, bases.stadiumBase),
    },
  }
}

export function buildPatchedArchiveForClubEdits(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  clubId: number,
  changes: Record<string, number>,
): ClubEditorSaveResult {
  if (compressed) {
    return {
      ok: false,
      error:
        'Club editing requires an uncompressed database or save (Game Settings → Save Compressed = No).',
    }
  }
  const club = db.clubsById?.get(clubId)
  if (!club) return { ok: false, error: 'Club not found.' }

  const bases = resolveClubAndStadiumBases(archiveBuffer, blocks, clubId, club.stadiumId)
  if ('error' in bases) return { ok: false, error: bases.error }

  const out = Buffer.from(archiveBuffer)
  for (const [key, rawVal] of Object.entries(changes)) {
    if (!Number.isFinite(rawVal)) continue
    if (!CLUB_EDITOR_DISK_FIELDS[key]) continue
    writeClubEditorField(out, bases.clubBase, bases.stadiumBase, key, clampClubEditorValue(key, Number(rawVal)))
  }
  return { ok: true, buffer: out }
}
