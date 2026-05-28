import type { EffectivenessFullResult, EffStatLine } from './effectivenessEngine'
import { effAttrLabel } from './effectivenessEngine'

const ARCHETYPE_BLURB: Record<string, string> = {
  gk: 'Commands the box with reflexes-first shot stopping and big-game mentals.',
  dc: 'Dominates the defensive coordinate grid through positioning, tackling, and aerial presence.',
  wb: 'Two-way wide outlet — legs, crossing, and defensive bite on the flank.',
  dmc: 'Anchor in front of the back line: wins the ball, covers ground, reads danger.',
  mc: 'Central hub who controls tempo through technique, decisions, and teamwork.',
  amw: 'Wide line-breaker — pace, dribbling, and service from the flank (narrow-tactics meta often skips this profile).',
  amc: 'Central playmaker hub — technique, passing, and decisions in the hole (the narrow-tactics sweet spot).',
  st: 'Poacher / finisher profile — pace, finishing, and off-the-ball movement in the box.',
}

function fmtAttr(key: string, raw: number): string {
  return `${effAttrLabel(key)} ${raw}`
}

function strongLines(lines: EffStatLine[], min = 17): EffStatLine[] {
  return lines.filter((l) => l.raw >= min).sort((a, b) => b.raw - a.raw)
}

function weakLines(lines: EffStatLine[], max = 13): EffStatLine[] {
  return lines.filter((l) => l.raw <= max).sort((a, b) => a.raw - b.raw)
}

function joinList(items: string[], max = 4): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  const head = items.slice(0, max - 1).join(', ')
  return `${head}, and ${items[max - 1]}`
}

export type EffectivenessNarrativeInput = {
  result: EffectivenessFullResult
  playerName?: string
  cmScoutRatingBp?: number | null
}

export type EffectivenessNarrative = {
  headline: string
  summary: string
  strengths: string
  caveats: string | null
}

/** Rule-based English summary for Eff % — no AI; templates from recipe + stat lines. */
export function buildEffectivenessNarrative(input: EffectivenessNarrativeInput): EffectivenessNarrative | null {
  const { result, playerName, cmScoutRatingBp } = input
  if (result.effPercent == null || !result.winnerDetail) return null

  const d = result.winnerDetail
  const id = d.archetypeId
  const label = d.archetypeLabel
  const pct = result.effPercent
  const who = playerName?.trim() ? playerName.trim() : 'This player'

  const primaries = d.lines.filter((l) => l.slot === 'primary')
  const secondaries = d.lines.filter((l) => l.slot === 'secondary')
  const engine = d.engineLines

  const elitePrimary = strongLines(primaries, 18)
  const solidPrimary = strongLines(primaries, 15).filter((l) => l.raw < 18)
  const weakPrimary = weakLines(primaries, 12)
  const eliteEngine = strongLines(engine, 17)

  const scoutGap =
    cmScoutRatingBp != null && Number.isFinite(cmScoutRatingBp) && pct > cmScoutRatingBp + 12
      ? pct - cmScoutRatingBp
      : null

  const headline =
    scoutGap != null
      ? `${label} engine · ${pct.toFixed(1)}% (${scoutGap.toFixed(0)} pts above CM Scout)`
      : `${label} engine · ${pct.toFixed(1)}%`

  const roleLine = ARCHETYPE_BLURB[id] ?? `Strong ${label} recipe match.`

  const strengthBits: string[] = []
  if (elitePrimary.length) {
    strengthBits.push(
      `elite ${joinList(elitePrimary.map((l) => fmtAttr(l.key, l.raw)), 3)} on the weighted primaries`,
    )
  } else if (solidPrimary.length) {
    strengthBits.push(
      `solid ${joinList(solidPrimary.map((l) => fmtAttr(l.key, l.raw)), 3)} driving the recipe`,
    )
  }

  const im = engine.find((l) => l.key === 'important_matches' && l.raw >= 16)
  const con = engine.find((l) => l.key === 'consistency' && l.raw >= 16)
  if (im) strengthBits.push(`shows up in big games (Important matches ${im.raw})`)
  if (con) strengthBits.push(`high Consistency (${con.raw}) so they reach this level often`)

  if (d.synergyBoost && d.synergyBoost > 0) {
    strengthBits.push('profile synergy bonus for a community “Xavi-style” shape')
  }

  if (d.brainMult && d.brainMult.factor >= 0.72) {
    strengthBits.push(
      `sharp brain (${d.brainMult.decisions} Decisions, ${d.brainMult.anticipation} Anticipation) multiplying defensive reads`,
    )
  }

  const eliteEngineNamed = eliteEngine
    .filter((l) => !['important_matches', 'consistency'].includes(l.key))
    .slice(0, 2)
  if (eliteEngineNamed.length) {
    strengthBits.push(`supporting ${joinList(eliteEngineNamed.map((l) => fmtAttr(l.key, l.raw)), 2)}`)
  }

  const strengths =
    strengthBits.length > 0
      ? `${who} scores highly because ${strengthBits.join('; ')}.`
      : `${who} fits the ${label} recipe with balanced primaries across the board.`

  const caveatBits: string[] = []
  for (const w of weakPrimary.slice(0, 2)) {
    caveatBits.push(`low ${effAttrLabel(w.key)} (${w.raw}) on a primary recipe stat`)
  }
  for (const w of weakLines(secondaries, 11).slice(0, 2)) {
    if (!caveatBits.some((c) => c.includes(effAttrLabel(w.key)))) {
      caveatBits.push(`only ${fmtAttr(w.key, w.raw)} on a secondary`)
    }
  }
  if (result.runnerUp && result.runnerUp.score >= pct - 4) {
    caveatBits.push(
      `${result.runnerUp.archetypeLabel} is close (${result.runnerUp.score.toFixed(1)}%) — role choice matters`,
    )
  }

  const summary = `${roleLine} ${strengths}`

  const caveats = caveatBits.length ? `Watch for ${joinList(caveatBits, 3)}.` : null

  return { headline, summary, strengths, caveats }
}
