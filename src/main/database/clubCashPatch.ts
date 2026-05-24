/**
 * Club bank balance (`TClub.Cash` @ byte 101) — write + verify on archive buffers.
 */
import {
  cashLooksPlainOnDisk,
  cashMatchesTargetPounds,
  readCashDisplay,
  writeCashDisplay,
  writeCm0102CashToDisk,
} from '../../shared/cm2LongFormat'
import { CLUB_ROW_BYTES } from './clubRecords'
import { readArchiveBlock } from './parser'
import { CLUB_CASH_OFF, rowIndexForId } from './clubStadiumDiskLayout'
import type { BlockInfo } from './types'
import { findBlock } from './playerStaffDiskLayout'

const MAX_CASH_POUNDS = 2_000_000_000

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

/** Write bank balance at an already-resolved `club.dat` row base (same path as stadium fields). */
export function patchClubCashAtClubBase(
  archiveBuffer: Buffer,
  clubBase: number,
  pounds: number,
): ClubCashPatchResult {
  const target = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(pounds)))
  const off = clubBase + CLUB_CASH_OFF
  if (off + 4 > archiveBuffer.length) {
    return { ok: false, error: 'Club cash offset is outside the archive buffer.' }
  }

  const priorRaw = archiveBuffer.readInt32LE(off)
  const priorWasPlain = cashLooksPlainOnDisk(priorRaw)

  let newRaw = priorWasPlain ? target : writeCashDisplay(target, priorRaw)
  archiveBuffer.writeInt32LE(newRaw, off)

  if (!priorWasPlain && !cashMatchesTargetPounds(target, archiveBuffer.readInt32LE(off))) {
    newRaw = writeCm0102CashToDisk(target)
    archiveBuffer.writeInt32LE(newRaw, off)
  }

  const afterRaw = archiveBuffer.readInt32LE(off)
  if (!cashMatchesTargetPounds(target, afterRaw)) {
    const after = readCashDisplay(afterRaw)
    return {
      ok: false,
      error: `Cash patch did not stick (wanted £${target.toLocaleString()}, row reads £${after.toLocaleString()}).`,
    }
  }

  return { ok: true, clubBase, priorRaw, newRaw }
}

/** Write bank balance pounds to `club.dat`, preserving on-disk encoding when possible. */
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
  const target = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(expectedPounds)))
  if (!cashMatchesTargetPounds(target, raw)) {
    const display = readCashDisplay(raw)
    return {
      ok: false,
      error: `Bank balance on disk is £${display.toLocaleString()} (raw 0x${(raw >>> 0).toString(16)}), expected £${target.toLocaleString()}.`,
    }
  }
  return { ok: true }
}
