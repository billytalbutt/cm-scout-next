/**
 * Curated community-lore tactic seeds for the Tactics Lab (not read from the game EXE).
 * Lore sources: Champman0102.net tactic threads (narrow diamonds, 4-1-3-2 pressing, wing-back three-at-the-back,
 * Christmas-tree 4-3-2-1). UI-only — not match-engine truth.
 *
 * Each preset defines 11 outfield roles; Y values align with {@link TACTICAL_ROWS} in tacticsPitchSnap.
 */
export type TacticArrow = 'none' | 'forward' | 'back'

export type TacticPresetId =
  | '442_narrow'
  | '433_control'
  | '4231_shadow'
  | '4132_press_short'
  | '352_wb'
  | '4321_tree'

export interface TacticPresetSlot {
  role: string
  x: number
  /** Vertical: low = own goal line in classic CM pitch diagrams (renderer maps to GK at bottom of widget). */
  y: number
  arrow?: TacticArrow
}

export interface TacticPreset {
  id: TacticPresetId
  label: string
  blurb: string
  slots: TacticPresetSlot[]
  /** Suggested team instructions (display) aligned with CM0102 vocabulary. */
  teamInstructions: string[]
  roleHints: { role: string; attrs: string; instructions: string }[]
}

export const TACTIC_PRESETS: TacticPreset[] = [
  {
    id: '442_narrow',
    label: '4-4-2 narrow diamond (classic CM0102)',
    blurb:
      'Forums often praise a tight diamond for central overload; width comes from full-backs. Risk: flanks vs true wing play.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.12, y: 0.28 },
      { role: 'DCL', x: 0.38, y: 0.28 },
      { role: 'DCR', x: 0.62, y: 0.28 },
      { role: 'DR', x: 0.88, y: 0.28 },
      { role: 'DMC', x: 0.5, y: 0.4 },
      { role: 'ML', x: 0.22, y: 0.52 },
      { role: 'MR', x: 0.78, y: 0.52 },
      { role: 'AMC', x: 0.5, y: 0.64 },
      { role: 'STCL', x: 0.38, y: 0.78 },
      { role: 'STCR', x: 0.62, y: 0.78 },
    ],
    teamInstructions: ['Mentality: Attacking', 'Passing: Mixed / short', 'Pressing: Yes', 'Offside trap: Situational'],
    roleHints: [
      {
        role: 'AMC',
        attrs: 'Creativity, Passing, Decisions, Technique, Off-the-ball — high teens for elite leagues.',
        instructions: 'Through balls; Forward runs if legs allow; Run with ball selectively.',
      },
      {
        role: 'DMC',
        attrs: 'Tackling, Positioning, Stamina, Work rate; passing enough to recycle.',
        instructions: 'Hold position; fewer risky forward runs unless regista-shaped.',
      },
    ],
  },
  {
    id: '433_control',
    label: '4-3-3 control / possession',
    blurb:
      'Wide front three + three-man midfield is a common “control width then isolate FB” shape in community write-ups.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.12, y: 0.28 },
      { role: 'DCL', x: 0.38, y: 0.28 },
      { role: 'DCR', x: 0.62, y: 0.28 },
      { role: 'DR', x: 0.88, y: 0.28 },
      { role: 'DMC', x: 0.5, y: 0.4 },
      { role: 'MCL', x: 0.32, y: 0.52 },
      { role: 'MCR', x: 0.68, y: 0.52 },
      { role: 'AML', x: 0.18, y: 0.64 },
      { role: 'AMR', x: 0.82, y: 0.64 },
      { role: 'ST', x: 0.5, y: 0.78 },
    ],
    teamInstructions: ['Mentality: Normal–Attacking', 'Passing: Short', 'Pressing: Optional', 'Width: Use wingers'],
    roleHints: [
      {
        role: 'Wide forwards',
        attrs: 'Pace, Acceleration, Dribbling, Crossing or finishing depending on inside-cut vs hug-line.',
        instructions: 'Run with ball / Cross ball mix; fewer long shots unless stacked.',
      },
    ],
  },
  {
    id: '4231_shadow',
    label: '4-2-3-1 with shadow AM',
    blurb:
      'Late-runner AMC / shadow striker profiles are a recurring “engine surprise” theme — OTB and anticipation weighted.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.12, y: 0.28 },
      { role: 'DCL', x: 0.38, y: 0.28 },
      { role: 'DCR', x: 0.62, y: 0.28 },
      { role: 'DR', x: 0.88, y: 0.28 },
      { role: 'DMCL', x: 0.35, y: 0.4 },
      { role: 'DMCR', x: 0.65, y: 0.4 },
      { role: 'AML', x: 0.2, y: 0.64 },
      { role: 'AMC', x: 0.5, y: 0.64 },
      { role: 'AMR', x: 0.8, y: 0.64 },
      { role: 'ST', x: 0.5, y: 0.78 },
    ],
    teamInstructions: ['Mentality: Normal', 'Passing: Mixed', 'Pressing: Moderate', 'Offside trap: Optional'],
    roleHints: [
      {
        role: 'AMC (shadow)',
        attrs: 'Off the ball, Anticipation, Finishing, Stamina; creativity can be moderate if runners exist.',
        instructions: 'Forward runs; Try through balls if decisions support it.',
      },
    ],
  },
  {
    id: '4132_press_short',
    label: '4-1-3-2 — narrow mids, forward arrows (community favourite)',
    blurb:
      'Often shared as 4-1-3-2 with the central three pushed on (forward arrows), short passing, attacking mentality, and pressing — a Champman0102 staple thread shape.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.1, y: 0.28 },
      { role: 'DCL', x: 0.3, y: 0.28 },
      { role: 'DCR', x: 0.7, y: 0.28 },
      { role: 'DR', x: 0.9, y: 0.28 },
      { role: 'DMC', x: 0.5, y: 0.4 },
      { role: 'MCL', x: 0.3, y: 0.52, arrow: 'forward' },
      { role: 'MC', x: 0.5, y: 0.52, arrow: 'forward' },
      { role: 'MCR', x: 0.7, y: 0.52, arrow: 'forward' },
      { role: 'STCL', x: 0.38, y: 0.78 },
      { role: 'STCR', x: 0.62, y: 0.78 },
    ],
    teamInstructions: [
      'Mentality: Attacking',
      'Passing: Short',
      'Pressing: Yes',
      'Tackling: Normal (hard if squad discipline allows)',
      'Offside trap: Often no with high line — situational',
    ],
    roleHints: [
      {
        role: 'Shuttle three',
        attrs: 'Stamina, Work rate, Passing, Decisions; OTB for late runs from arrow-style behaviour.',
        instructions: 'Forward runs common in forum presets; keep tacklers behind.',
      },
    ],
  },
  {
    id: '352_wb',
    label: '3-5-2 wing-backs (overload wide then half-spaces)',
    blurb:
      'Three centre-backs plus wing-backs is a recurring “stretch then recycle” thread tactic; narrow mid-three can control central thirds.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'WBL', x: 0.1, y: 0.28 },
      { role: 'DC', x: 0.3, y: 0.28 },
      { role: 'DC', x: 0.5, y: 0.28 },
      { role: 'DC', x: 0.7, y: 0.28 },
      { role: 'WBR', x: 0.9, y: 0.28 },
      { role: 'DMC', x: 0.5, y: 0.4 },
      { role: 'MCL', x: 0.32, y: 0.52 },
      { role: 'MCR', x: 0.68, y: 0.52 },
      { role: 'STCL', x: 0.38, y: 0.78 },
      { role: 'STCR', x: 0.62, y: 0.78 },
    ],
    teamInstructions: ['Mentality: Normal–Attacking', 'Passing: Mixed', 'Width: Wide via wing-backs', 'Pressing: Yes'],
    roleHints: [
      {
        role: 'Wing-backs',
        attrs: 'Stamina, Pace, Crossing, Positioning; tackling enough to recover 1v1.',
        instructions: 'Forward runs; cross early vs low blocks.',
      },
    ],
  },
  {
    id: '4321_tree',
    label: 'Christmas tree 4-3-2-1',
    blurb:
      'Narrow 4-3-2-1 (“tree”) keeps central density; often paired with short passing and controlled pressing in forum guides.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.12, y: 0.28 },
      { role: 'DCL', x: 0.38, y: 0.28 },
      { role: 'DCR', x: 0.62, y: 0.28 },
      { role: 'DR', x: 0.88, y: 0.28 },
      { role: 'DM', x: 0.5, y: 0.4 },
      { role: 'MCL', x: 0.35, y: 0.52 },
      { role: 'MCR', x: 0.65, y: 0.52 },
      { role: 'AMCL', x: 0.35, y: 0.64 },
      { role: 'AMCR', x: 0.65, y: 0.64 },
      { role: 'ST', x: 0.5, y: 0.78 },
    ],
    teamInstructions: ['Mentality: Attacking / Normal', 'Passing: Short', 'Pressing: Yes', 'Offside trap: Optional'],
    roleHints: [
      {
        role: 'Front three (narrow)',
        attrs: 'Technique, Passing, OTB, Creativity in AM strata; finisher traits on lone ST.',
        instructions: 'Through balls into feet; runners from second line.',
      },
    ],
  },
]
