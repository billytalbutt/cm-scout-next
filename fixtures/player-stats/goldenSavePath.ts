/** Default golden save for stats discovery / tests (override with `CM0102_GOLDEN_SAV`). */
export const DEFAULT_GOLDEN_SAV =
  process.env.CM0102_GOLDEN_SAV ?? 'C:/Users/bitalb/Downloads/Blackburn Uncompressed.sav'

/** Optional progressed compare save (`CM0102_PROGRESS_SAV`). */
export const DEFAULT_PROGRESS_SAV =
  process.env.CM0102_PROGRESS_SAV ??
  'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
