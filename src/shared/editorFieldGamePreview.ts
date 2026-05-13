import {
  buildCa18Display,
  CA18_KEYS,
  otherAttrDisplay,
  type Ca18Key,
  type PlayerAttrMathInput,
} from './cm0102AttributeDisplay'

/** Values CM0102 shows directly (no CA18 / no 1–20 clamp transform in the profile sense). */
const DIRECT_SCREEN_KEYS = new Set([
  'squad_number',
  'current_ability',
  'potential_ability',
  'home_reputation',
  'current_reputation',
  'world_reputation',
])

export type EditorFieldGamePreview = {
  /** How to describe the preview in UI copy */
  kind: 'direct' | 'ca18' | 'clamped'
  /** What you effectively see on the player attributes screen (1–20 capped where applicable). */
  inGame: number
  /** Engine-style display (CA18 can exceed 20); equals raw for clamped attrs. */
  inGameUncapped: number
  /** Helper used in profile tooltips */
  inMatch: number | null
}

function asMathInput(merged: Record<string, number>): PlayerAttrMathInput {
  const ca = Number(merged.current_ability)
  const gk = Number(merged.goalkeeper)
  return {
    ...merged,
    current_ability: Number.isFinite(ca) ? Math.trunc(ca) : 0,
    goalkeeper: Number.isFinite(gk) ? Math.trunc(gk) : 0,
  }
}

/**
 * Map one on-disk editor field to the same “in-game” numbers the main profile uses
 * (`buildCa18Display` / `otherAttrDisplay`), given a merged player+staff byte map.
 */
export function getEditorFieldGamePreview(merged: Record<string, number>, key: string): EditorFieldGamePreview {
  if (DIRECT_SCREEN_KEYS.has(key)) {
    const v = Math.trunc(Number(merged[key]) || 0)
    return { kind: 'direct', inGame: v, inGameUncapped: v, inMatch: null }
  }

  if ((CA18_KEYS as readonly string[]).includes(key)) {
    const ca18 = buildCa18Display(asMathInput(merged))
    const b = ca18[key as Ca18Key]
    return {
      kind: 'ca18',
      inGame: b.inGame,
      inGameUncapped: b.inGameUncapped,
      inMatch: b.inMatch,
    }
  }

  const raw = Math.trunc(Number(merged[key]) || 0)
  const o = otherAttrDisplay(raw)
  return {
    kind: 'clamped',
    inGame: o.inGame,
    inGameUncapped: o.inGameUncapped,
    inMatch: o.inMatch,
  }
}
