import type { BlockInfo, ParsedDatabase } from './database/types'
import { buildClubSquadPlayerRows } from './clubBrowse'
import {
  findBlock,
  PLAYER_DISK_FIELDS,
  STAFF_ROW_BYTES,
  writeScalarAt,
} from './database/playerStaffDiskLayout'
import { clearContractUnhappinessAtRow, resolveContractRowAbsOffset } from './contractEditorSave'

const STAFF_CLUB_VALUATION_OFFSET = 0x60

/** Playable squad player staff indices at a club (same set as the Clubs squad list). */
export function clubSquadPlayerStaffIndices(db: ParsedDatabase, clubId: number): number[] {
  return buildClubSquadPlayerRows(db, clubId).map((r) => r.staffIndex)
}

export function applyClearUnhappinessForStaff(
  buf: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  staffIndex: number,
): { ok: true } | { ok: false; error: string } {
  const staff = db.staff[staffIndex]
  if (!staff) return { ok: false, error: 'Invalid staff index.' }
  const playerRow = staff.player_id
  if (playerRow < 0 || playerRow >= db.players.length) {
    return { ok: false, error: 'Staff row is not linked to a player.' }
  }
  const playerBlock = findBlock(blocks, 'player.dat')
  const staffBlock = findBlock(blocks, 'staff.dat')
  if (!playerBlock || !staffBlock) {
    return { ok: false, error: 'Archive is missing player.dat or staff.dat block.' }
  }
  const playerBase = playerBlock.position + playerRow * 80
  const staffBase = staffBlock.position + staffIndex * STAFF_ROW_BYTES
  writeScalarAt(buf, playerBase + PLAYER_DISK_FIELDS.morale.offset, 'i8', 20)
  writeScalarAt(buf, staffBase + STAFF_CLUB_VALUATION_OFFSET, 'u8', 0)
  const contractRow = resolveContractRowAbsOffset(buf, blocks, staffIndex)
  if (contractRow != null) clearContractUnhappinessAtRow(buf, contractRow)
  return { ok: true }
}

export function applyClearUnhappinessForClubSquad(
  buf: Buffer,
  blocks: BlockInfo[],
  db: ParsedDatabase,
  clubId: number,
): { ok: true; cleared: number } | { ok: false; error: string } {
  const indices = clubSquadPlayerStaffIndices(db, clubId)
  for (const staffIndex of indices) {
    const r = applyClearUnhappinessForStaff(buf, blocks, db, staffIndex)
    if (!r.ok) return r
  }
  return { ok: true, cleared: indices.length }
}
