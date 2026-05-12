/**
 * Baseline attribute floors for engine sniffer “main path” presets (see `main/engineSniffer.ts`).
 * Indices follow `CM_SCOUT_ATTR_LABELS` / `intrinsicRawAt` order (48).
 */
export type EngineSnifferPresetId =
  | 'assist_prospect'
  | 'striker_finisher'
  | 'goalkeeper'
  | 'defender'
  | 'defensive_mid'
  | 'attacking_mid'

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
  /** Aligned with relaxed finisher sniffer (no flair in hard “core” ladder). */
  striker_finisher: [
    { i: 26, min: 16 },
    { i: 18, min: 16 },
    { i: 5, min: 16 },
    { i: 9, min: 16 },
    { i: 30, min: 16 },
    { i: 22, min: 14 },
    { i: 4, min: 14 },
    { i: 20, min: 15 },
    { i: 36, min: 15 },
    { i: 39, min: 15 },
    { i: 37, min: 16 },
  ],
  goalkeeper: [
    { i: 15, min: 16 },
    { i: 16, min: 15 },
    { i: 17, min: 16 },
    { i: 12, min: 15 },
    { i: 0, min: 15 },
    { i: 3, min: 15 },
    { i: 19, min: 14 },
    { i: 24, min: 14 },
    { i: 36, min: 15 },
    { i: 39, min: 14 },
    { i: 37, min: 15 },
    { i: 42, min: 13 },
    { i: 43, min: 14 },
  ],
  defender: [
    { i: 8, min: 16 },
    { i: 13, min: 16 },
    { i: 12, min: 16 },
    { i: 0, min: 16 },
    { i: 35, min: 15 },
    { i: 6, min: 15 },
    { i: 29, min: 15 },
    { i: 24, min: 15 },
    { i: 26, min: 14 },
    { i: 20, min: 15 },
    { i: 36, min: 15 },
    { i: 39, min: 14 },
    { i: 37, min: 15 },
    { i: 43, min: 14 },
  ],
  defensive_mid: [
    { i: 13, min: 16 },
    { i: 12, min: 16 },
    { i: 8, min: 15 },
    { i: 31, min: 16 },
    { i: 28, min: 16 },
    { i: 10, min: 15 },
    { i: 3, min: 16 },
    { i: 0, min: 15 },
    { i: 45, min: 16 },
    { i: 33, min: 14 },
    { i: 36, min: 15 },
    { i: 39, min: 14 },
    { i: 37, min: 15 },
    { i: 43, min: 14 },
  ],
  attacking_mid: [
    { i: 1, min: 16 },
    { i: 30, min: 16 },
    { i: 10, min: 16 },
    { i: 3, min: 16 },
    { i: 0, min: 15 },
    { i: 9, min: 15 },
    { i: 22, min: 15 },
    { i: 28, min: 15 },
    { i: 20, min: 15 },
    { i: 36, min: 15 },
    { i: 39, min: 14 },
    { i: 37, min: 15 },
    { i: 43, min: 14 },
  ],
}

export function attrMinsStringsFromEnginePreset(id: EngineSnifferPresetId): string[] {
  const out = Array.from({ length: 48 }, () => '')
  for (const { i, min } of ENGINE_SNIFFER_ATTR_PRESETS[id]) {
    out[i] = String(min)
  }
  return out
}
