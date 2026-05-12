import type { PlayerRecord } from './types'

/**
 * Future UI: "Show engine raw attributes" toggle — profile already carries `raw` vs `inGame` vs `inMatch`.
 * When on, prefer displaying `raw` (can exceed 20 for CA18) in grids/tooltips; filters may optionally
 * use raw vs in-match via IPC flag. See profile `buildCa18Display` / `otherAttrDisplay`.
 */
export function highConvert(ca: number, intrinsic: number): number {
  const d = intrinsic / 10 + ca / 20 + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return Math.trunc(r)
}

/** Same CA→display formula as `highConvert` but not capped at 20 (engine “true” in-game scale). */
export function highConvertUncapped(ca: number, intrinsic: number): number {
  const d = intrinsic / 10 + ca / 20 + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  return Math.trunc(r)
}

export function lowConvert(ca: number, intrinsic: number): number {
  const d = intrinsic / 10 + ca / 200 + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return Math.trunc(r)
}

export function lowConvertUncapped(ca: number, intrinsic: number): number {
  const d = intrinsic / 10 + ca / 200 + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  return Math.trunc(r)
}

export function inMatchValue(ca: number, intrinsic: number): number {
  let r = intrinsic / 5 + ca / 20 + 10
  if (r < 0) r = 0
  return Math.trunc(r)
}

function isGk(p: PlayerRecord): boolean {
  return p.goalkeeper > 14
}

export function inGameCa18(idx: number, ca: number, intrinsic: number, p: PlayerRecord): number {
  const gk = isGk(p)
  if ([0, 3, 6, 7, 10, 11, 12, 13].includes(idx)) return highConvert(ca, intrinsic)
  if ([15, 16, 17].includes(idx)) return gk ? highConvert(ca, intrinsic) : lowConvert(ca, intrinsic)
  if ([1, 2, 4, 5, 8, 9, 14].includes(idx)) return gk ? lowConvert(ca, intrinsic) : highConvert(ca, intrinsic)
  return intrinsic
}

export function inGameCa18Uncapped(idx: number, ca: number, intrinsic: number, p: PlayerRecord): number {
  const gk = isGk(p)
  if ([0, 3, 6, 7, 10, 11, 12, 13].includes(idx)) return highConvertUncapped(ca, intrinsic)
  if ([15, 16, 17].includes(idx)) return gk ? highConvertUncapped(ca, intrinsic) : lowConvertUncapped(ca, intrinsic)
  if ([1, 2, 4, 5, 8, 9, 14].includes(idx)) return gk ? lowConvertUncapped(ca, intrinsic) : highConvertUncapped(ca, intrinsic)
  return intrinsic
}

function clamp20(v: number): number {
  if (v < 1) return 1
  if (v > 20) return 20
  return v
}

/** CA18 keys in CM Scout order (indices 0–17). */
export const CA18_KEYS = [
  'anticipation',
  'creativity',
  'crossing',
  'decisions',
  'dribbling',
  'finishing',
  'heading',
  'long_shots',
  'marking',
  'off_the_ball',
  'passing',
  'penalties',
  'positioning',
  'tackling',
  'throw_ins',
  'handling',
  'one_on_ones',
  'reflexes',
] as const

export type Ca18Key = (typeof CA18_KEYS)[number]

/** Values for profile: on-screen (capped), intrinsic byte, in-match helper, uncapped CA18-style display when applicable. */
export type AttrDisplayBlock = {
  raw: number
  inGame: number
  inMatch: number
  /** Uncapped “engine” display (can exceed 20 for CA18-style attrs); equals `raw` for non-CA18 fields. */
  inGameUncapped: number
}

export function buildCa18Display(p: PlayerRecord): Record<Ca18Key, AttrDisplayBlock> {
  const ca = p.current_ability
  const out = {} as Record<Ca18Key, AttrDisplayBlock>
  CA18_KEYS.forEach((key, idx) => {
    const raw = p[key] as number
    out[key] = {
      raw,
      inGame: inGameCa18(idx, ca, raw, p),
      inGameUncapped: inGameCa18Uncapped(idx, ca, raw, p),
      inMatch: inMatchValue(ca, raw),
    }
  })
  return out
}

export function otherAttrDisplay(raw: number): AttrDisplayBlock {
  const ig = clamp20(raw)
  return { raw, inGame: ig, inGameUncapped: raw, inMatch: ig }
}
