/**
 * Baseline attribute floors for the engine sniffer “main path” (see `main/engineSniffer.ts`).
 * Used to pre-fill grid attribute minimums when the user picks Assist or Striker — not identical to every
 * overflow branch, but a practical starting point to relax with N-of-M or lower values.
 *
 * Indices follow `CM_SCOUT_ATTR_LABELS` / `intrinsicRawAt` order (48).
 */
export type EngineSnifferPresetId = 'assist_prospect' | 'striker_finisher'

export const ENGINE_SNIFFER_ATTR_PRESETS: Record<
  EngineSnifferPresetId,
  readonly { i: number; min: number }[]
> = {
  assist_prospect: [
    { i: 0, min: 17 },
    { i: 1, min: 16 },
    { i: 3, min: 17 },
    { i: 10, min: 17 },
    { i: 30, min: 17 },
    { i: 21, min: 15 },
    { i: 27, min: 15 },
    { i: 19, min: 16 },
    { i: 20, min: 16 },
    { i: 28, min: 16 },
    { i: 36, min: 16 },
    { i: 39, min: 16 },
    { i: 32, min: 16 },
    { i: 45, min: 17 },
  ],
  striker_finisher: [
    { i: 26, min: 17 },
    { i: 18, min: 17 },
    { i: 5, min: 17 },
    { i: 9, min: 17 },
    { i: 22, min: 17 },
    { i: 30, min: 17 },
    { i: 20, min: 17 },
    { i: 4, min: 17 },
    { i: 36, min: 16 },
    { i: 39, min: 16 },
    { i: 37, min: 17 },
  ],
}

export function attrMinsStringsFromEnginePreset(id: EngineSnifferPresetId): string[] {
  const out = Array.from({ length: 48 }, () => '')
  for (const { i, min } of ENGINE_SNIFFER_ATTR_PRESETS[id]) {
    out[i] = String(min)
  }
  return out
}
