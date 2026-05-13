/**
 * Curated community-lore tactic seeds for the Tactics Lab (not read from the game EXE).
 * Sources: Champman0102.net tactic threads, CM3-era width/tempo/offside heuristics — for UI exploration only.
 */
export type TacticPresetId = '442_narrow' | '433_control' | '4231_shadow'

export interface TacticPreset {
  id: TacticPresetId
  label: string
  /** Short why it is often cited online. */
  blurb: string
  /** Relative slot positions 0–1 on a vertical pitch (goal at bottom). */
  slots: { role: string; x: number; y: number }[]
  teamInstructions: string[]
  /** Attribute / instruction hints for recruitment filters (display only). */
  roleHints: { role: string; attrs: string; instructions: string }[]
}

export const TACTIC_PRESETS: TacticPreset[] = [
  {
    id: '442_narrow',
    label: '4-4-2 narrow diamond (classic CM0102)',
    blurb:
      'Forums often praise a tight diamond for central overload; width comes from full-backs. Risk: flanks can be exposed vs true wing play.',
    slots: [
      { role: 'GK', x: 0.5, y: 0.06 },
      { role: 'DL', x: 0.12, y: 0.32 },
      { role: 'DR', x: 0.88, y: 0.32 },
      { role: 'DMC', x: 0.5, y: 0.38 },
      { role: 'ML', x: 0.22, y: 0.52 },
      { role: 'MR', x: 0.78, y: 0.52 },
      { role: 'AMC', x: 0.5, y: 0.62 },
      { role: 'STCL', x: 0.38, y: 0.82 },
      { role: 'STCR', x: 0.62, y: 0.82 },
    ],
    teamInstructions: ['Narrow', 'Through middle', 'Higher tempo', 'Offside trap (situational)'],
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
      { role: 'DL', x: 0.12, y: 0.3 },
      { role: 'DR', x: 0.88, y: 0.3 },
      { role: 'DMC', x: 0.5, y: 0.4 },
      { role: 'MCL', x: 0.32, y: 0.52 },
      { role: 'MCR', x: 0.68, y: 0.52 },
      { role: 'AML', x: 0.18, y: 0.72 },
      { role: 'AMR', x: 0.82, y: 0.72 },
      { role: 'ST', x: 0.5, y: 0.84 },
    ],
    teamInstructions: ['Wider', 'Pass into space', 'Pressing (squad depth permitting)'],
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
      { role: 'DL', x: 0.12, y: 0.3 },
      { role: 'DR', x: 0.88, y: 0.3 },
      { role: 'DMCL', x: 0.35, y: 0.42 },
      { role: 'DMCR', x: 0.65, y: 0.42 },
      { role: 'AML', x: 0.2, y: 0.58 },
      { role: 'AMC', x: 0.5, y: 0.62 },
      { role: 'AMR', x: 0.8, y: 0.58 },
      { role: 'ST', x: 0.5, y: 0.84 },
    ],
    teamInstructions: ['Counter when prudent', 'Mixed passing', 'Flexible width'],
    roleHints: [
      {
        role: 'AMC (shadow)',
        attrs: 'Off the ball, Anticipation, Finishing, Stamina; creativity can be moderate if runners exist.',
        instructions: 'Forward runs; Try through balls if decisions support it.',
      },
    ],
  },
]
