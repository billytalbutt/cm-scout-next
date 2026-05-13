/**
 * Heuristic CM0102 individual instruction hints from raw attributes — not from decompiled AI.
 *
 * Instruction labels match the CM3 / CM0102 manual “Player Instruction” dialog (e.g. Run with the Ball,
 * Hold Up the Ball, Try Through Balls). Yes / No here is scout advice only (not read from the game executable).
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

export function computeFreeRoleHint(p: PlayerRecord): FreeRoleHint {
  const pref = freeRolePreference(p)
  const roaming =
    g(p, 'flair') >= 15 &&
    g(p, 'anticipation') >= 15 &&
    g(p, 'decisions') >= 15 &&
    g(p, 'technique') >= 15 &&
    g(p, 'versatility') >= 13

  const attacking =
    isAttackingMidfielder(p) || (isMidfielder(p) && g(p, 'creativity') >= 14) || isForward(p) || isStriker(p)

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

function tier(
  strong: boolean,
  ok: boolean,
  avoid: boolean,
): InstructionTier {
  if (avoid) return 'avoid'
  if (strong) return 'strong'
  if (ok) return 'ok'
  return 'avoid'
}

export function computeTacticalInstructionHints(p: PlayerRecord, s: StaffRecord): TacticalInstructionHint[] {
  const out: TacticalInstructionHint[] = []

  const drib = g(p, 'dribbling')
  const flair = g(p, 'flair')
  const tech = g(p, 'technique')
  const bal = g(p, 'balance')
  const acc = g(p, 'acceleration')
  const pace = g(p, 'pace')
  const ls = g(p, 'long_shots')
  const pass = g(p, 'passing')
  const cre = g(p, 'creativity')
  const dec = g(p, 'decisions')
  const ant = g(p, 'anticipation')
  const otb = g(p, 'off_the_ball')
  const sta = g(p, 'stamina')
  const wr = g(p, 'work_rate')
  const str = g(p, 'strength')
  const fin = g(p, 'finishing')
  const det = s.determination
  const cross = g(p, 'crossing')

  const midAtt = isAttackingMidfielder(p) || isMidfielder(p)
  const wideNatural =
    isWingBack(p) || (isAttackingMidfielder(p) && (g(p, 'left_side') > 14 || g(p, 'right_side') > 14))

  const runStrong =
    drib >= 16 && tech >= 15 && bal >= 14 && (flair >= 14 || acc >= 15) && pace >= 14
  const runOk = drib >= 14 && tech >= 14 && bal >= 13
  const runAvoid = drib <= 11 || (dec <= 11 && tech <= 12)

  out.push({
    id: 'run_with_ball',
    label: 'Run with the Ball',
    tier: tier(runStrong, runOk && !runAvoid, runAvoid),
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
    tier: tier(shotStrong, shotOk && !shotAvoid, shotAvoid),
    reason: shotStrong
      ? 'Manual: “attempt long-shots when given the chance” — Long Shots + technique support it.'
      : shotAvoid
        ? 'Manual: only players with good shooting — attribute is too low here.'
        : 'Borderline shooting stack — occasional attempts only.',
  })

  const tbStrong = pass >= 16 && cre >= 15 && dec >= 16 && ant >= 15
  const tbOk = pass >= 14 && cre >= 13 && dec >= 14

  out.push({
    id: 'through_balls',
    label: 'Try Through Balls',
    tier: tier(tbStrong, tbOk, pass <= 12 || dec <= 12),
    reason: tbStrong
      ? 'Manual: high Creativity and Passing for passes in front of forwards.'
      : pass <= 12
        ? 'Passing too low for line-breaking balls.'
        : 'Use selectively when shape creates lanes.',
  })

  const lateRunnerMid = midAtt && fin >= 15 && otb >= 15 && (pace >= 14 || acc >= 14) && tech >= 14
  const fwdStrong =
    ((isDefensiveMidfielder(p) || isMidfielder(p) || isWingBack(p)) && otb >= 16 && sta >= 15 && wr >= 15 && ant >= 14) ||
    lateRunnerMid
  const fwdOk =
    (otb >= 15 && sta >= 14 && wr >= 14) ||
    (midAtt && fin >= 14 && otb >= 14 && sta >= 14)
  const fwdAvoid = isDefender(p) && !isWingBack(p) && g(p, 'defender') > 14 && otb <= 12

  out.push({
    id: 'gets_forward',
    label: 'Forward Runs',
    tier: tier(fwdStrong, fwdOk && !fwdAvoid, fwdAvoid),
    reason: fwdStrong
      ? 'Forum / tactics screen: Forward Runs — off-the-ball plus legs (and AMC/CM late runners with finishing).'
      : fwdAvoid
        ? 'Pure defensive CB shape — Forward Runs risks leaving gaps.'
        : 'Moderate runs possible; watch stamina if set to Yes.',
  })

  const holdStrong =
    (isForward(p) || isStriker(p)) && str >= 16 && bal >= 15 && tech >= 14 && (g(p, 'heading') >= 14 || str >= 17)
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
    wr >= 16 && sta >= 16 && g(p, 'aggression') >= 15 && ant >= 15 && det >= 14 && !isGoalkeeper(p) && !isStriker(p)
  const pressOk = wr >= 15 && sta >= 15 && g(p, 'aggression') >= 14

  out.push({
    id: 'closing_down',
    label: 'Pressing',
    tier: tier(pressStrong, pressOk, isGoalkeeper(p)),
    reason: pressStrong
      ? 'Manual / tactics: Pressing — work rate, stamina, aggression, anticipation (manual warns it tires players).'
      : isGoalkeeper(p)
        ? 'Pressing is an outfield team/player instruction context.'
        : 'Can press in spells if stamina allows.',
  })

  return out
}
