import { describe, expect, it } from 'vitest'
import {
  contractProtectionYearsAtSigning,
  isContractUnprotected,
} from './contractProtection'
import type { ContractRecord, StaffRecord } from '../main/database/types'

const staffUnder28 = { dob_iso: '1990-06-01', year_of_birth: 1990 } as StaffRecord
const staffOver28 = { dob_iso: '1970-03-15', year_of_birth: 1970 } as StaffRecord

describe('contractProtection', () => {
  it('uses 3 years under 28 and 2 years at 28+', () => {
    expect(contractProtectionYearsAtSigning(27)).toBe(3)
    expect(contractProtectionYearsAtSigning(28)).toBe(2)
  })

  it('marks contract unprotected after the protection window', () => {
    const contract = {
      date_started_iso: '2001-07-01',
      contract_expires_iso: '2006-06-30',
    } as ContractRecord
    expect(isContractUnprotected(contract, staffUnder28, '2004-06-30')).toBe(false)
    expect(isContractUnprotected(contract, staffUnder28, '2004-07-01')).toBe(true)
  })

  it('uses 2-year window when signed aged 28+', () => {
    const contract = {
      date_started_iso: '2001-07-01',
      contract_expires_iso: '2004-06-30',
    } as ContractRecord
    expect(isContractUnprotected(contract, staffOver28, '2003-06-30')).toBe(false)
    expect(isContractUnprotected(contract, staffOver28, '2003-07-01')).toBe(true)
  })

  it('returns false without contract start or game date', () => {
    expect(isContractUnprotected(null, staffUnder28, '2004-07-01')).toBe(false)
    expect(
      isContractUnprotected(
        { date_started_iso: '2001-07-01', contract_expires_iso: null } as ContractRecord,
        staffUnder28,
        null,
      ),
    ).toBe(false)
  })
})
