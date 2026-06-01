import type { BlockInfo, ParsedDatabase } from './database/types'
import { buildClubSquadPlayerRows, staffEmployedAtClub } from './clubBrowse'
import {
  findBlock,
  PLAYER_DISK_FIELDS,
  PLAYER_ROW_BYTES,
  STAFF_ROW_BYTES,
  writeScalarAt,
} from './database/playerStaffDiskLayout'
import { clearContractUnhappinessAtRow, resolveContractRowAbsOffset } from './contractEditorSave'
import {
  CONTRACT_SQUAD_MIRROR_OFFSET,
  CONTRACT_UNHAPPINESS_TAIL_OFFSET,
} from './database/contractDiskLayout'
import {
  clearPreferencesDislikesForId,
  STAFF_PREFERENCES_ID_OFFSET,
} from './database/staffPreferencesDiskLayout'

const STAFF_CLUB_VALUATION_OFFSET = 0x60
/** Max byte — in-game “superb” happiness with the club (GK editor sets morale to 20; valuation to max). */
const CLUB_VALUATION_SUPERB = 20
const MORALE_SUPERB = 20

function isPlayerLinkedStaff(db: ParsedDatabase, staffIndex: number): boolean {
  const s = db.staff[staffIndex]
  return !!s && s.player_id >= 0 && s.player_id < db.players.length
}

function staffIndexForStaffId(db: ParsedDatabase, staffId: number): number | null {
  if (staffId <= 0) return null
  const idx = db.staff.findIndex((s) => s.id === staffId)
  return idx >= 0 ? idx : null
}

/**
 * Player-linked staff indices to clear at a club.
 * Broader than the Clubs UI squad list: includes every employed player and anyone listed in
 * `club.dat` squad / team-selected slots (CM can show them as unhappy even when name filters
 * exclude them from Merlin’s squad table).
 */
export function clubSquadPlayerStaffIndices(db: ParsedDatabase, clubId: number): number[] {
  const seen = new Set<number>()
  const add = (staffIndex: number) => {
    if (!isPlayerLinkedStaff(db, staffIndex) || seen.has(staffIndex)) return
    seen.add(staffIndex)
  }

  for (const row of buildClubSquadPlayerRows(db, clubId)) {
    add(row.staffIndex)
  }

  for (let staffIndex = 0; staffIndex < db.staff.length; staffIndex++) {
    if (staffEmployedAtClub(db, staffIndex, clubId)) add(staffIndex)
  }

  const club = db.clubsById?.get(clubId)
  if (club) {
    for (const sid of club.squadStaffIds) {
      const idx = staffIndexForStaffId(db, sid)
      if (idx != null) add(idx)
    }
    for (const sid of club.teamSelectedStaffIds) {
      const idx = staffIndexForStaffId(db, sid)
      if (idx != null) add(idx)
    }
  }

  return [...seen]
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
  const playerBase = playerBlock.position + playerRow * PLAYER_ROW_BYTES
  if (playerBase + PLAYER_ROW_BYTES > buf.length || playerBase < 0) {
    return { ok: false, error: 'player.dat row falls outside the file — unexpected block size.' }
  }
  const staffBase = staffBlock.position + staffIndex * STAFF_ROW_BYTES
  if (staffBase + STAFF_ROW_BYTES > buf.length || staffBase < 0) {
    return { ok: false, error: 'staff.dat row falls outside the file — unexpected block size.' }
  }
  writeScalarAt(buf, playerBase + PLAYER_DISK_FIELDS.morale.offset, 'i8', MORALE_SUPERB)
  writeScalarAt(buf, staffBase + STAFF_CLUB_VALUATION_OFFSET, 'u8', CLUB_VALUATION_SUPERB)
  const preferencesId = buf.readInt32LE(staffBase + STAFF_PREFERENCES_ID_OFFSET)
  const prefBlock = findBlock(blocks, 'Preferences.dat')
  if (prefBlock && preferencesId > 0) {
    clearPreferencesDislikesForId(buf, prefBlock.position, prefBlock.size, preferencesId)
  }
  const squadNumber = buf.readUInt8(playerBase + PLAYER_DISK_FIELDS.squad_number.offset)
  const contractRow = resolveContractRowAbsOffset(buf, blocks, staffIndex, staff.id)
  if (contractRow != null) {
    clearContractUnhappinessAtRow(buf, contractRow)
    if (squadNumber > 0) {
      buf.writeUInt8(squadNumber, contractRow + CONTRACT_SQUAD_MIRROR_OFFSET)
      if (contractRow + CONTRACT_UNHAPPINESS_TAIL_OFFSET < buf.length) {
        buf.writeUInt8(squadNumber, contractRow + CONTRACT_UNHAPPINESS_TAIL_OFFSET)
      }
    }
  }
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
