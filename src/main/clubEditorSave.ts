import { cashLooksPlainOnDisk, readCashDisplay } from '../shared/cm2LongFormat'
import { clampClubEditorValue } from '../shared/clubEditorLimits'
import type { BlockInfo, ParsedDatabase } from './database/types'
import { patchClubCashAtClubBase } from './database/clubCashPatch'
import {
  CLUB_CASH_OFF,
  CLUB_EDITOR_DISK_FIELDS,
  readClubEditorDisplayAt,
  resolveClubAndStadiumBases,
  writeClubEditorField,
} from './database/clubStadiumDiskLayout'

export type ClubEditorSaveResult = { ok: true; buffer: Buffer } | { ok: false; error: string }

function readEditorValuesAt(buf: Buffer, clubBase: number, stadiumBase: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, meta] of Object.entries(CLUB_EDITOR_DISK_FIELDS)) {
    const base = meta.target === 'club' ? clubBase : stadiumBase
    out[key] = readClubEditorDisplayAt(buf, base, meta)
  }
  return out
}

export type ClubEditorSnapshot = {
  clubId: number
  stadiumId: number
  name: string
  nation: string
  division: string
  stadiumName: string
  values: Record<string, number>
  /** Human player-manager's `club_job_id` when found (for bank balance warnings). */
  humanManagedClubId: number | null
  /** Raw `TClub.Cash` on disk for this club (debug / mismatch checks). */
  cashOnDisk?: { raw: number; display: number; encoding: 'plain' | 'packed' }
}

/** Club id of the playable manager (player linked + manager job), if any. */
export function findHumanManagedClubId(db: ParsedDatabase): number | null {
  for (const s of db.staff) {
    if (s.player_id < 0) continue
    if (s.job_for_club !== 5 && s.job_for_club !== 12) continue
    if (s.club_job_id > 0) return s.club_job_id
  }
  return null
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

  const cashRaw = archiveBuffer.readInt32LE(bases.clubBase + CLUB_CASH_OFF)
  return {
    clubId: club.id,
    stadiumId: club.stadiumId,
    name: club.name,
    nation,
    division,
    stadiumName: stadium.name,
    values: readEditorValuesAt(archiveBuffer, bases.clubBase, bases.stadiumBase),
    humanManagedClubId: findHumanManagedClubId(db),
    cashOnDisk: {
      raw: cashRaw,
      display: readCashDisplay(cashRaw),
      encoding: cashLooksPlainOnDisk(cashRaw) ? 'plain' : 'packed',
    },
  }
}

/** Apply every supplied editor field (full form state), not a delta from an old baseline. */
export function buildPatchedArchiveForClubEdits(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  compressed: boolean,
  db: ParsedDatabase,
  clubId: number,
  values: Record<string, number>,
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
  const cashPounds = values.cash
  const fieldValues = { ...values }
  delete fieldValues.cash

  for (const [key, rawVal] of Object.entries(fieldValues)) {
    if (!Number.isFinite(rawVal)) continue
    if (!CLUB_EDITOR_DISK_FIELDS[key]) continue
    writeClubEditorField(out, bases.clubBase, bases.stadiumBase, key, clampClubEditorValue(key, Number(rawVal)))
  }

  if (cashPounds !== undefined && Number.isFinite(cashPounds)) {
    const cashPatch = patchClubCashAtClubBase(
      out,
      bases.clubBase,
      clampClubEditorValue('cash', Number(cashPounds)),
    )
    if (!cashPatch.ok) return { ok: false, error: cashPatch.error }
  }

  return { ok: true, buffer: out }
}
