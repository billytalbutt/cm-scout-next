/**
 * CM0102 “long” encoding for club cash and stadium capacities (CM0102Patcher ConvertLongToCM2Format).
 * On disk: packed int32; in-game pounds for cash = decode(raw) × 1000.
 */

/** Decode packed CM2 long → normal units (thousands for cash before ×1000). */
export function cm2LongToNormal(raw: number): number {
  const v = Math.trunc(raw)
  return ((v & 0xff00) >> 8) * 16384 + ((v & 0xff0000) >> 16) * 128 + ((v & 0xff000000) >>> 24)
}

/** Encode normal units → packed CM2 long. */
export function cm2LongFromNormal(normal: number): number {
  let val = Math.max(0, Math.trunc(normal))
  const v3 = Math.floor(val / 16384)
  val -= v3 * 16384
  const v2 = Math.floor(val / 128)
  val -= v2 * 128
  return (v3 << 8) | (v2 << 16) | (val << 24)
}

/** Read int32 from club/stadium row and return display value (e.g. pounds). */
export function cm2LongDiskToDisplay(raw: number, displayScale: number): number {
  return cm2LongToNormal(raw) * displayScale
}

/** Display value (e.g. pounds) → int32 to write on disk. */
export function cm2LongDisplayToDisk(display: number, displayScale: number): number {
  const normal = Math.max(0, Math.trunc(display)) / displayScale
  return cm2LongFromNormal(normal)
}
