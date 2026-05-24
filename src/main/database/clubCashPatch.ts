/**
 * Club bank balance (`TClub.Cash` @ byte 101) — write + verify on archive buffers.
 */
import {
  readCashDisplay,
  writeCashDisplay,
  writeCm0102CashToDisk,
} from '../../shared/cm2LongFormat'
import { CLUB_CASH_OFF, rowIndexForId } from './clubStadiumDiskLayout'
import { CLUB_ROW_BYTES } from './clubRecords'
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
  const clubSlice = archiveBuffer.subarray(clubBlock.position, clubBlock.position + clubBlock.size)
  const clubRow = rowIndexForId(clubSlice, CLUB_ROW_BYTES, clubId)
  if (clubRow == null) return { error: `Club id ${clubId} not found in club.dat.` }
  const clubBase = clubBlock.position + clubRow * CLUB_ROW_BYTES
  return clubBase + CLUB_CASH_OFF
}

/** Write bank balance pounds to `club.dat`, preserving on-disk encoding when possible. */
export function patchClubCashOnArchive(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  clubId: number,
  pounds: number,
): ClubCashPatchResult {
  const target = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(pounds)))
  const off = clubCashAbsoluteOffset(archiveBuffer, blocks, clubId)
  if (typeof off !== 'number') return { ok: false, error: off.error }

  const priorRaw = archiveBuffer.readInt32LE(off)
  let newRaw = writeCashDisplay(target, priorRaw)
  archiveBuffer.writeInt32LE(newRaw, off)

  if (readCashDisplay(archiveBuffer.readInt32LE(off)) !== target) {
    newRaw = target
    archiveBuffer.writeInt32LE(newRaw, off)
  }

  if (readCashDisplay(archiveBuffer.readInt32LE(off)) !== target) {
    newRaw = writeCm0102CashToDisk(target)
    archiveBuffer.writeInt32LE(newRaw, off)
  }

  const after = readCashDisplay(archiveBuffer.readInt32LE(off))
  if (after !== target) {
    return {
      ok: false,
      error: `Cash patch did not stick (wanted £${target.toLocaleString()}, row reads £${after.toLocaleString()}).`,
    }
  }

  return { ok: true, clubBase: off - CLUB_CASH_OFF, priorRaw, newRaw }
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
  const display = readCashDisplay(raw)
  const target = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(expectedPounds)))
  if (display !== target) {
    return {
      ok: false,
      error: `Bank balance on disk is £${display.toLocaleString()} (raw 0x${(raw >>> 0).toString(16)}), expected £${target.toLocaleString()}.`,
    }
  }
  return { ok: true }
}
