/**
 * Byte offsets for editable `club.dat` / `stadium.dat` fields (CM0102Patcher TClub / TStadiums).
 */
import { readCashDisplay, writeCashDisplay } from '../../shared/cm2LongFormat'
import { CLUB_ROW_BYTES } from './clubRecords'
import { STADIUM_ROW_BYTES } from './stadiumRecords'
import type { BlockInfo } from './types'
import { findBlock, writeScalarAt, type DiskFieldKind } from './playerStaffDiskLayout'

export type ClubDiskFieldKind = DiskFieldKind | 'cm2long'

export type ClubDiskFieldMeta = {
  target: 'club' | 'stadium'
  offset: number
  kind: ClubDiskFieldKind
  /** Multiply decoded normal units for UI (cash = 1000 → pounds). */
  displayScale?: number
}

export const CLUB_CASH_OFF = 101
export const CLUB_ATTENDANCE_OFF = 115
export const CLUB_MIN_ATTENDANCE_OFF = 119
export const CLUB_MAX_ATTENDANCE_OFF = 123
export const CLUB_TRAINING_OFF = 127
export const CLUB_REPUTATION_OFF = 128

export const STADIUM_CAPACITY_OFF = 60
export const STADIUM_SEATING_OFF = 64
export const STADIUM_EXPANSION_OFF = 68
export const STADIUM_NEARBY_OFF = 72
export const STADIUM_COVERED_OFF = 76
export const STADIUM_SOIL_HEATING_OFF = 77

export const CLUB_EDITOR_DISK_FIELDS: Record<string, ClubDiskFieldMeta> = {
  cash: { target: 'club', offset: CLUB_CASH_OFF, kind: 'cm2long', displayScale: 1000 },
  attendance: { target: 'club', offset: CLUB_ATTENDANCE_OFF, kind: 'i32' },
  min_attendance: { target: 'club', offset: CLUB_MIN_ATTENDANCE_OFF, kind: 'i32' },
  max_attendance: { target: 'club', offset: CLUB_MAX_ATTENDANCE_OFF, kind: 'i32' },
  training: { target: 'club', offset: CLUB_TRAINING_OFF, kind: 'u8' },
  reputation: { target: 'club', offset: CLUB_REPUTATION_OFF, kind: 'u16' },
  stadium_capacity: { target: 'stadium', offset: STADIUM_CAPACITY_OFF, kind: 'i32' },
  stadium_seating: { target: 'stadium', offset: STADIUM_SEATING_OFF, kind: 'i32' },
  stadium_expansion: { target: 'stadium', offset: STADIUM_EXPANSION_OFF, kind: 'i32' },
  stadium_nearby_id: { target: 'stadium', offset: STADIUM_NEARBY_OFF, kind: 'i32' },
  stadium_covered: { target: 'stadium', offset: STADIUM_COVERED_OFF, kind: 'u8' },
  stadium_under_soil_heating: { target: 'stadium', offset: STADIUM_SOIL_HEATING_OFF, kind: 'u8' },
}

export function readClubEditorDisplayAt(buf: Buffer, base: number, meta: ClubDiskFieldMeta): number {
  const abs = base + meta.offset
  if (meta.kind === 'cm2long') {
    return readCashDisplay(buf.readInt32LE(abs))
  }
  if (meta.kind === 'u8') return buf.readUInt8(abs)
  if (meta.kind === 'u16') return buf.readUInt16LE(abs)
  return buf.readInt32LE(abs)
}

export function writeClubEditorDisplayAt(
  buf: Buffer,
  base: number,
  meta: ClubDiskFieldMeta,
  displayValue: number,
): void {
  const abs = base + meta.offset
  if (meta.kind === 'cm2long') {
    const priorRaw = buf.readInt32LE(abs)
    buf.writeInt32LE(writeCashDisplay(displayValue, priorRaw), abs)
    return
  }
  if (meta.kind === 'u8') {
    buf.writeUInt8(displayValue ? 1 : 0, abs)
    return
  }
  writeScalarAt(buf, abs, meta.kind, displayValue)
}

export function rowIndexForId(data: Buffer, rowBytes: number, id: number): number | null {
  const n = Math.floor(data.length / rowBytes)
  for (let i = 0; i < n; i++) {
    if (data.readInt32LE(i * rowBytes) === id) return i
  }
  return null
}

export function resolveClubAndStadiumBases(
  archiveBuffer: Buffer,
  blocks: BlockInfo[],
  clubId: number,
  stadiumId: number,
): { clubBase: number; stadiumBase: number } | { error: string } {
  const clubBlock = findBlock(blocks, 'club.dat')
  if (!clubBlock) return { error: 'Archive is missing club.dat.' }
  const clubSlice = archiveBuffer.subarray(clubBlock.position, clubBlock.position + clubBlock.size)
  const clubRow = rowIndexForId(clubSlice, CLUB_ROW_BYTES, clubId)
  if (clubRow == null) return { error: `Club id ${clubId} not found in club.dat.` }
  const clubBase = clubBlock.position + clubRow * CLUB_ROW_BYTES

  if (stadiumId <= 0) return { error: 'Club has no linked stadium id.' }
  const stadiumBlock = findBlock(blocks, 'stadium.dat')
  if (!stadiumBlock) return { error: 'Archive is missing stadium.dat (stadium fields cannot be edited).' }
  const stadiumSlice = archiveBuffer.subarray(stadiumBlock.position, stadiumBlock.position + stadiumBlock.size)
  const stadiumRow = rowIndexForId(stadiumSlice, STADIUM_ROW_BYTES, stadiumId)
  if (stadiumRow == null) return { error: `Stadium id ${stadiumId} not found in stadium.dat.` }
  const stadiumBase = stadiumBlock.position + stadiumRow * STADIUM_ROW_BYTES

  return { clubBase, stadiumBase }
}

export function writeClubEditorField(
  buf: Buffer,
  clubBase: number,
  stadiumBase: number,
  key: string,
  displayValue: number,
): boolean {
  const meta = CLUB_EDITOR_DISK_FIELDS[key]
  if (!meta) return false
  const base = meta.target === 'club' ? clubBase : stadiumBase
  const v =
    meta.kind === 'u8' && (key === 'stadium_covered' || key === 'stadium_under_soil_heating')
      ? displayValue
        ? 1
        : 0
      : displayValue
  writeClubEditorDisplayAt(buf, base, meta, v)
  return true
}
