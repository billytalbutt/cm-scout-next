/** Writable `contract.dat` row fields (80 bytes per staff index row). */
import type { DiskFieldKind } from './playerStaffDiskLayout'

export const CONTRACT_ROW_BYTES = 80

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
