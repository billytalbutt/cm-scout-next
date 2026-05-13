/**
 * Heuristic CM0102 individual instruction hints from raw attributes — not from decompiled AI.
 *
 * Instruction labels match the CM3 / CM0102 manual “Player Instruction” dialog (e.g. Run with the Ball,
 * Hold Up the Ball, Try Through Balls). Yes / No here is scout advice only (not read from the game executable).
 *
 * Values use `scoutDisplayVector48` (same 1–20 display as CM Scout % / profile), not raw disk bytes alone.
 */
import type { PlayerRecord, StaffRecord } from './database/types'
import {
  isAttackingMidfielder,
  isDefender,
  isDefensiveMidfielder,
  isForward,
  isGoalkeeper,
  isMidfielder,
  isStriker,
  isWingBack,
  scoutDisplayVector48,
} from './cmScoutRating'

export type InstructionTier = 'strong' | 'ok' | 'avoid'

export interface TacticalInstructionHint {
  id: string
  label: string
  tier: InstructionTier
  reason: string
}

export interface FreeRoleHint {
  recommend: boolean
  headline: string
  detail: string
}

function g(p: PlayerRecord, key: keyof PlayerRecord): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** In-game free-role preference (player.dat); >14 = likes roaming. */
export function freeRolePreference(p: PlayerRecord): number {
  return g(p, 'free_role')
}

