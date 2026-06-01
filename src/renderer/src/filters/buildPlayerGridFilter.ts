import type { ContractTypeCategoryId } from '../../../shared/contractTypes'
import type { EngineSnifferPresetId } from '../../../shared/engineSnifferAttrPresets'
import type { GridIncludeFlags } from '../../../shared/gridTypes'
import type {
  PositionRoleFilterId,
  PositionSideFilterId,
} from '../../../shared/playerPositionFilter'
import type { BrowseTabId } from '../BrowseTabBar'

export type PlayerGridFilterBuildInput = {
  committedText: { q: string; nation: string; club: string }
  caMin: string
  caMax: string
  paMin: string
  paMax: string
  cmScoutMin: string
  cmScoutMax: string
  effMin: string
  effMax: string
  ageMin: string
  ageMax: string
  valueMin: string
  valueMax: string
  wageMin: string
  wageMax: string
  shCareerGoalsMin: string
  shCareerGoalsMax: string
  shSeasonGoalsMin: string
  shSeasonGoalsMax: string
  shCareerAppsMin: string
  shSeasonAppsMin: string
  csGoalsMin: string
  csGoalsMax: string
  csAssistsMin: string
  csAssistsMax: string
  csAppsMin: string
  csAvrMin: string
  csLeagueGoalsMin: string
  csLeagueAssistsMin: string
  csCompetitionId: string
  csCompGoalsMin: string
  csCompGoalsMax: string
  csCompAssistsMin: string
  csCompAssistsMax: string
  csCompAppsMin: string
  contractTypeCategory: ContractTypeCategoryId | ''
  tlClub: boolean
  tlRequest: boolean
  loanListed: boolean
  euOnly: boolean
  bosmanOnly: boolean
  minReleaseClause: boolean
  unprotectedContractOnly: boolean
  expiresWithinMonths: string
  attrMins: string[]
  attrMinMatchAtLeast: string
  browseTab: BrowseTabId
  regenOnly: boolean
  engineSniffer: EngineSnifferPresetId
  positionFilterRoles: PositionRoleFilterId[]
  positionFilterSides: PositionSideFilterId[]
  gridInclude?: GridIncludeFlags
}

