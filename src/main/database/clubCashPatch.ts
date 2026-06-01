/**
 * Club bank balance (`TClub.Cash` @ club.dat row byte 101) — read + write + verify.
 *
 * CM 01/02 stores the bank balance as a **plain signed int32 in pounds** (negative = in debt).
 * Verified against a real save: Barcelona £102,000,000, Blackburn £72,000,000, Man Utd £30,400,000,
 * with clubs in debt reading as negative int32 — no packed/encoded "CM2 long" format is involved.
 */
import { CLUB_ROW_BYTES } from './clubRecords'
import { readArchiveBlock } from './parser'
import { CLUB_CASH_OFF, rowIndexForId } from './clubStadiumDiskLayout'
import type { BlockInfo } from './types'
import { findBlock } from './playerStaffDiskLayout'

/** Vanilla CM0102 overflows above ~£2bn without the EnsureCashDoesNotResetToZero patch. */
export const MAX_CLUB_CASH = 2_000_000_000
export const MIN_CLUB_CASH = -2_000_000_000

/** Clamp editor pounds to the int32 range CM tolerates (negatives allowed for debt). */
export function clampClubCashPounds(pounds: number): number {
  if (!Number.isFinite(pounds)) return 0
  return Math.max(MIN_CLUB_CASH, Math.min(MAX_CLUB_CASH, Math.trunc(pounds)))
}

export type ClubCashPatchResult =
  | { ok: true; clubBase: number; priorRaw: number; newRaw: number }
  | { ok: false; error: string }

/** Locate absolute offset of `TClub.Cash` for `clubId` in `club.dat`. */
export function clubCashAbsoluteOffset(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  clubId: number,
): number | { error: string } {
  const clubBlock = findBlock(blocks, 'club.dat')
  if (!clubBlock) return { error: 'Archive is missing club.dat.' }
  const clubBuf =
    readArchiveBlock(archiveBuffer, 'club.dat') ??
    archiveBuffer.subarray(clubBlock.position, clubBlock.position + clubBlock.size)
  const clubRow = rowIndexForId(clubBuf, CLUB_ROW_BYTES, clubId)
  if (clubRow == null) return { error: `Club id ${clubId} not found in club.dat.` }
  const clubBase = clubBlock.position + clubRow * CLUB_ROW_BYTES
  return clubBase + CLUB_CASH_OFF
}

/** Write bank balance pounds at an already-resolved `club.dat` row base (plain int32). */
export function patchClubCashAtClubBase(
  archiveBuffer: Buffer,
  clubBase: number,
  pounds: number,
): ClubCashPatchResult {
  const target = clampClubCashPounds(pounds)
  const off = clubBase + CLUB_CASH_OFF
  if (off + 4 > archiveBuffer.length) {
    return { ok: false, error: 'Club cash offset is outside the archive buffer.' }
  }

  const priorRaw = archiveBuffer.readInt32LE(off)
  archiveBuffer.writeInt32LE(target, off)
  const afterRaw = archiveBuffer.readInt32LE(off)
  if (afterRaw !== target) {
    return {
      ok: false,
      error: `Cash patch did not stick (wanted £${target.toLocaleString()}, row reads £${afterRaw.toLocaleString()}).`,
    }
  }

  return { ok: true, clubBase, priorRaw, newRaw: target }
}

/** Write bank balance pounds to `club.dat` (plain int32). */
export function patchClubCashOnArchive(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  clubId: number,
  pounds: number,
): ClubCashPatchResult {
  const off = clubCashAbsoluteOffset(archiveBuffer, blocks, clubId)
  if (typeof off !== 'number') return { ok: false, error: off.error }
  return patchClubCashAtClubBase(archiveBuffer, off - CLUB_CASH_OFF, pounds)
}

export function verifyClubCashOnArchive(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  clubId: number,
  expectedPounds: number,
): { ok: true } | { ok: false; error: string } {
  const off = clubCashAbsoluteOffset(archiveBuffer, blocks, clubId)
  if (typeof off !== 'number') return { ok: false, error: off.error }
  const raw = archiveBuffer.readInt32LE(off)
  const target = clampClubCashPounds(expectedPounds)
  if (raw !== target) {
    return {
      ok: false,
      error: `Bank balance on disk is £${raw.toLocaleString()}, expected £${target.toLocaleString()}.`,
    }
  }
  return { ok: true }
}
