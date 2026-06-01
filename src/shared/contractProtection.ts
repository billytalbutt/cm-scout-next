import { ageFromBirthYearOnly, ageOnGameDate, calendarDaysBetween } from '../main/database/dates'
import type { ContractRecord, StaffRecord } from '../main/database/types'

/** CM 01/02 post-Sept 2001 rule: under 28 at signing → 3 years protected; 28+ → 2 years. */
export const CONTRACT_PROTECTION_AGE_THRESHOLD = 28
export const CONTRACT_PROTECTION_YEARS_UNDER_28 = 3
export const CONTRACT_PROTECTION_YEARS_28_PLUS = 2

export function contractProtectionYearsAtSigning(ageAtSigning: number): number {
  return ageAtSigning >= CONTRACT_PROTECTION_AGE_THRESHOLD
    ? CONTRACT_PROTECTION_YEARS_28_PLUS
    : CONTRACT_PROTECTION_YEARS_UNDER_28
}

/** Whole years at `dateIso` from DOB / birth year (same helpers as the grid). */
export function ageAtIsoDate(
  staff: Pick<StaffRecord, 'dob_iso' | 'year_of_birth'>,
  dateIso: string,
): number | null {
  return (
    ageOnGameDate(staff.dob_iso, dateIso) ?? ageFromBirthYearOnly(staff.year_of_birth, dateIso)
  )
}

/** ISO date `years` after `iso` (calendar components — adequate for CM contract protection). */
export function addCalendarYearsToIso(iso: string, years: number): string | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (![y, m, d].every((n) => Number.isFinite(n))) return null
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * True when the initial protected period has elapsed — player can be approached to sign
 * during a transfer window (CM in-game “unprotected contract”; not Bosman / out of contract).
 */
export function isContractUnprotected(
  contract: Pick<ContractRecord, 'date_started_iso' | 'contract_expires_iso'> | null | undefined,
  staff: Pick<StaffRecord, 'dob_iso' | 'year_of_birth'>,
  gameDateIso: string | null,
): boolean {
  if (!contract?.date_started_iso || !gameDateIso) return false
  const started = contract.date_started_iso
  const ageAtSigning = ageAtIsoDate(staff, started)
  if (ageAtSigning == null) return false
  const protectionEnd = addCalendarYearsToIso(started, contractProtectionYearsAtSigning(ageAtSigning))
  if (!protectionEnd) return false
  const daysUntilEnd = calendarDaysBetween(gameDateIso, protectionEnd)
  if (daysUntilEnd == null || daysUntilEnd > 0) return false
  if (contract.contract_expires_iso) {
    const daysToExpiry = calendarDaysBetween(gameDateIso, contract.contract_expires_iso)
    if (daysToExpiry != null && daysToExpiry < 0) return false
  }
  return true
}

/**
 * Contract start date to write when (re)establishing CM “approach protection” after an extension.
 * Protection is not a separate flag — it is elapsed time since `date_started` (2 or 3 years by age at signing).
 */
export function contractStartIsoForApproachProtection(gameDateIso: string | null | undefined): string | null {
  if (!gameDateIso?.trim()) return null
  return gameDateIso.trim()
}
