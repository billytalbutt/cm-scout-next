/**
 * Heuristic “how strong is this backroom profile for the job?” — **not** decompiled training math.
 * Primaries/secondaries follow community guides (Champman0102 / CM editor docs): coaches lean on
 * coaching + determination + motivating / discipline / tactics; scouts on judgement + potential + motivating;
 * physios on physiotherapy + motivating; assistant managers spread across tactics, man-management, youngsters.
 */
import type { NonPlayerRecord } from './database/types'
import { staffNpAttrInGame } from '../shared/cm0102StaffNpAttributeDisplay'

function npDisp(np: NonPlayerRecord, key: string): number {
  const raw = np[key as keyof NonPlayerRecord] as number
  return staffNpAttrInGame(key, raw, np.currentAbility)
}

function clamp20(n: number): number {
  if (n >= 21) return 20
  if (n < 1) return 0
  return n
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** 0–100 style score for UI bars. */
export function staffRoleHeuristicScore(jobForClub: number, np: NonPlayerRecord | undefined): number {
  if (!np) return 0
  const co = clamp20(npDisp(np, 'coaching'))
  const cgk = clamp20(npDisp(np, 'coachingGks'))
  const tac = clamp20(npDisp(np, 'tactics'))
  const mot = clamp20(npDisp(np, 'motivating'))
  const dis = clamp20(npDisp(np, 'discipline'))
  const man = clamp20(npDisp(np, 'manHandling'))
  const jA = clamp20(npDisp(np, 'judgement'))
  const jP = clamp20(npDisp(np, 'judgingPotential'))
  const phys = clamp20(npDisp(np, 'physiotherapy'))
  const yng = clamp20(npDisp(np, 'youngsters'))

  switch (jobForClub) {
    case 8: // Coach — outfield bias unless GK coach shape (GK much higher than outfield)
      if (cgk >= 14 && cgk > co + 2) {
        return Math.round(avg([cgk, cgk, tac, mot, dis]) * 5)
      }
      return Math.round(avg([co, co, tac, yng, mot, dis, man]) * 5)
    case 9: // Scout
      return Math.round(avg([jA, jP, jA, mot, tac]) * 5)
    case 10: // Physio
      return Math.round(avg([phys, phys, mot, dis]) * 5)
    case 6: // Assistant manager
      return Math.round(avg([tac, co, cgk, mot, man, yng, jA, jP]) * 5)
    case 5: // Manager
      return Math.round(avg([tac, mot, man, jA, co]) * 5)
    default:
      return Math.round(avg([co, tac, mot, jA]) * 5)
  }
}

export function staffHeuristicDetail(jobForClub: number, np: NonPlayerRecord | undefined): string {
  if (!np) return 'No non-player profile linked (non_player_id).'
  const bits: string[] = []
  bits.push(`NPCA ${np.currentAbility}`)
  if (jobForClub === 9) bits.push(`Judge ${npDisp(np, 'judgement')}`, `J.Pot ${npDisp(np, 'judgingPotential')}`)
  else if (jobForClub === 10) bits.push(`Physio ${npDisp(np, 'physiotherapy')}`)
  else bits.push(`Coach ${npDisp(np, 'coaching')}`, `GK ${npDisp(np, 'coachingGks')}`, `Tactics ${npDisp(np, 'tactics')}`)
  bits.push(`Mot ${np.motivating}`, `Young ${np.youngsters}`)
  return bits.join(' · ')
}