export function computeFreeRoleHint(p: PlayerRecord, s: StaffRecord): FreeRoleHint {
  const pref = freeRolePreference(p)
  const scr = scoutDisplayVector48(p, s)
  const D = (i: number) => {
    const v = scr[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }
  const roaming =
    D(22) >= 15 &&
    D(0) >= 15 &&
    D(3) >= 15 &&
    D(30) >= 15 &&
    D(47) >= 13

  const attacking =
    isAttackingMidfielder(p) || (isMidfielder(p) && D(1) >= 14) || isForward(p) || isStriker(p)

  if (pref >= 16) {
    return {
      recommend: true,
      headline: 'Free Role — strong database fit',
      detail: `Free Role (player instruction): high free-role preference (${pref}/20) on disk — manual recommends exceptional players with strong Off The Ball; flair, anticipation, decisions and technique here support roaming.`,
    }
  }

  if (pref >= 14 && roaming && attacking && !isGoalkeeper(p)) {
    return {
      recommend: true,
      headline: 'Free Role — worth trying',
      detail: `Free Role: preference ${pref}/20 is decent and mentals + technique support roaming off a fixed slot (manual: greater leeway to roam).`,
    }
  }

  if (roaming && attacking && pref < 12) {
    return {
      recommend: false,
      headline: 'Free Role — attributes OK, preference low',
      detail: `Could use Free Role tactically, but free-role preference is low (${pref}/20) on disk — they may be happier fixed unless retrained.`,
    }
  }

  return {
    recommend: false,
    headline: 'Free Role — no strong signal',
    detail: `Free Role: preference ${pref}/20; profile is structured (e.g. destroyer / target) or lacks roaming mentals.`,
  }
}

/**
 * @param softOkIfEligible — when strong and ok both fail but we are not hard-avoiding, still recommend
 *   borderline Yes for roles where the instruction is meaningful (avoids “all No” on elite creators who miss one leg threshold).
 */
function tier(strong: boolean, ok: boolean, avoid: boolean, softOkIfEligible = false): InstructionTier {
  if (avoid) return 'avoid'
  if (strong) return 'strong'
  if (ok) return 'ok'
  if (softOkIfEligible) return 'ok'
  return 'avoid'
}

export function computeTacticalInstructionHints(p: PlayerRecord, s: StaffRecord): TacticalInstructionHint[] {
  const out: TacticalInstructionHint[] = []

  const scr = scoutDisplayVector48(p, s)
  const D = (i: number) => {
    const v = scr[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }

  const drib = D(4)
  const flair = D(22)
  const tech = D(30)
  const bal = D(20)
  const acc = D(18)
  const pace = D(26)
  const ls = D(7)
  const pass = D(10)
  const cre = D(1)
  const dec = D(3)
  const anticip = D(0)
  const otb = D(9)
  const sta = D(28)
  const wr = D(31)
  const str = D(29)
  const fin = D(5)
  const det = D(37)
  const cross = D(2)
  const agg = D(33)

  const midAtt = isAttackingMidfielder(p) || isMidfielder(p)
  const wideNatural =
    isWingBack(p) || (isAttackingMidfielder(p) && (g(p, 'left_side') > 14 || g(p, 'right_side') > 14))

  const runStrong =
    drib >= 16 &&
    tech >= 15 &&
    bal >= 14 &&
    (flair >= 14 || acc >= 15 || (pass >= 17 && cre >= 16)) &&
    (pace >= 13 || (pace >= 11 && (acc >= 14 || tech >= 17)))
  const runOk = drib >= 14 && tech >= 14 && bal >= 13
  const runAvoid = drib <= 11 || (dec <= 11 && tech <= 12)
  const runEligible = !isGoalkeeper(p)

  out.push({
    id: 'run_with_ball',
    label: 'Run with the Ball',
    tier: tier(runStrong, runOk && !runAvoid, runAvoid, runEligible && !runAvoid),
    reason: runStrong
      ? 'Manual: Pace, Acceleration and Dribbling — this profile fits. High Flair also supports the unexpected.'
      : runAvoid
        ? 'Manual: avoid if dribbling, decisions or technique are weak — turnovers likely.'
        : 'Manual fit is borderline; use Yes only in short spells or vs weaker sides.',
  })

  const shotStrong = ls >= 16 && tech >= 15 && (fin >= 14 || cre >= 14)
  const shotOk = ls >= 14 && tech >= 13
  const shotAvoid = ls <= 10

  out.push({
    id: 'long_shots',
    label: 'Long Shots',
    tier: tier(shotStrong, shotOk && !shotAvoid, shotAvoid, !shotAvoid && ls >= 12),
    reason: shotStrong
      ? 'Manual: “attempt long-shots when given the chance” — Long Shots + technique support it.'
      : shotAvoid
        ? 'Manual: only players with good shooting — attribute is too low here.'
        : 'Borderline shooting stack — occasional attempts only.',
  })

  const tbStrong =
    (pass >= 16 && cre >= 15 && dec >= 16 && anticip >= 15) ||
    (pass >= 18 && cre >= 16 && dec >= 14 && anticip >= 13) ||
    (pass >= 17 && cre >= 16 && dec >= 15 && tech >= 16 && anticip >= 13)
  const tbOk =
    (pass >= 14 && cre >= 13 && dec >= 14) || (pass >= 16 && cre >= 14 && dec >= 13 && anticip >= 13)
  const tbAvoid = pass <= 11 || dec <= 10

  out.push({
    id: 'through_balls',
    label: 'Try Through Balls',
    tier: tier(tbStrong, tbOk, tbAvoid, !tbAvoid && pass >= 14 && cre >= 12),
    reason: tbStrong
      ? 'Manual: high Creativity and Passing for passes in front of forwards.'
      : pass <= 11
        ? 'Passing too low for line-breaking balls.'
        : 'Use selectively when shape creates lanes.',
  })

  const creatorForwardRuns =
    (isAttackingMidfielder(p) || isMidfielder(p) || isForward(p)) &&
    !isGoalkeeper(p) &&
    pass >= 17 &&
    cre >= 15 &&
    tech >= 16 &&
    otb >= 13 &&
    sta >= 11

  const lateRunnerMid =
    midAtt &&
    fin >= 15 &&
    otb >= 14 &&
    tech >= 15 &&
    (pace >= 14 || acc >= 14 || (pass >= 17 && cre >= 15 && otb >= 15))

  const fwdStrong =
    ((isDefensiveMidfielder(p) || isMidfielder(p) || isWingBack(p)) &&
      otb >= 16 &&
      sta >= 15 &&
      wr >= 15 &&
      anticip >= 14) ||
    lateRunnerMid ||
    creatorForwardRuns
  const fwdOk =
    (otb >= 15 && sta >= 14 && wr >= 14) ||
    (midAtt && fin >= 14 && otb >= 14 && sta >= 14) ||
    (isStriker(p) && otb >= 14 && sta >= 13 && wr >= 13 && fin >= 14)
  const fwdAvoid = isDefender(p) && !isWingBack(p) && g(p, 'defender') > 14 && otb <= 12

  const pureCentreBackOnly =
    isDefender(p) &&
    !isWingBack(p) &&
    !isMidfielder(p) &&
    !isAttackingMidfielder(p) &&
    !isDefensiveMidfielder(p) &&
    !isForward(p) &&
    !isStriker(p) &&
    !isGoalkeeper(p)

  out.push({
    id: 'gets_forward',
    label: 'Forward Runs',
    tier: tier(fwdStrong, fwdOk && !fwdAvoid, fwdAvoid, !pureCentreBackOnly && !isGoalkeeper(p) && !fwdAvoid),
    reason: fwdStrong
      ? 'Forum / tactics screen: Forward Runs — legs, hub creators, or AMC/CM late runners.'
      : fwdAvoid
        ? 'Pure defensive CB shape — Forward Runs risks leaving gaps.'
        : 'Moderate runs possible; watch stamina if set to Yes.',
  })

  const head = D(6)
  const holdStrong =
    (isForward(p) || isStriker(p)) && str >= 16 && bal >= 15 && tech >= 14 && (head >= 14 || str >= 17)
  const holdOk = (isForward(p) || isStriker(p)) && str >= 15 && bal >= 14 && tech >= 13

  out.push({
    id: 'holds_up_ball',
    label: 'Hold Up the Ball',
    tier: tier(holdStrong, holdOk, !isForward(p) && !isStriker(p)),
    reason: holdStrong
      ? 'Manual: “hold the ball when he gets it” — strength, balance, technique (heading helps focal ST).'
      : !isForward(p) && !isStriker(p)
        ? 'Instruction is for forwards / focal attackers in the box.'
        : 'Physical presence is only adequate — borderline Hold Up the Ball.',
  })

  const crossStrong = wideNatural && cross >= 16 && (pace >= 14 || acc >= 14) && tech >= 14
  const crossOk = wideNatural && cross >= 14 && tech >= 13
  const crossAvoid = wideNatural && cross <= 11

  out.push({
    id: 'cross_ball',
    label: 'Cross Ball',
    tier: tier(crossStrong, crossOk && !crossAvoid, crossAvoid || !wideNatural),
    reason: !wideNatural
      ? 'Manual: only wide players with decent Crossing — natural role is not wide.'
      : crossStrong
        ? 'Manual: passes from out wide into the box — crossing plus legs and technique fit.'
        : crossAvoid
          ? 'Crossing too low for repeated Cross Ball.'
          : 'Crossing OK for occasional service.',
  })

  const pressStrong =
    wr >= 16 && sta >= 16 && agg >= 15 && anticip >= 15 && det >= 14 && !isGoalkeeper(p) && !isStriker(p)
  const pressOk = wr >= 15 && sta >= 15 && agg >= 14

  out.push({
    id: 'closing_down',
    label: 'Pressing',
    tier: tier(pressStrong, pressOk, isGoalkeeper(p), !isGoalkeeper(p) && !isStriker(p) && (pressOk || wr >= 13)),
    reason: pressStrong
      ? 'Manual / tactics: Pressing — work rate, stamina, aggression, anticipation (manual warns it tires players).'
      : isGoalkeeper(p)
        ? 'Pressing is an outfield team/player instruction context.'
        : 'Can press in spells if stamina allows.',
  })

  return out
}
