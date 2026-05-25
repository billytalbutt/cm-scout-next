import { cashLooksPlainOnDisk, readCashDisplay } from '../shared/cm2LongFormat'
import { clampClubEditorValue } from '../shared/clubEditorLimits'
import type { BlockInfo, ParsedDatabase, StaffRecord } from './database/types'
import { readArchiveBlock } from './database/parser'
import { patchClubCashAtClubBase } from './database/clubCashPatch'
import { CLUB_ROW_BYTES } from './database/clubRecords'
import {
  CLUB_CASH_OFF,
  CLUB_EDITOR_DISK_FIELDS,
  readClubEditorDisplayAt,
  resolveClubAndStadiumBases,
  rowIndexForId,
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
  /** Playable human manager's `club_job_id` when detected (informational). */
  humanManagedClubId: number | null
  /** Raw `TClub.Cash` on disk for this club (debug / mismatch checks). */
  cashOnDisk?: { raw: number; display: number; encoding: 'plain' | 'packed' }
}

/** `TStaff` byte offset of `ClubJob` within a 110-byte staff row. */
const STAFF_CLUB_JOB_ID_OFF = 53

const CLUB_MANAGER_JOBS = new Set([5, 12])

/** Read club id from decompressed `human_manager.dat` (first `TStaff` row). Exported for tests. */
export function humanClubIdFromManagerDatBuffer(hm: Buffer, staff: StaffRecord[]): number | null {
  if (hm.length < STAFF_CLUB_JOB_ID_OFF + 4) return null

  const clubFromRow = hm.readInt32LE(STAFF_CLUB_JOB_ID_OFF)
  const staffId = hm.readInt32LE(0)
  if (staffId > 0) {
    for (const s of staff) {
      if (s.id === staffId && s.club_job_id > 0) return s.club_job_id
    }
  }
  if (clubFromRow > 0) return clubFromRow
  return null
}

function clubIdFromHumanManagerDat(archiveBuffer: Buffer, staff: StaffRecord[]): number | null {
  const hm = readArchiveBlock(archiveBuffer, 'human_manager.dat')
  if (!hm) return null
  return humanClubIdFromManagerDatBuffer(hm, staff)
}

/** Club id of the human player-manager in this save, if detectable. */
export function findHumanManagedClubId(db: ParsedDatabase, archiveBuffer?: Buffer): number | null {
  if (archiveBuffer?.length) {
    const fromHm = clubIdFromHumanManagerDat(archiveBuffer, db.staff)
    if (fromHm != null) return fromHm
  }

  for (let i = 0; i < db.staff.length; i++) {
    const s = db.staff[i]!
    if (!CLUB_MANAGER_JOBS.has(s.job_for_club) || s.club_job_id <= 0) continue
    const contract = db.contractsByStaffIndex.get(i)
    if (contract?.manager_job_rc) return s.club_job_id
  }

  for (const s of db.staff) {
    if (s.job_for_club === 12 && s.player_id >= 0 && s.club_job_id > 0) return s.club_job_id
  }

  for (const s of db.staff) {
    if (s.job_for_club === 5 && s.club_job_id > 0) return s.club_job_id
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

  const clubBuf = readArchiveBlock(archiveBuffer, 'club.dat')
  const clubRowIdx = clubBuf != null ? rowIndexForId(clubBuf, CLUB_ROW_BYTES, clubId) : null
  const cashRaw =
    clubBuf != null && clubRowIdx != null
      ? clubBuf.readInt32LE(clubRowIdx * CLUB_ROW_BYTES + CLUB_CASH_OFF)
      : archiveBuffer.readInt32LE(bases.clubBase + CLUB_CASH_OFF)
  const cashDisplay = readCashDisplay(cashRaw)
  const values = readEditorValuesAt(archiveBuffer, bases.clubBase, bases.stadiumBase)
  // Always trust decompressed club.dat for bank balance (never a stale in-archive slice).
  if (clubBuf != null && clubRowIdx != null) {
    const rowBase = clubRowIdx * CLUB_ROW_BYTES
    for (const [key, meta] of Object.entries(CLUB_EDITOR_DISK_FIELDS)) {
      if (meta.target !== 'club') continue
      values[key] = readClubEditorDisplayAt(clubBuf, rowBase, meta)
    }
  }
  values.cash = cashDisplay
  return {
    clubId: club.id,
    stadiumId: club.stadiumId,
    name: club.name,
    nation,
    division,
    stadiumName: stadium.name,
    values,
    humanManagedClubId: findHumanManagedClubId(db, archiveBuffer),
    cashOnDisk: {
      raw: cashRaw,
      display: cashDisplay,
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
