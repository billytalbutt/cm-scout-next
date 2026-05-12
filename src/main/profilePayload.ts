import { buildCa18Display, CA18_KEYS, otherAttrDisplay } from './database/attributes'
import type { UiPlayerRow } from './database/types'

const OTHER_KEYS = [
  'acceleration',
  'agility',
  'balance',
  'corners',
  'flair',
  'injury_proneness',
  'dirtiness',
  'jumping',
  'natural_fitness',
  'pace',
  'free_kicks',
  'stamina',
  'strength',
  'technique',
  'work_rate',
  'aggression',
  'important_matches',
  'consistency',
  'influence',
  'teamwork',
  'versatility',
  'morale',
] as const

export function buildProfilePayload(row: UiPlayerRow) {
  const p = row.player
  const s = row.staff
  const ca18 = buildCa18Display(p)
  const other: Record<string, { raw: number; inGame: number; inMatch: number }> = {}
  for (const k of OTHER_KEYS) other[k] = otherAttrDisplay(p[k as keyof typeof p] as number)
  const mentalStaff = {
    adaptability: otherAttrDisplay(s.adaptability),
    ambition: otherAttrDisplay(s.ambition),
    determination: otherAttrDisplay(s.determination),
    loyalty: otherAttrDisplay(s.loyalty),
    pressure: otherAttrDisplay(s.pressure),
    professionalism: otherAttrDisplay(s.professionalism),
    sportsmanship: otherAttrDisplay(s.sportsmanship),
    temperament: otherAttrDisplay(s.temperament),
  }
  const contract = row.contract
    ? {
        wage: row.contract.wage,
        clubId: row.contract.club_id,
        goalBonus: row.contract.goal_bonus,
        assistBonus: row.contract.assist_bonus,
        releaseFee: row.contract.release_fee,
        type: row.contract.contract_type,
        dateStarted: row.contract.date_started_iso,
        contractExpires: row.contract.contract_expires_iso,
        leavingOnBosman: row.contract.leaving_on_bosman > 0,
        minimumReleaseClause: row.contract.minimum_fee_rc > 0,
        nonPromotionClause: row.contract.non_promotion_rc > 0,
        nonPlayingClause: row.contract.non_playing_rc > 0,
        relegationClause: row.contract.relegation_rc > 0,
      }
    : null
  return {
    name: row.name,
    nation: row.nation,
    club: row.club,
    dobIso: s.dob_iso,
    euPassport: row.euPassport,
    ca: p.current_ability,
    pa: p.potential_ability,
    ca18: CA18_KEYS.map((k) => ({ key: k, ...ca18[k] })),
    other,
    mentalStaff,
    contract,
    positions: {
      gk: p.goalkeeper,
      sw: p.sweeper,
      d: p.defender,
      dm: p.defensive_midfielder,
      m: p.midfielder,
      am: p.attacking_midfielder,
      st: p.attacker,
      wb: p.wing_back,
    },
  }
}
