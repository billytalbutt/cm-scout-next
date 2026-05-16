import {
  intrinsicRaw48,
  listedForLoan,
  transferListedByClub,
  transferListedByRequest,
} from './cmScoutRating'
import type { UiPlayerRow } from './database/types'
import type { GridIncludeFlags, GridPlayerRow } from '../shared/gridTypes'

function baseRow(r: UiPlayerRow): GridPlayerRow {
  return {
    staffId: r.staffId,
    staffIndex: r.staffIndex,
    name: r.name,
    nation: r.nation,
    secondNation: r.secondNation,
    club: r.club,
    ca: r.ca,
    pa: r.pa,
    wage: r.wage,
    value: r.value,
    age: r.age,
    euPassport: r.euPassport,
    cmScoutRatingBp: r.cmScoutRatingBp,
    effPercent: r.effPercent,
    effArchetype: r.effArchetype,
    effArchetypeId: r.effArchetypeId,
    eliteEngineBadgeKind: r.eliteEngineBadgeKind,
    eliteEngineBadgeTitle: r.eliteEngineBadgeTitle,
    eliteEngineBadgeDetail: r.eliteEngineBadgeDetail,
    isRegenLikely: !!r.isRegenLikely,
    regenOf: r.regenOfName ?? '',
    isDemo: false,
    staffHistCareerApps: r.staffHistCareerApps,
    staffHistCareerGoals: r.staffHistCareerGoals,
    staffHistSeasonApps: r.staffHistSeasonApps,
    staffHistSeasonGoals: r.staffHistSeasonGoals,
    spfApps: r.savePerformance?.apps,
    spfGoals: r.savePerformance?.goals,
    spfAst: r.savePerformance?.assists,
  }
}

export function mapUiRowToGridPayload(r: UiPlayerRow, inc: GridIncludeFlags | undefined): GridPlayerRow {
  const row = baseRow(r)
  if (!inc) return row
  const p = r.player
  const s = r.staff
  const c = r.contract

  if (inc.attr48) {
    row.attr48 = intrinsicRaw48(p, s)
  }
  if (inc.role7 && r.cmScoutRolePercents && r.cmScoutRolePercents.length === 7) {
    row.role7 = r.cmScoutRolePercents
  }
  if (inc.reputation) {
    row.repHome = p.home_reputation
    row.repCurrent = p.current_reputation
    row.repWorld = p.world_reputation
  }
  if (inc.misc) {
    row.playerId = p.id
    row.squadNumber = p.squad_number
    row.leftFoot = p.left_foot
    row.rightFoot = p.right_foot
    row.morale = p.morale
    row.staffYob = s.year_of_birth
  }
  if (inc.positions) {
    row.posGk = p.goalkeeper
    row.posSw = p.sweeper
    row.posD = p.defender
    row.posDm = p.defensive_midfielder
    row.posM = p.midfielder
    row.posAm = p.attacking_midfielder
    row.posAtt = p.attacker
    row.posWb = p.wing_back
    row.posRight = p.right_side
    row.posLeft = p.left_side
    row.posCentre = p.centre_side
    row.posFreeRole = p.free_role
  }
  if (inc.staffCore) {
    row.stAdaptability = s.adaptability
    row.stAmbition = s.ambition
    row.stDetermination = s.determination
    row.stLoyalty = s.loyalty
    row.stPressure = s.pressure
    row.stProfessionalism = s.professionalism
    row.stSportsmanship = s.sportsmanship
    row.stTemperament = s.temperament
  }
  if (inc.contract) {
    row.cClubId = c?.club_id ?? null
    row.cGoalBonus = c?.goal_bonus ?? null
    row.cAssistBonus = c?.assist_bonus ?? null
    row.cCleanSheetBonus = c?.clean_sheet_bonus ?? null
    row.cReleaseFee = c?.release_fee ?? null
    row.cDateStarted = c?.date_started_iso ?? null
    row.cDateExpires = c?.contract_expires_iso ?? null
    row.cType = c?.contract_type ?? null
    row.cBosman = !!c && c.leaving_on_bosman > 0
    row.cMinFeeRc = !!c && c.minimum_fee_rc > 0
    row.cNonPromoRc = !!c && c.non_promotion_rc > 0
    row.cNonPlayingRc = !!c && c.non_playing_rc > 0
    row.cRelegationRc = !!c && c.relegation_rc > 0
    row.cTransferStatus = c?.transfer_status ?? null
    row.cSquadStatus = c?.squad_status ?? null
    row.cTransferArranged = c?.transfer_arranged_for ?? null
    const ts = c?.transfer_status ?? 0
    row.cTlClub = transferListedByClub(ts)
    row.cTlRequest = transferListedByRequest(ts)
    row.cLoanListed = listedForLoan(ts)
  }

  return row
}