/** Same payload shape as `get-rows` (without offset/limit). */
export function buildPlayerGridFilterPayload(input: PlayerGridFilterBuildInput): Record<string, unknown> {
  const num = (s: string) => (s === '' ? undefined : Number(s))
  const f: Record<string, unknown> = {
    q: input.committedText.q,
    nation: input.committedText.nation,
    club: input.committedText.club,
  }
  const caLo = num(input.caMin)
  const caHi = num(input.caMax)
  const paLo = num(input.paMin)
  const paHi = num(input.paMax)
  const ageLo = num(input.ageMin)
  const ageHi = num(input.ageMax)
  const vLo = num(input.valueMin)
  const vHi = num(input.valueMax)
  const wLo = num(input.wageMin)
  const wHi = num(input.wageMax)
  if (Number.isFinite(caLo)) f.caMin = caLo
  if (Number.isFinite(caHi)) f.caMax = caHi
  if (Number.isFinite(paLo)) f.paMin = paLo
  if (Number.isFinite(paHi)) f.paMax = paHi
  const scoutLo = num(input.cmScoutMin)
  const scoutHi = num(input.cmScoutMax)
  const effLo = num(input.effMin)
  const effHi = num(input.effMax)
  if (Number.isFinite(scoutLo)) f.cmScoutMin = scoutLo
  if (Number.isFinite(scoutHi)) f.cmScoutMax = scoutHi
  if (Number.isFinite(effLo)) f.effMin = effLo
  if (Number.isFinite(effHi)) f.effMax = effHi
  if (Number.isFinite(ageLo)) f.ageMin = ageLo
  if (Number.isFinite(ageHi)) f.ageMax = ageHi
  if (Number.isFinite(vLo)) f.valueMin = vLo
  if (Number.isFinite(vHi)) f.valueMax = vHi
  if (Number.isFinite(wLo)) f.wageMin = wLo
  if (Number.isFinite(wHi)) f.wageMax = wHi
  const scgMin = num(input.shCareerGoalsMin)
  const scgMax = num(input.shCareerGoalsMax)
  const ssgMin = num(input.shSeasonGoalsMin)
  const ssgMax = num(input.shSeasonGoalsMax)
  const scaMin = num(input.shCareerAppsMin)
  const ssaMin = num(input.shSeasonAppsMin)
  if (Number.isFinite(scgMin)) f.shCareerGoalsMin = scgMin
  if (Number.isFinite(scgMax)) f.shCareerGoalsMax = scgMax
  if (Number.isFinite(ssgMin)) f.shSeasonGoalsMin = ssgMin
  if (Number.isFinite(ssgMax)) f.shSeasonGoalsMax = ssgMax
  if (Number.isFinite(scaMin)) f.shCareerAppsMin = scaMin
  if (Number.isFinite(ssaMin)) f.shSeasonAppsMin = ssaMin
  const csgMin = num(input.csGoalsMin)
  const csgMax = num(input.csGoalsMax)
  const csaMin = num(input.csAssistsMin)
  const csaMax = num(input.csAssistsMax)
  const csapMin = num(input.csAppsMin)
  const csAvrMin = num(input.csAvrMin)
  const clgMin = num(input.csLeagueGoalsMin)
  const claMin = num(input.csLeagueAssistsMin)
  if (Number.isFinite(csgMin)) f.csGoalsMin = csgMin
  if (Number.isFinite(csgMax)) f.csGoalsMax = csgMax
  if (Number.isFinite(csaMin)) f.csAssistsMin = csaMin
  if (Number.isFinite(csaMax)) f.csAssistsMax = csaMax
  if (Number.isFinite(csapMin)) f.csAppsMin = csapMin
  if (Number.isFinite(csAvrMin)) f.csAvrMin = csAvrMin
  if (Number.isFinite(clgMin)) f.csLeagueGoalsMin = clgMin
  if (Number.isFinite(claMin)) f.csLeagueAssistsMin = claMin
  const compId = Math.floor(Number(input.csCompetitionId))
  if (input.csCompetitionId.trim() !== '' && Number.isFinite(compId) && compId > 0) {
    f.csCompetitionId = compId
  }
  const ccgMin = num(input.csCompGoalsMin)
  const ccgMax = num(input.csCompGoalsMax)
  const ccaMin = num(input.csCompAssistsMin)
  const ccaMax = num(input.csCompAssistsMax)
  const ccAppsMin = num(input.csCompAppsMin)
  if (Number.isFinite(ccgMin)) f.csCompGoalsMin = ccgMin
  if (Number.isFinite(ccgMax)) f.csCompGoalsMax = ccgMax
  if (Number.isFinite(ccaMin)) f.csCompAssistsMin = ccaMin
  if (Number.isFinite(ccaMax)) f.csCompAssistsMax = ccaMax
  if (Number.isFinite(ccAppsMin)) f.csCompAppsMin = ccAppsMin
  if (input.contractTypeCategory) f.contractTypeCategory = input.contractTypeCategory
  if (input.tlClub) f.transferListedClub = true
  if (input.tlRequest) f.transferListedRequest = true
  if (input.loanListed) f.listedForLoan = true
  if (input.euOnly) f.euPassport = true
  if (input.bosmanOnly) f.leavingOnBosman = true
  if (input.minReleaseClause) f.hasMinimumReleaseClause = true
  if (input.unprotectedContractOnly) f.contractUnprotected = true
  const expM = num(input.expiresWithinMonths)
  if (input.expiresWithinMonths.trim() !== '' && Number.isFinite(expM) && expM >= 1) {
    f.contractExpiresWithinMonths = Math.floor(expM)
  }
  const mins = input.attrMins.map((s) => {
    if (s.trim() === '') return null
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : null
  })
  if (mins.some((m) => m != null)) f.attrMins = mins
  const matchN = num(input.attrMinMatchAtLeast)
  if (input.attrMinMatchAtLeast.trim() !== '' && Number.isFinite(matchN) && matchN >= 1) {
    f.attrMinMatchAtLeast = Math.floor(matchN)
  }
  if (input.browseTab === 'regens') {
    f.isRegenLikely = true
  } else if (input.regenOnly) {
    f.isRegenLikely = true
  }
  if (input.engineSniffer !== 'off') f.engineSniffer = input.engineSniffer
  if (input.positionFilterRoles.length) f.positionRoles = input.positionFilterRoles
  if (input.positionFilterSides.length) f.positionFilterSides = input.positionFilterSides
  if (input.gridInclude) f.gridInclude = input.gridInclude
  return f
}
