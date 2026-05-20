/**
 * Full `club.dat` row (581 bytes, `TClub` in CM0102Patcher Structures.cs).
 * Offsets verified by sequential Pack=1 layout from ID through HasLinkedClub.
 */
import { readCashDisplay } from '../../shared/cm2LongFormat'
import { readLatin1String } from './cmBinaryReader'
import type { ClubRecord } from './types'

export const CLUB_ROW_BYTES = 581

/** Byte offset of `TClub.Squad[0]` (50 × int32). Sequential `TClub` @ Pack=1 (CM0102Patcher). */
export const CLUB_SQUAD_STAFF_IDS_OFF = 215

/** Byte offset of `TClub.TeamSelected[0]` (20 × int32). */
export const CLUB_TEAM_SELECTED_OFF = 480
/** Byte offset of `TClub.TacticTraining[0]` (4 × int32). */
export const CLUB_TACTIC_TRAINING_OFF = 560
/** Byte offset of `TClub.TacticSelected` (int32). */
export const CLUB_TACTIC_SELECTED_OFF = 576

export function parseClubRecords(data: Buffer): Map<number, ClubRecord> {
  const m = new Map<number, ClubRecord>()
  const n = Math.floor(data.length / CLUB_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const off = i * CLUB_ROW_BYTES
    const row = data.subarray(off, off + CLUB_ROW_BYTES)
    if (row.length < CLUB_ROW_BYTES) continue
    const id = row.readInt32LE(0)
    const name = readLatin1String(row.subarray(4, 55), 51)
    const nation = row.readInt32LE(83)
    const division = row.readInt32LE(87)
    const cash = readCashDisplay(row.readInt32LE(101))
    const stadium = row.readInt32LE(105)
    const attendance = row.readInt32LE(115)
    const training = row.readUInt8(127)
    const reputation = row.readUInt16LE(128)
    const squadStaffIds: number[] = []
    let sq = CLUB_SQUAD_STAFF_IDS_OFF
    for (let j = 0; j < 50; j++) {
      squadStaffIds.push(row.readInt32LE(sq))
      sq += 4
    }
    const teamSelectedStaffIds: number[] = []
    let ts = CLUB_TEAM_SELECTED_OFF
    for (let j = 0; j < 20; j++) {
      teamSelectedStaffIds.push(row.readInt32LE(ts))
      ts += 4
    }
    const tacticTrainingIds: number[] = []
    let tt = CLUB_TACTIC_TRAINING_OFF
    for (let j = 0; j < 4; j++) {
      tacticTrainingIds.push(row.readInt32LE(tt))
      tt += 4
    }
    const tacticSelectedId = row.readInt32LE(CLUB_TACTIC_SELECTED_OFF)
    m.set(id, {
      id,
      name,
      nationId: nation,
      divisionCompId: division,
      cash,
      stadiumId: stadium,
      attendance,
      training,
      reputation,
      squadStaffIds,
      teamSelectedStaffIds,
      tacticTrainingIds,
      tacticSelectedId,
    })
  }
  return m
}
