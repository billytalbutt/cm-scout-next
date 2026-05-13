/** Meta-profile ids + UI labels (shared by main matchers + renderer filter dropdown). */
export const ENGINE_META_PROFILE_IDS = [
  'meta_mc_regulator',
  'meta_mc_volume',
  'meta_dmc_anchor',
  'meta_dmc_regista',
  'meta_dc_reader',
  'meta_dc_libero_passer',
  'meta_st_poacher',
  'meta_st_target',
  'meta_wb_motor',
  'meta_wide_carrier',
  'meta_amc_shadow',
  'meta_gk_commanding',
] as const

export type EngineMetaProfileId = (typeof ENGINE_META_PROFILE_IDS)[number]

export const ENGINE_META_PROFILE_LABELS: Record<EngineMetaProfileId, string> = {
  meta_mc_regulator: 'MC regulator (hub / mentals+technique)',
  meta_mc_volume: 'MC volume playmaker (pass/creat/stamina)',
  meta_dmc_anchor: 'DMC anchor (destroyer)',
  meta_dmc_regista: 'DMC regista (distribution)',
  meta_dc_reader: 'DC reader (anticipation spine)',
  meta_dc_libero_passer: 'DC / SW libero passer',
  meta_st_poacher: 'ST poacher (finishing+OTB, pace ok)',
  meta_st_target: 'ST target (aerial+strength)',
  meta_wb_motor: 'WB motor (two-way legs)',
  meta_wide_carrier: 'Wide carrier (dribble+pace)',
  meta_amc_shadow: 'AMC shadow / late runner',
  meta_gk_commanding: 'GK commanding (reads+presence)',
}
