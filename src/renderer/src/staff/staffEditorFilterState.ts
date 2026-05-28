import type { StaffBrowseFilter } from '../../../main/staffBrowse'
import { STAFF_ATTR_FILTER_COUNT } from '../../../shared/staffAttrCatalog'
import type { ContractTypeCategoryId } from '../../../shared/contractTypes'

export function emptyStaffAttrMins(): string[] {
  return Array.from({ length: STAFF_ATTR_FILTER_COUNT }, () => '')
}

export function countActiveStaffAttrMins(attrMins: readonly string[]): number {
  let n = 0
  for (const s of attrMins) {
    if (s.trim() === '') continue
    const v = Number(s)
    if (Number.isFinite(v) && v > 0) n++
  }
  return n
}

export type StaffEditorFilterForm = {
  q: string
  nation: string
  club: string
  boardOnly: boolean
  staffJobForClub: string
  staffIncludePlayers: boolean
  ageMin: string
  ageMax: string
  wageMin: string
  wageMax: string
  staffCoachingCaMin: string
  staffCoachingCaMax: string
  staffReputationMin: string
  staffReputationMax: string
  staffCoachingPaMin: string
  staffCoachingPaMax: string
  contractTypeCategory: '' | ContractTypeCategoryId
  euOnly: boolean
  bosmanOnly: boolean
  expiresWithinMonths: string
  staffAttrMins: string[]
  staffAttrMinMatchAtLeast: string
}

export function staffBrowseFilterFromForm(form: StaffEditorFilterForm): StaffBrowseFilter {
  const num = (s: string) => {
    if (s === '') return undefined
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }
  const mins = form.staffAttrMins.map((s) => {
    if (s.trim() === '') return null
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : null
  })
  const matchN = num(form.staffAttrMinMatchAtLeast)
  const job =
    !form.boardOnly && form.staffJobForClub !== '' && Number.isFinite(Number(form.staffJobForClub))
      ? Math.floor(Number(form.staffJobForClub))
      : undefined
  const expM = num(form.expiresWithinMonths)
  return {
    q: form.q.trim(),
    nation: form.nation.trim(),
    club: form.club.trim(),
    jobForClub: form.boardOnly ? undefined : job,
    jobForClubIn: form.boardOnly ? [1, 2] : undefined,
    includePlayers: form.staffIncludePlayers,
    ageMin: num(form.ageMin),
    ageMax: num(form.ageMax),
    wageMin: num(form.wageMin),
    wageMax: num(form.wageMax),
    coachingCaMin: num(form.staffCoachingCaMin),
    coachingCaMax: num(form.staffCoachingCaMax),
    reputationMin: num(form.staffReputationMin),
    reputationMax: num(form.staffReputationMax),
    coachingPaMin: num(form.staffCoachingPaMin),
    coachingPaMax: num(form.staffCoachingPaMax),
    contractTypeCategory: form.contractTypeCategory || undefined,
    contractExpiresWithinMonths:
      form.expiresWithinMonths.trim() !== '' && expM != null && expM >= 1 ? Math.floor(expM) : undefined,
    leavingOnBosman: form.bosmanOnly || undefined,
    euPassport: form.euOnly || undefined,
    attrMins: mins.some((m) => m != null) ? mins : undefined,
    attrMinMatchAtLeast:
      form.staffAttrMinMatchAtLeast.trim() !== '' && matchN != null && matchN >= 1 ? Math.floor(matchN) : undefined,
  }
}
