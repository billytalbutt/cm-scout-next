/** Writable `contract.dat` row fields (80 bytes per staff index row). */
import type { DiskFieldKind } from './playerStaffDiskLayout'

export const CONTRACT_ROW_BYTES = 80

/** `TContract.DateStarted` / `ContractExpires` — 8-byte TCMDate each (CM0102Patcher). */
export const CONTRACT_DATE_STARTED_OFFSET = 37
export const CONTRACT_DATE_EXPIRES_OFFSET = 45

export const CONTRACT_DISK_FIELDS: Record<string, { offset: number; kind: DiskFieldKind }> = {
  wage: { offset: 12, kind: 'i32' },
  goal_bonus: { offset: 16, kind: 'i32' },
  assist_bonus: { offset: 20, kind: 'i32' },
  clean_sheet_bonus: { offset: 24, kind: 'i32' },
  non_promotion_rc: { offset: 28, kind: 'u8' },
  minimum_fee_rc: { offset: 29, kind: 'u8' },
  non_playing_rc: { offset: 30, kind: 'u8' },
  relegation_rc: { offset: 31, kind: 'u8' },
  manager_job_rc: { offset: 32, kind: 'u8' },
  release_fee: { offset: 33, kind: 'i32' },
  contract_type: { offset: 53, kind: 'u8' },
  leaving_on_bosman: { offset: 73, kind: 'u8' },
  transfer_arranged_for: { offset: 74, kind: 'i32' },
  transfer_status: { offset: 78, kind: 'u8' },
  squad_status: { offset: 79, kind: 'u8' },
}

/** GK “Contract → Club Unhappiness” (`TContract` `Unknown` / CM Scout `Unknown1`). */
export const CONTRACT_CLUB_UNHAPPINESS_OFFSET = 8
export const CONTRACT_CLUB_UNHAPPINESS_LENGTH = 4

/**
 * GK “Contract → Unhappiness” (`Unknown18_*` / CM Scout `Unknown2`, 54–72).
 * Clear all 19 bytes, then restore 70–72 via {@link syncContractSquadMirrorBytes}.
 */
export const CONTRACT_ISSUE_BLOCK_OFFSET = 54
export const CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH = 19
export const CONTRACT_SQUAD_MIRROR_INT16_OFFSET = 70
export const CONTRACT_SQUAD_MIRROR_SHIRT_OFFSET = 72
export const CONTRACT_SQUAD_STATUS_OFFSET = 79

/**
 * After clearing complaints, CM still reads squad role from `Unknown18_3` (int16 @ 70) and shirt @ 72,
 * not only `SquadStatus` @ 79 — zeroing 70–72 without restoring causes “needs clarification on future”.
 */
export function syncContractSquadMirrorBytes(
  buf: Buffer,
  contractRowAbs: number,
  opts?: { squadStatus?: number; squadNumber?: number },
): void {
  if (contractRowAbs < 0 || contractRowAbs + CONTRACT_ROW_BYTES > buf.length) return
  const statusOff = contractRowAbs + CONTRACT_SQUAD_STATUS_OFFSET
  let status = opts?.squadStatus
  if (status == null || !Number.isFinite(status)) {
    status = statusOff < buf.length ? buf.readUInt8(statusOff) : 0
  }
  status = Math.max(0, Math.min(255, Math.trunc(status)))

  const mirrorOff = contractRowAbs + CONTRACT_SQUAD_MIRROR_INT16_OFFSET
  if (mirrorOff + 2 <= buf.length) {
    buf.writeInt16LE(status, mirrorOff)
  }
  if (opts?.squadNumber != null && Number.isFinite(opts.squadNumber)) {
    const shirtOff = contractRowAbs + CONTRACT_SQUAD_MIRROR_SHIRT_OFFSET
    if (shirtOff < buf.length) {
      const shirt = Math.max(0, Math.min(255, Math.trunc(opts.squadNumber)))
      buf.writeUInt8(shirt, shirtOff)
    }
  }
  if (statusOff < buf.length) {
    buf.writeUInt8(status, statusOff)
  }
}
/** @deprecated Use {@link CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH} for writes. */
export const CONTRACT_ISSUE_BLOCK_LENGTH = CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH
/** @deprecated Use {@link CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH} for writes. */
export const CONTRACT_UNHAPPINESS_FLAGS_LENGTH = CONTRACT_UNHAPPINESS_COMPLAINT_LENGTH
