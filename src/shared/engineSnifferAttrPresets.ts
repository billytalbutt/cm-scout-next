/**
 * Baseline attribute floors for engine sniffer DNA presets (see `main/engineMetaProfiles.ts` + `main/engineSniffer.ts`).
 * Indices follow `CM_SCOUT_ATTR_LABELS` / `intrinsicRawAt` order (48).
 */
import type { EngineMetaProfileId } from './engineMetaProfileCatalog'

export type EngineSnifferPresetId = EngineMetaProfileId

export const ENGINE_SNIFFER_ATTR_PRESETS: Record<
  EngineSnifferPresetId,
  readonly { i: number; min: number }[]
> = {
  meta_mc_regulator: [
    { i: 30, min: 16 },
    { i: 45, min: 16 },
    { i: 3, min: 16 },
    { i: 0, min: 16 },
    { i: 10, min: 14 },
    { i: 1, min: 14 },
    { i: 20, min: 15 },
    { i: 4, min: 14 },
    { i: 37, min: 14 },
  ],
  meta_mc_volume: [
    { i: 10, min: 17 },
    { i: 1, min: 16 },
    { i: 31, min: 16 },
    { i: 33, min: 15 },
    { i: 3, min: 15 },
    { i: 30, min: 16 },
    { i: 37, min: 15 },
  ],
  meta_dmc_anchor: [
    { i: 13, min: 17 },
    { i: 8, min: 16 },
    { i: 2, min: 15 },
    { i: 33, min: 16 },
    { i: 31, min: 16 },
    { i: 12, min: 16 },
    { i: 29, min: 15 },
    { i: 37, min: 15 },
  ],
  meta_dmc_regista: [
    { i: 10, min: 16 },
    { i: 0, min: 16 },
    { i: 3, min: 16 },
    { i: 1, min: 10 },
    { i: 31, min: 15 },
    { i: 45, min: 15 },
    { i: 37, min: 14 },
  ],
  meta_dc_reader: [
    { i: 0, min: 17 },
    { i: 12, min: 17 },
    { i: 3, min: 15 },
    { i: 13, min: 14 },
    { i: 8, min: 14 },
    { i: 26, min: 13 },
    { i: 37, min: 14 },
  ],
  meta_dc_libero_passer: [
    { i: 10, min: 15 },
    { i: 30, min: 15 },
    { i: 3, min: 15 },
    { i: 0, min: 16 },
    { i: 12, min: 15 },
  ],
  meta_st_poacher: [
    { i: 5, min: 16 },
    { i: 9, min: 16 },
    { i: 0, min: 15 },
    { i: 30, min: 14 },
    { i: 4, min: 14 },
    { i: 37, min: 14 },
  ],
  meta_st_target: [
    { i: 6, min: 16 },
    { i: 29, min: 16 },
    { i: 24, min: 15 },
    { i: 5, min: 14 },
    { i: 4, min: 14 },
    { i: 0, min: 14 },
  ],
  meta_wb_motor: [
    { i: 31, min: 17 },
    { i: 32, min: 14 },
    { i: 26, min: 15 },
    { i: 33, min: 16 },
    { i: 13, min: 14 },
    { i: 7, min: 14 },
    { i: 37, min: 14 },
  ],
  meta_wide_carrier: [
    { i: 22, min: 16 },
    { i: 18, min: 15 },
    { i: 26, min: 15 },
    { i: 30, min: 15 },
    { i: 4, min: 14 },
    { i: 21, min: 14 },
  ],
  meta_amc_shadow: [
    { i: 9, min: 17 },
    { i: 0, min: 16 },
    { i: 5, min: 14 },
    { i: 31, min: 15 },
    { i: 3, min: 15 },
    { i: 30, min: 15 },
    { i: 37, min: 14 },
  ],
  meta_gk_commanding: [
    { i: 0, min: 16 },
    { i: 3, min: 16 },
    { i: 12, min: 16 },
    { i: 15, min: 15 },
    { i: 16, min: 15 },
    { i: 17, min: 14 },
    { i: 37, min: 15 },
    { i: 42, min: 14 },
  ],
}

export function attrMinsStringsFromEnginePreset(id: EngineSnifferPresetId): string[] {
  const out = Array.from({ length: 48 }, () => '')
  for (const { i, min } of ENGINE_SNIFFER_ATTR_PRESETS[id]) {
    out[i] = String(min)
  }
  return out
}
